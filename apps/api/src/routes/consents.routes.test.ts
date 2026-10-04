import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import {
  CONSENT_POLICY_VERSION,
  consentStorePath,
  fileConsentEventsForTests,
  utteranceTextDpaOrgIds,
} from '../lib/consents.js';
import { devHeaders } from '../test-support/boards.js';
import { startTestTokenIssuer, type TestTokenIssuer } from '../test-support/janua-tokens.js';

interface ConsentView {
  policyVersion: string;
  purposes: string[];
  consents: Array<{
    purpose: string;
    granted: boolean;
    policyVersion: string;
    grantedAt: string | null;
    revokedAt: string | null;
  }>;
  utteranceTextAvailable: boolean;
}

function getConsents(headers: Record<string, string>) {
  return app.request('/v1/consents', { headers });
}

function putConsents(headers: Record<string, string>, body: unknown) {
  return app.request('/v1/consents', {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('consent routes (file store)', () => {
  let issuer: TestTokenIssuer;

  before(async () => {
    issuer = await startTestTokenIssuer();
  });

  after(async () => {
    await issuer.close();
  });

  beforeEach(() => {
    rmSync(consentStorePath(), { force: true });
    delete process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS;
  });

  it('starts undecided: no records, and utterance text is not available', async () => {
    const res = await getConsents(devHeaders('user-1'));
    assert.equal(res.status, 200);
    const body = (await res.json()) as ConsentView;
    assert.equal(body.policyVersion, CONSENT_POLICY_VERSION);
    assert.deepEqual(body.purposes, ['ai_processing', 'usage_analytics', 'utterance_text']);
    assert.deepEqual(body.consents, []);
    assert.equal(body.utteranceTextAvailable, false);
  });

  it('records grants and revocations with timestamps and an audit event per change', async () => {
    const granted = await putConsents(devHeaders('user-1'), {
      consents: { ai_processing: true, usage_analytics: false },
    });
    assert.equal(granted.status, 200);
    const view = (await granted.json()) as ConsentView;
    const ai = view.consents.find((c) => c.purpose === 'ai_processing');
    const usage = view.consents.find((c) => c.purpose === 'usage_analytics');
    assert.equal(ai?.granted, true);
    assert.equal(ai?.policyVersion, CONSENT_POLICY_VERSION);
    assert.ok(ai?.grantedAt);
    assert.equal(ai?.revokedAt, null);
    assert.equal(usage?.granted, false);
    assert.ok(usage?.revokedAt);
    assert.equal(fileConsentEventsForTests().length, 2);
    assert.ok(existsSync(consentStorePath()));

    // Re-sending the same decision is not a change and adds no audit event.
    await putConsents(devHeaders('user-1'), { consents: { ai_processing: true } });
    assert.equal(fileConsentEventsForTests().length, 2);

    const revoked = (await (
      await putConsents(devHeaders('user-1'), { consents: { ai_processing: false } })
    ).json()) as ConsentView;
    const aiAfter = revoked.consents.find((c) => c.purpose === 'ai_processing');
    assert.equal(aiAfter?.granted, false);
    assert.ok(aiAfter?.revokedAt);
    assert.equal(aiAfter?.grantedAt, ai?.grantedAt, 'the last grant time is kept for the record');
    const events = fileConsentEventsForTests();
    assert.equal(events.length, 3);
    assert.deepEqual(
      events.map((e) => [e.userId, e.purpose, e.granted]),
      [
        ['user-1', 'ai_processing', true],
        ['user-1', 'usage_analytics', false],
        ['user-1', 'ai_processing', false],
      ],
    );
  });

  it('is self-only: one user never sees or changes another user’s records', async () => {
    await putConsents(devHeaders('user-1'), { consents: { ai_processing: true } });
    const other = (await (await getConsents(devHeaders('user-2', 'admin'))).json()) as ConsentView;
    assert.deepEqual(other.consents, []);
    // A userId in the body is ignored: the record always belongs to the caller.
    await putConsents(devHeaders('user-2'), {
      userId: 'user-1',
      consents: { ai_processing: false },
    });
    const mine = (await (await getConsents(devHeaders('user-1'))).json()) as ConsentView;
    assert.equal(mine.consents.find((c) => c.purpose === 'ai_processing')?.granted, true);
  });

  it('rejects malformed bodies', async () => {
    assert.equal((await putConsents(devHeaders('user-1'), {})).status, 400);
    assert.equal((await putConsents(devHeaders('user-1'), { consents: [] })).status, 400);
    assert.equal((await putConsents(devHeaders('user-1'), { consents: {} })).status, 400);
    assert.equal(
      (await putConsents(devHeaders('user-1'), { consents: { marketing: true } })).status,
      400,
    );
    assert.equal(
      (await putConsents(devHeaders('user-1'), { consents: { ai_processing: 'yes' } })).status,
      400,
    );
    const raw = await app.request('/v1/consents', {
      method: 'PUT',
      headers: { ...devHeaders('user-1'), 'Content-Type': 'application/json' },
      body: '{not json',
    });
    assert.equal(raw.status, 400);
    assert.equal(fileConsentEventsForTests().length, 0);
  });

  it('reports utterance text as available only for an organization on the DPA allow-list', async () => {
    assert.equal(utteranceTextDpaOrgIds('').size, 0);
    assert.deepEqual([...utteranceTextDpaOrgIds(' org-a, ,org-b ')], ['org-a', 'org-b']);

    const listed = await issuer.bearer({ sub: 'clin-1', roles: [], org_id: 'org-dpa' });
    const unlisted = await issuer.bearer({ sub: 'clin-2', roles: [], org_id: 'org-other' });
    assert.equal(
      ((await (await getConsents(listed)).json()) as ConsentView).utteranceTextAvailable,
      false,
    );

    process.env.VOXA_UTTERANCE_TEXT_DPA_ORG_IDS = 'org-dpa';
    assert.equal(
      ((await (await getConsents(listed)).json()) as ConsentView).utteranceTextAvailable,
      true,
    );
    assert.equal(
      ((await (await getConsents(unlisted)).json()) as ConsentView).utteranceTextAvailable,
      false,
    );
  });

  it('requires authentication', async () => {
    const previous = process.env.VOXA_DEV_AUTH;
    process.env.VOXA_DEV_AUTH = 'false';
    try {
      assert.equal((await getConsents({})).status, 401);
    } finally {
      process.env.VOXA_DEV_AUTH = previous;
    }
  });
});
