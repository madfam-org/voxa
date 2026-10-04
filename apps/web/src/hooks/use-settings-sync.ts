'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunicatorSettings } from '@/lib/communicator-settings';
import {
  buildPushFields,
  fetchSettingsSyncConsent,
  MAX_CONFLICT_RETRIES,
  mergeSyncedSettings,
  pullSyncedSettings,
  pushSyncedSettings,
  PUSH_DEBOUNCE_MS,
  readSyncState,
  readSyncUserState,
  saveSettingsSyncConsent,
  timesAfterPush,
  SETTINGS_LOCAL_CHANGE_EVENT,
  writeSyncState,
  writeSyncUserState,
} from '@/lib/settings-sync';

/**
 * - `signed-out`: nothing to sync with.
 * - `off`: the `settings_sync` consent is off; nothing is sent.
 * - `syncing`: a pull or push is in flight.
 * - `synced`: this device and the server agree.
 * - `pending`: changes wait for the connection (queued).
 * - `error`: the server refused or sent something unusable; local settings still apply.
 */
export type SettingsSyncStatus = 'signed-out' | 'off' | 'syncing' | 'synced' | 'pending' | 'error';

export interface SettingsSyncControl {
  status: SettingsSyncStatus;
  enabled: boolean;
  signedIn: boolean;
  /** The consent change is being saved. */
  busy: boolean;
  /** The last consent change failed (the toggle kept its saved state). */
  consentError: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
}

interface Options {
  settings: CommunicatorSettings;
  /** The local settings were read from storage (merging before that would compare defaults). */
  loaded: boolean;
  /** Apply server values without marking them as local changes. */
  applyRemote: (patch: Partial<CommunicatorSettings>) => void;
  signedIn: boolean;
  userId: string;
}

/**
 * Keeps the communicator settings in step with the user's server copy while
 * the `settings_sync` consent is on. Everything here runs in the background:
 * the communicator reads local settings and never waits for it.
 */
