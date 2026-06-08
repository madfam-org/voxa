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
    const body = (await entitlement.json()) as { entitlement?: { tier?: string } };
    expect(body.entitlement?.tier).toBeTruthy();
  });

  test('AI routes require consent header', async ({ request }) => {
    const blocked = await request.post(`${apiBase}/v1/ai/predict/text`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        profileId: 'soak',
        recentUtterances: [],
        partialText: 'I want',
        locale: 'en-US',
      },
    });
    expect(blocked.status()).toBe(403);

    const allowed = await request.post(`${apiBase}/v1/ai/predict/text`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Voxa-AI-Consent': 'true',
      },
      data: {
        profileId: 'soak',
        recentUtterances: [],
        partialText: 'I want',
        locale: 'en-US',
      },
    });
    expect([200, 402]).toContain(allowed.status());
  });
});
