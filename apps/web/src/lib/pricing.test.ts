import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCheckoutUrl,
  clinicListMonthly,
  formatMxn,
  PRICING,
} from './pricing';

describe('pricing', () => {
  it('formats MXN without decimals', () => {
    assert.match(formatMxn(199), /199/);
  });

  it('computes clinic list price for minimum seats', () => {
    assert.equal(clinicListMonthly(), 1499 + 349 * 3);
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

  it('anchors family tier at Tulana recommendation', () => {
    assert.equal(PRICING.family.monthly, 199);
    assert.equal(PRICING.family.annual, 1899);
  });
});
