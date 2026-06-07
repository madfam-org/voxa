import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessBoard, canEditBoard } from './board-access.js';

describe('board access', () => {
  it('allows public demo board read', () => {
    assert.equal(canAccessBoard('demo-core', undefined, 'user-a', 'communicator'), true);
  });

  it('restricts private boards to owner', () => {
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-a', 'communicator'), true);
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'communicator'), false);
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'admin'), true);
  });

  it('requires editor role to edit', () => {
    assert.equal(canEditBoard('demo-core', undefined, 'user-a', 'communicator'), false);
    assert.equal(canEditBoard('demo-core', undefined, 'user-a', 'editor'), true);
    assert.equal(canEditBoard('my-board', 'user-a', 'user-b', 'editor'), false);
  });
});
