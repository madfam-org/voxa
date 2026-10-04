import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clinicListMonthly,
  clinicListMonthlyGross,
  formatMxn,
  formatMxnGross,
  DISCOVERY_CALL_URL,
  PRICING,
  withMxnIva,
} from './pricing';

describe('pricing', () => {
  it('formats MXN without decimals', () => {
    assert.match(formatMxn(231), /231/);
  });

  // MADFAM MX convention: IVA-inclusive display prices are ceiled to whole
  // pesos, never rounded, so the displayed price is never under the amount
  // actually charged. 2546 * 1.16 = 2953.36 -> 2954 (ceil), not 2953 (round).
  it('adds 16% IVA for consumer display', () => {
    assert.equal(withMxnIva(199), 231);
    assert.equal(withMxnIva(1899), 2203);
    assert.equal(withMxnIva(2546), 2954);
  });

  it('ceils IVA-inclusive display rather than rounding down', () => {
    // Guards the ceil convention: a fractional remainder must round up.
    assert.equal(withMxnIva(100), 116);
    assert.equal(withMxnIva(101), 118); // 117.16 -> 118
  });

  it('formatMxnGross applies IVA before formatting', () => {
    assert.match(formatMxnGross(PRICING.family.monthly), /231/);
  });

  it('computes clinic list price for minimum seats (net and gross)', () => {
    assert.equal(clinicListMonthly(), 1499 + 349 * 3);
    // 2546 net * 1.16 = 2953.36, ceiled to whole pesos.
    assert.equal(clinicListMonthlyGross(), 2954);
  });

  // IVA-inclusive ceil rule (MXN): gross = ceil(net × 1.16) on the whole
  // net total. Expected values are written out, not recomputed, so a change
  // to the rule or to the list prices has to change this table too.
  it('institutional totals for 3–10 seats follow the ceil rule on the whole total', () => {
    // [seats, net, gross]
    const expected: Array<[number, number, number]> = [
      [3, 2546, 2954],
      [4, 2895, 3359],
      [5, 3244, 3764],
      [6, 3593, 4168],
      [7, 3942, 4573],
      [8, 4291, 4978],
      [9, 4640, 5383],
      [10, 4989, 5788],
    ];
    assert.deepEqual(
      expected.map(([seats]) => seats),
      [3, 4, 5, 6, 7, 8, 9, 10],
    );
    for (const [seats, net, gross] of expected) {
      assert.equal(clinicListMonthly(seats), net, `net @ ${seats} seats`);
      assert.equal(clinicListMonthlyGross(seats), gross, `gross @ ${seats} seats`);
      // Integer form of the rule: smallest whole peso >= net × 116 / 100.
      assert.equal(gross, Math.ceil((net * 116) / 100));
    }
    // Adding separately ceiled parts (1,739 + 405 × seats) overstates 6+ seats.
    assert.notEqual(clinicListMonthlyGross(6), withMxnIva(1499) + withMxnIva(349) * 6);
  });

  it('rejects seat counts below the minimum', () => {
    assert.throws(() => clinicListMonthly(2), RangeError);
    assert.throws(() => clinicListMonthlyGross(3.5), RangeError);
  });

  it('ceil never tips an exact peso up', () => {
    assert.equal(withMxnIva(2500), 2900);
    assert.equal(withMxnIva(25), 29);
  });

  it('paid-plan calls to action go to the discovery call (no checkout yet)', () => {
    assert.equal(DISCOVERY_CALL_URL, 'https://kalya.app/madfam');
  });

  it('anchors family tier at Tulana recommendation (net catalog)', () => {
    assert.equal(PRICING.family.monthly, 199);
    assert.equal(PRICING.family.annual, 1899);
  });
});
