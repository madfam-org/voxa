'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_COMMUNICATOR_SETTINGS,
  loadCommunicatorSettings,
  saveCommunicatorSettings,
  type CommunicatorSettings,
} from '@/lib/communicator-settings';
import {
  readSyncState,
  SETTINGS_LOCAL_CHANGE_EVENT,
  stampChangedFields,
  writeSyncState,
} from '@/lib/settings-sync';

export function useCommunicatorSettings() {
  const [settings, setSettingsState] = useState<CommunicatorSettings>(DEFAULT_COMMUNICATOR_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettingsState(loadCommunicatorSettings());
    setLoaded(true);
  }, []);

  /** A change made on this device: saved locally, and its synced fields are time-stamped. */
  const setSettings = useCallback((patch: Partial<CommunicatorSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveCommunicatorSettings(next);
      const state = readSyncState();
      const fieldTimes = stampChangedFields(prev, next, state.fieldTimes, new Date().toISOString());
      if (fieldTimes) {
        writeSyncState({ fieldTimes, dirty: true });
        queueMicrotask(() => window.dispatchEvent(new Event(SETTINGS_LOCAL_CHANGE_EVENT)));
      }
      return next;
    });
  }, []);

  /** Values that came from the user's server copy: saved locally, not stamped as local changes. */
  const applyRemoteSettings = useCallback((patch: Partial<CommunicatorSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveCommunicatorSettings(next);
      return next;
    });
  }, []);

  return { settings, setSettings, applyRemoteSettings, loaded };
}
