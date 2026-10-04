import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSha } from './build-info';

describe('buildSha', () => {
  it('serves a full commit id', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    assert.equal(buildSha({ GIT_SHA: sha }), sha);
  });

  it('normalizes case and whitespace', () => {
    assert.equal(buildSha({ GIT_SHA: '  ABCDEF1 \n' }), 'abcdef1');
  });

  it('answers unknown when unset, empty or not a commit id', () => {
    assert.equal(buildSha({}), 'unknown');
    assert.equal(buildSha({ GIT_SHA: '' }), 'unknown');
    assert.equal(buildSha({ GIT_SHA: 'unknown' }), 'unknown');
    assert.equal(buildSha({ GIT_SHA: 'postgres://user:pw@host/db' }), 'unknown');
    assert.equal(buildSha({ GIT_SHA: 'abc12' }), 'unknown');
    assert.equal(buildSha({ GIT_SHA: 'a'.repeat(41) }), 'unknown');
  });
});
