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
  });

  it('gives an admin no access outside its own organization', () => {
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'admin'), false);
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'admin', 'org-a', 'org-b'), false);
    assert.equal(canEditBoard('my-board', 'user-a', 'user-b', 'admin', 'org-a', 'org-b'), false);
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'admin', 'org-a', undefined), false);
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'admin', undefined, 'org-b'), false);
    assert.equal(canAccessBoard('my-board', 'user-a', 'user-b', 'admin', 'org-a', 'org-a'), true);
    assert.equal(canEditBoard('my-board', 'user-a', 'user-b', 'admin', 'org-a', 'org-a'), true);
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

  it('does not let communicators of the same org read or edit org boards', () => {
    assert.equal(
      canAccessBoard('clinic-board', 'patient-1', 'member-1', 'communicator', 'org-clinic', 'org-clinic'),
      false,
    );
    assert.equal(
      canEditBoard('clinic-board', 'patient-1', 'member-1', 'communicator', 'org-clinic', 'org-clinic'),
      false,
    );
  });

  it('lets the owner edit their own board whatever their role', () => {
    assert.equal(canEditBoard('my-board', 'user-a', 'user-a', 'communicator'), true);
    assert.equal(canEditBoard('my-board', 'user-a', 'user-b', 'communicator'), false);
    assert.equal(canEditBoard('my-board', 'user-a', 'user-b', 'editor'), false);
  });

  it('keeps the demo board read-only for every role', () => {
    for (const role of ['communicator', 'editor', 'admin'] as const) {
      assert.equal(canEditBoard('demo-core', undefined, 'user-a', role), false, role);
      assert.equal(canEditBoard('demo-core', 'user-a', 'user-a', role, 'org-a', 'org-a'), false, role);
    }
  });
});
