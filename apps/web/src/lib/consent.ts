/**
 * Client side of Voxa's consent records.
 *
 * The record of truth is the API (`GET/PUT /v1/consents`), per signed-in user
 * and purpose; the API enforces it. This module keeps a copy in localStorage
 * only as an offline cache, so the app knows what to send (or not) before the
 * API answers, and so a signed-out visitor's choice applies on this device.
 * When nothing is decided, nothing is sent.
 */

import { apiFetch } from './api-client';

export const CONSENT_CACHE_KEY = 'voxa-consent';
/** Pre-2026-10 single "AI consent" flag. It is not a valid consent for either purpose now. */
export const LEGACY_CONSENT_KEY = 'voxa-ai-consent';
export const CONSENT_CHANGE_EVENT = 'voxa-consent-change';


export interface ConsentChoices {
  /** `ai_processing`: word and symbol suggestions computed by the API. */
  aiProcessing: boolean;
  /** `usage_analytics`: button-press counts, never the text. */
  usageAnalytics: boolean;
}

export interface ConsentCache {
  choices: ConsentChoices;
  /** True only when the API reports `utterance_text` granted AND available for the user's organization. */
  utteranceText: boolean;
  /** `server`: copied from the user's record. `local`: a signed-out choice on this device. */
  source: 'server' | 'local';
  decidedAt: string;
}

export interface ServerConsentView {
  policyVersion: string;
  consents: Array<{ purpose: string; granted: boolean }>;
  utteranceTextAvailable: boolean;
}

export function parseConsentCache(raw: string | null): ConsentCache | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ConsentCache> | null;
    const choices = value?.choices;
    if (
      !value ||
      !choices ||
      typeof choices.aiProcessing !== 'boolean' ||
      typeof choices.usageAnalytics !== 'boolean' ||
      (value.source !== 'server' && value.source !== 'local')
    ) {
      return null;
    }
    return {
      choices: { aiProcessing: choices.aiProcessing, usageAnalytics: choices.usageAnalytics },
      utteranceText: value.utteranceText === true,
      source: value.source,
      decidedAt: typeof value.decidedAt === 'string' ? value.decidedAt : '',
    };
  } catch {
    return null;
  }
}

/**
 * The user's decision as the API holds it. `decided` is false until both
 * purposes the app asks about have a record.
 */
export function decisionFromServer(view: ServerConsentView): {
  decided: boolean;
  choices: ConsentChoices;
  utteranceText: boolean;
} {
  const byPurpose = new Map(view.consents.map((c) => [c.purpose, c.granted]));
  return {
    decided: byPurpose.has('ai_processing') && byPurpose.has('usage_analytics'),
    choices: {
      aiProcessing: byPurpose.get('ai_processing') === true,
      usageAnalytics: byPurpose.get('usage_analytics') === true,
    },
    utteranceText: view.utteranceTextAvailable && byPurpose.get('utterance_text') === true,
  };
}

export function readConsentCache(): ConsentCache | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseConsentCache(window.localStorage.getItem(CONSENT_CACHE_KEY));
  } catch {
    return null;
  }
}

export function writeConsentCache(cache: ConsentCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_CACHE_KEY, JSON.stringify(cache));
    window.localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* storage unavailable: the API record still applies */
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

export function getAiConsent(): boolean {
  return readConsentCache()?.choices.aiProcessing === true;
}

export function getUsageConsent(): boolean {
  return readConsentCache()?.choices.usageAnalytics === true;
}

export function getUtteranceTextConsent(): boolean {
  return readConsentCache()?.utteranceText === true;
}

/** The signed-in user's records, or null when the API cannot be reached. */
export async function fetchServerConsents(): Promise<ServerConsentView | null> {
  try {
    const res = await apiFetch('/v1/consents');
    if (!res.ok) return null;
    return (await res.json()) as ServerConsentView;
  } catch {
    return null;
  }
}

/** Saves both choices to the API. Throws when the API does not confirm. */
export async function saveServerConsents(choices: ConsentChoices): Promise<ServerConsentView> {
  const res = await apiFetch('/v1/consents', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consents: { ai_processing: choices.aiProcessing, usage_analytics: choices.usageAnalytics },
    }),
  });
  if (!res.ok) throw new Error(`Saving consent failed (${res.status})`);
  return (await res.json()) as ServerConsentView;
}

/**
 * Records the choices: on the API when signed in (and caches its answer), or
 * on this device only when signed out. Throws when a signed-in save fails, so
 * the caller can say so instead of pretending it worked.
 */
export async function recordConsentChoices(
  signedIn: boolean,
  choices: ConsentChoices,
): Promise<ConsentCache> {
  let cache: ConsentCache;
  if (signedIn) {
    const view = await saveServerConsents(choices);
    const decision = decisionFromServer(view);
    cache = {
      choices: decision.choices,
      utteranceText: decision.utteranceText,
      source: 'server',
      decidedAt: new Date().toISOString(),
    };
  } else {
    cache = { choices, utteranceText: false, source: 'local', decidedAt: new Date().toISOString() };
  }
  writeConsentCache(cache);
  return cache;
}
