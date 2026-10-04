import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_BOARD_ID } from '@voxa/core';
import {
  accountMayEditBoard,
  editorModeAllowed,
  initialBoardId,
  ownsBoard,
  remoteEditorRole,
  type EditorAccessInput,
} from './editor-access';

const familyUser = (boardId: string, boardOwnerUserId?: string): EditorAccessInput => ({
  boardId,
  boardOwnerUserId,
  isAuthenticated: true,
  sessionUserId: 'family-1',
  sessionTeamRole: 'communicator',
});

describe('editor access', () => {
  it('(8c) a user with no boards starts on demo-core with the editor disabled', () => {
    const boardId = initialBoardId(null);
    assert.equal(boardId, DEMO_BOARD_ID);
    assert.equal(initialBoardId(''), DEMO_BOARD_ID);

    const input = familyUser(boardId);
    assert.equal(editorModeAllowed(input), false);
    assert.equal(accountMayEditBoard(input), false);
    assert.equal(remoteEditorRole(input, true), 'communicator');
  });

  it('keeps the demo board read-only even for account editors and admins', () => {
    for (const sessionTeamRole of ['editor', 'admin'] as const) {
      const input = { ...familyUser(DEMO_BOARD_ID), sessionTeamRole };
      assert.equal(editorModeAllowed(input), false);
      assert.equal(accountMayEditBoard(input), false);
      assert.equal(remoteEditorRole(input, true), 'communicator');
    }
  });

  it('keeps a previously selected board', () => {
    assert.equal(initialBoardId('board-123'), 'board-123');
  });

  it('lets the signed-in owner edit their own board, behind the device PIN', () => {
    const input = familyUser('board-own', 'family-1');
    assert.equal(ownsBoard(input), true);
    assert.equal(accountMayEditBoard(input), true);
    assert.equal(remoteEditorRole(input, true), 'editor');
    assert.equal(remoteEditorRole(input, false), 'communicator');
  });

  it('does not let a communicator edit someone else’s board', () => {
    const input = familyUser('board-other', 'someone-else');
    assert.equal(ownsBoard(input), false);
    assert.equal(accountMayEditBoard(input), false);
    assert.equal(remoteEditorRole(input, true), 'communicator');
  });

  it('never treats a signed-out visitor as the owner', () => {
    const input = { ...familyUser('board-own', 'family-1'), isAuthenticated: false };
    assert.equal(ownsBoard(input), false);
    assert.equal(accountMayEditBoard(input), false);
  });

  it('gives account editors their account role on non-demo boards', () => {
    const input = { ...familyUser('board-org', 'patient-1'), sessionTeamRole: 'editor' as const };
    assert.equal(remoteEditorRole(input, false), 'editor');
    assert.equal(accountMayEditBoard(input), true);
  });
});
