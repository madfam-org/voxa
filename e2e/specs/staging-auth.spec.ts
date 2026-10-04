import { test, expect } from '@playwright/test';

const apiBase =
  process.env.VOXA_STAGING_API_URL ?? 'https://voxa-api-staging.madfam.io';
const accessToken = process.env.VOXA_TEST_ACCESS_TOKEN;

test.describe('Staging authenticated API soak', () => {
  test.skip(!accessToken, 'Requires VOXA_TEST_ACCESS_TOKEN (CI: e2e-smoke auth step)');

  test('session-backed API returns boards and entitlement', async ({ request }) => {
    const boards = await request.get(`${apiBase}/v1/boards`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(boards.status()).toBe(200);

    const entitlement = await request.get(`${apiBase}/v1/billing/entitlement`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(entitlement.status()).toBe(200);
    const body = (await entitlement.json()) as { tier?: string; source?: string };
    expect(body.tier).toBeTruthy();
    expect(body.source).toBe('janua');
  });

  test('AI routes follow the server-side ai_processing record, not a header', async ({ request }) => {
    const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    const predict = (extra: Record<string, string> = {}) =>
      request.post(`${apiBase}/v1/ai/predict/text`, {
        headers: { ...auth, ...extra },
        data: { profileId: 'soak', recentUtterances: [], partialText: 'I want', locale: 'en-US' },
      });
    const setConsent = (granted: boolean) =>
      request.put(`${apiBase}/v1/consents`, { headers: auth, data: { consents: { ai_processing: granted } } });

    expect((await setConsent(false)).status()).toBe(200);
    expect((await predict({ 'X-Voxa-AI-Consent': 'true' })).status()).toBe(403);

    expect((await setConsent(true)).status()).toBe(200);
    expect([200, 402]).toContain((await predict()).status());
  });
});
