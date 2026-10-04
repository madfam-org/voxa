import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gateDecision, stripLocalePrefix } from './route-gate';

describe('sign-in gate', () => {
  it('sends /app and the editor to sign-in without a valid session', () => {
    for (const pathname of ['/app', '/app/edit']) {
      assert.equal(gateDecision({ pathname, authConfigured: true, hasValidSession: false }), 'signin');
      assert.equal(gateDecision({ pathname, authConfigured: true, hasValidSession: true }), 'allow');
    }
  });

  it('leaves public pages open', () => {
    for (const pathname of ['/', '/demo', '/legal/privacy', '/auth/signin']) {
      assert.equal(gateDecision({ pathname, authConfigured: true, hasValidSession: false }), 'allow');
    }
  });

  it('strips the locale prefix', () => {
    assert.equal(stripLocalePrefix('/en/app/edit', ['es', 'en', 'fr']), '/app/edit');
    assert.equal(stripLocalePrefix('/fr', ['es', 'en', 'fr']), '/');
  });
});
