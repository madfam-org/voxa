import { Hono } from 'hono';
import {
  CONSENT_POLICY_VERSION,
  CONSENT_PURPOSES,
  isConsentPurpose,
  listConsents,
  orgHasUtteranceTextDpa,
  setConsents,
  type ConsentPurpose,
  type ConsentRecord,
} from '../lib/consents.js';

/**
 * The signed-in user's own consent records. There is no way to read or change
 * anyone else's: the user id always comes from the verified token.
 */
export const consentRoutes = new Hono();

function view(records: ConsentRecord[], orgId: string | undefined) {
  return {
    policyVersion: CONSENT_POLICY_VERSION,
    purposes: CONSENT_PURPOSES,
    consents: records,
    // utterance_text may be recorded by anyone but is honoured only for an
    // organization with a DPA on the server-side allow-list.
    utteranceTextAvailable: orgHasUtteranceTextDpa(orgId),
  };
}

consentRoutes.get('/', async (c) => {
  const { userId, orgId } = c.get('team');
  const records = await listConsents(process.env.DATABASE_URL, userId);
  return c.json(view(records, orgId));
});

consentRoutes.put('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'JSON body required' }, 400);
  }
  const input = (body as { consents?: unknown } | null)?.consents;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return c.json({ error: 'Body must be { "consents": { "<purpose>": true|false } }' }, 400);
  }

  const decisions: Partial<Record<ConsentPurpose, boolean>> = {};
  for (const [purpose, granted] of Object.entries(input as Record<string, unknown>)) {
    if (!isConsentPurpose(purpose)) {
      return c.json({ error: `Unknown purpose: ${purpose}`, purposes: CONSENT_PURPOSES }, 400);
    }
    if (typeof granted !== 'boolean') {
      return c.json({ error: `Consent for ${purpose} must be true or false` }, 400);
    }
    decisions[purpose] = granted;
  }
  if (Object.keys(decisions).length === 0) {
    return c.json({ error: 'At least one purpose is required' }, 400);
  }

  const { userId, orgId } = c.get('team');
  const records = await setConsents(process.env.DATABASE_URL, userId, decisions);
  return c.json(view(records, orgId));
});