export function useSettingsSync({ settings, loaded, applyRemote, signedIn, userId }: Options): SettingsSyncControl {
  const [status, setStatus] = useState<SettingsSyncStatus>('signed-out');
  const [enabled, setEnabledState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const enabledRef = useRef(false);
  const inFlight = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  const markEnabled = useCallback((next: boolean, version?: number) => {
    enabledRef.current = next;
    setEnabledState(next);
    const current = readSyncUserState(userRef.current);
    writeSyncUserState(userRef.current, { enabled: next, version: version ?? (next ? current.version : 0) });
  }, []);

  const applyPatch = useCallback(
    (patch: Partial<CommunicatorSettings>) => {
      if (Object.keys(patch).length === 0) return;
      settingsRef.current = { ...settingsRef.current, ...patch };
      applyRemote(patch);
    },
    [applyRemote],
  );

  /** Pull, merge, and push when this device holds newer changes. */
  const run = useCallback(
    async (pull: boolean): Promise<void> => {
      if (!enabledRef.current) return;
      if (inFlight.current) {
        again.current = true;
        return;
      }
      inFlight.current = true;
      setStatus('syncing');
      try {
        if (pull) {
          const pulled = await pullSyncedSettings();
          if (pulled.kind === 'signed-out') return setStatus('signed-out');
          if (pulled.kind === 'consent-required') {
            markEnabled(false);
            return setStatus('off');
          }
          if (pulled.kind === 'unreachable') return setStatus('pending');
          const state = readSyncState();
          const merged = mergeSyncedSettings(settingsRef.current, state.fieldTimes, pulled.document);
          if (!merged.valid) return setStatus('error');
          applyPatch(merged.patch);
          writeSyncState({ fieldTimes: merged.fieldTimes, dirty: state.dirty || merged.needsPush });
          writeSyncUserState(userRef.current, { enabled: true, version: merged.version });
        }

        for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt += 1) {
          const state = readSyncState();
          if (!state.dirty) return setStatus('synced');
          const { version } = readSyncUserState(userRef.current);
          const result = await pushSyncedSettings(version, buildPushFields(settingsRef.current, state.fieldTimes));
          if (result.kind === 'ok') {
            // A change made while the push was in flight keeps the queue dirty.
            const latest = readSyncState();
            const changedMeanwhile = JSON.stringify(latest.fieldTimes) !== JSON.stringify(state.fieldTimes);
            writeSyncState({
              fieldTimes: timesAfterPush(result.document.fields, state.fieldTimes, latest.fieldTimes),
              dirty: changedMeanwhile,
            });
            writeSyncUserState(userRef.current, { enabled: true, version: result.document.version });
            if (!changedMeanwhile) return setStatus('synced');
            continue;
          }
          if (result.kind === 'conflict') {
            // Merge with what this device holds now (it may have changed during the push).
            const latest = readSyncState();
            const merged = mergeSyncedSettings(settingsRef.current, latest.fieldTimes, result.current);
            if (!merged.valid) return setStatus('error');
            applyPatch(merged.patch);
            writeSyncState({ fieldTimes: merged.fieldTimes, dirty: merged.needsPush });
            writeSyncUserState(userRef.current, { enabled: true, version: merged.version });
            continue;
          }
          if (result.kind === 'consent-required') {
            markEnabled(false);
            return setStatus('off');
          }
          if (result.kind === 'signed-out') return setStatus('signed-out');
          if (result.kind === 'rejected') {
            // The server will not take this document; retrying it unchanged would loop.
            writeSyncState({ ...state, dirty: false });
            return setStatus('error');
          }
          return setStatus('pending');
        }
        setStatus('error');
      } finally {
        inFlight.current = false;
        if (again.current) {
          again.current = false;
          void run(false);
        }
      }
    },
    [applyPatch, markEnabled],
  );

  // On sign-in (and on every start): read the consent from the API, then pull.
  useEffect(() => {
    if (!loaded) return;
    if (!signedIn) {
      enabledRef.current = false;
      setEnabledState(false);
      setStatus('signed-out');
      return;
    }
    let cancelled = false;
    void (async () => {
      const consent = await fetchSettingsSyncConsent();
      if (cancelled) return;
      if (consent.kind === 'signed-out') return setStatus('signed-out');
      if (consent.kind === 'unreachable') {
        // Offline: the last known decision applies; changes queue until online.
        const cached = readSyncUserState(userId).enabled;
        enabledRef.current = cached;
        setEnabledState(cached);
        return setStatus(cached ? 'pending' : 'off');
      }
      markEnabled(consent.enabled);
      if (!consent.enabled) return setStatus('off');
      await run(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, signedIn, userId, markEnabled, run]);

  // Local changes: push after a pause, so a slider drag is one request.
  useEffect(() => {
    const onLocalChange = () => {
      if (!enabledRef.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void run(false);
      }, PUSH_DEBOUNCE_MS);
    };
    const onOnline = () => {
      if (enabledRef.current) void run(true);
    };
    window.addEventListener(SETTINGS_LOCAL_CHANGE_EVENT, onLocalChange);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(SETTINGS_LOCAL_CHANGE_EVENT, onLocalChange);
      window.removeEventListener('online', onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      const previous = enabledRef.current;
      // The switch follows the tap at once and returns if the API refuses.
      setEnabledState(next);
      setBusy(true);
      setConsentError(false);
      try {
        const saved = await saveSettingsSyncConsent(next);
        if (!saved) {
          setEnabledState(previous);
          setConsentError(true);
          return;
        }
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        // Turning sync on starts from the server's copy (version 0 when none).
        markEnabled(next, 0);
        if (next) {
          await run(true);
        } else {
          setStatus('off');
        }
      } finally {
        setBusy(false);
      }
    },
    [markEnabled, run],
  );

  return { status, enabled, signedIn, busy, consentError, setEnabled };
}
