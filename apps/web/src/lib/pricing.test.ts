import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCheckoutUrl,
  clinicListMonthly,
  clinicListMonthlyGross,
  formatMxn,
  formatMxnGross,
  PRICING,
  withMxnIva,
} from './pricing';

describe('pricing', () => {
  it('formats MXN without decimals', () => {
    assert.match(formatMxn(231), /231/);
  });

  it('adds 16% IVA for consumer display', () => {
    assert.equal(withMxnIva(199), 231);
    assert.equal(withMxnIva(1899), 2203);
    assert.equal(withMxnIva(2546), 2953);
  });

  it('formatMxnGross applies IVA before formatting', () => {
    assert.match(formatMxnGross(PRICING.family.monthly), /231/);
  });

  it('computes clinic list price for minimum seats (net and gross)', () => {
    assert.equal(clinicListMonthly(), 1499 + 349 * 3);
    assert.equal(clinicListMonthlyGross(), 2953);
  });

  it('builds Dhanam checkout URL with product slug', () => {
    const url = buildCheckoutUrl({
      plan: 'voxa_family',
      userId: '00000000-0000-4000-8000-000000000001',
      returnUrl: 'https://voxa.madfam.io/app',
    });
    assert.match(url, /^https:\/\/api\.dhan\.am\/billing\/checkout\?/);
    assert.match(url, /plan=voxa_family/);
    assert.match(url, /product=voxa/);
  });

  it('anchors family tier at Tulana recommendation (net catalog)', () => {
    assert.equal(PRICING.family.monthly, 199);
    assert.equal(PRICING.family.annual, 1899);
  });
});
