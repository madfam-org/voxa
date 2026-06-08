import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSessionExpired, isSessionExpiring } from './session-expiry.js';
import type { MobileSession } from './session.js';

function session(expiresAt: number, refreshToken?: string): MobileSession {
  return {
    accessToken: 'token',
    refreshToken,
    userId: 'user-1',
    expiresAt,
  };
}

describe('mobile session expiry', () => {
  it('treats sessions past expiresAt as expired', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    assert.equal(isSessionExpired(session(past)), true);
    assert.equal(isSessionExpiring(session(past)), true);
  });

  it('treats sessions within the refresh window as expiring', () => {
    const soon = Math.floor((Date.now() + 60_000) / 1000);
    assert.equal(isSessionExpired(session(soon)), false);
    assert.equal(isSessionExpiring(session(soon, 'refresh')), true);
  });
});
