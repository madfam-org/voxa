import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VoxaSyncError } from '@voxa/sync';
import { classifySaveFailure } from './save-errors';

describe('classifySaveFailure', () => {
  it('a 422 motor-plan violation is never retried', () => {
    assert.equal(classifySaveFailure(new VoxaSyncError('Motor planning violation', 422)), 'motor-plan');
  });

  it('network errors and transient answers are retried', () => {
    assert.equal(classifySaveFailure(new TypeError('Failed to fetch')), 'retry');
    for (const status of [401, 408, 429, 500, 502, 503]) {
      assert.equal(classifySaveFailure(new VoxaSyncError('x', status)), 'retry', String(status));
    }
  });

  it('other refusals are not retried', () => {
    for (const status of [400, 403, 404, 413]) {
      assert.equal(classifySaveFailure(new VoxaSyncError('x', status)), 'rejected', String(status));
    }
  });
});
