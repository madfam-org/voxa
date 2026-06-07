import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasFeature, maxBoardCount, resolveEntitlement } from './dhanam.js';

describe('dhanam entitlements', () => {
  it('defaults to free tier without Dhanam configured', async () => {
    const entitlement = await resolveEntitlement('user-1');
    assert.equal(entitlement.tier, 'free');
    assert.equal(entitlement.source, 'default');
    assert.ok(hasFeature(entitlement, 'sync'));
    assert.ok(hasFeature(entitlement, 'ai:basic'));
  });

  it('limits board count by tier', async () => {
    const free = await resolveEntitlement('user-1');
    assert.equal(maxBoardCount(free), 1);
  });
});
