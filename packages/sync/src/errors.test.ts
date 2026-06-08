import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isVersionConflictError, VoxaSyncError } from './errors.js';

describe('VoxaSyncError', () => {
  it('detects version conflict errors', () => {
    assert.equal(isVersionConflictError(new VoxaSyncError('Board version conflict', 409)), true);
    assert.equal(isVersionConflictError(new VoxaSyncError('Forbidden', 403)), false);
    assert.equal(isVersionConflictError(new Error('Board version conflict')), false);
  });
});
