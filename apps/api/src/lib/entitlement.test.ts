import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasFeature,
  maxBoardCount,
  resolveEntitlement,
  resolveTierClaim,
  TIER_FEATURES,
} from './entitlement.js';

function capture() {
  const lines: string[] = [];
  return { lines, log: (message: string) => lines.push(message) };
}

describe('entitlement from the voxa_tier claim', () => {
  it('accepts exactly free, family and clinic', () => {
    assert.deepEqual(resolveTierClaim('free'), { tier: 'free' });
    assert.deepEqual(resolveTierClaim('family'), { tier: 'family' });
    assert.deepEqual(resolveTierClaim('clinic'), { tier: 'clinic' });
  });

  it('fails safe to free for missing, malformed, unknown and plan-id claims', () => {
    assert.deepEqual(resolveTierClaim(undefined), { tier: 'free', fallback: 'absent' });
    assert.deepEqual(resolveTierClaim(null), { tier: 'free', fallback: 'absent' });
    assert.deepEqual(resolveTierClaim(['clinic']), { tier: 'free', fallback: 'malformed' });
    assert.deepEqual(resolveTierClaim(3), { tier: 'free', fallback: 'malformed' });
    assert.deepEqual(resolveTierClaim('enterprise'), { tier: 'free', fallback: 'unknown' });
    assert.deepEqual(resolveTierClaim('Clinic'), { tier: 'free', fallback: 'unknown' });
    assert.deepEqual(resolveTierClaim(' family'), { tier: 'free', fallback: 'unknown' });
    assert.deepEqual(resolveTierClaim('voxa__family'), { tier: 'free', fallback: 'plan-id' });
  });

  it('logs one line on fallback, without the claim value', () => {
    const { lines, log } = capture();
    const entitlement = resolveEntitlement({ tierClaim: 'secret-looking-value' }, log);
    assert.equal(entitlement.tier, 'free');
    assert.equal(lines.length, 1);
    assert.ok(!lines[0]!.includes('secret-looking-value'));
    assert.match(lines[0]!, /resolved to free/);
  });

  it('logs nothing for a valid claim', () => {
    const { lines, log } = capture();
    const entitlement = resolveEntitlement({ tierClaim: 'family' }, log);
    assert.deepEqual(entitlement, {
      tier: 'family',
      features: [...TIER_FEATURES.family],
      source: 'janua',
    });
    assert.deepEqual(lines, []);
  });

  it('keeps the free tier limits: one board, sync, OBF, basic AI', () => {
    const free = resolveEntitlement({}, () => undefined);
    assert.equal(maxBoardCount(free), 1);
    assert.ok(hasFeature(free, 'sync'));
    assert.ok(hasFeature(free, 'obf'));
    assert.ok(hasFeature(free, 'ai:basic'));
    assert.ok(!hasFeature(free, 'ai:full'));
    assert.ok(!hasFeature(free, 'reports'));
  });

  it('maps family and clinic to the catalog limits', () => {
    const family = resolveEntitlement({ tierClaim: 'family' });
    assert.equal(maxBoardCount(family), 10);
    assert.ok(hasFeature(family, 'team:3'));
    assert.ok(!hasFeature(family, 'ai:full'));

    const clinic = resolveEntitlement({ tierClaim: 'clinic' });
    assert.equal(maxBoardCount(clinic), Number.POSITIVE_INFINITY);
    assert.ok(hasFeature(clinic, 'ai:full'));
    assert.ok(hasFeature(clinic, 'team:50'));
    assert.ok(hasFeature(clinic, 'reports'));
  });

  it('hands out a copy of the feature list', () => {
    const one = resolveEntitlement({ tierClaim: 'clinic' });
    one.features.push('boards:1');
    assert.ok(!TIER_FEATURES.clinic.includes('boards:1'));
  });
});
