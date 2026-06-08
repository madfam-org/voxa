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

  it('allows org editors to access org boards remotely', () => {
    assert.equal(
      canAccessBoard('clinic-board', 'patient-1', 'slp-1', 'editor', 'org-clinic', 'org-clinic'),
      true,
    );
    assert.equal(
      canEditBoard('clinic-board', 'patient-1', 'slp-1', 'editor', 'org-clinic', 'org-clinic'),
      true,
    );
    assert.equal(
      canAccessBoard('clinic-board', 'patient-1', 'slp-1', 'editor', 'org-clinic', 'org-other'),
      false,
    );
  });

  it('requires editor role to edit', () => {
    assert.equal(canEditBoard('demo-core', undefined, 'user-a', 'communicator'), false);
    assert.equal(canEditBoard('demo-core', undefined, 'user-a', 'editor'), true);
    assert.equal(canEditBoard('my-board', 'user-a', 'user-b', 'editor'), false);
  });
});
