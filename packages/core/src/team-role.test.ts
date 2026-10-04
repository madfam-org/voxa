import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapTeamRoleFromClaims } from './team-role.js';

describe('mapTeamRoleFromClaims', () => {
  it('maps namespaced Voxa application roles', () => {
    assert.equal(mapTeamRoleFromClaims({ roles: ['voxa:admin'] }), 'admin');
    assert.equal(mapTeamRoleFromClaims({ roles: ['voxa:editor'] }), 'editor');
    assert.equal(mapTeamRoleFromClaims({ roles: ['voxa:slp'] }), 'editor');
    assert.equal(mapTeamRoleFromClaims({ roles: ['admin', 'voxa:slp'] }), 'editor');
  });

  it('ignores non-namespaced organization roles in `roles`', () => {
    for (const role of ['admin', 'owner', 'member', 'employee', 'editor', 'slp']) {
      assert.equal(mapTeamRoleFromClaims({ roles: [role] }), 'communicator', role);
    }
  });

  it('ignores `role`, `voxa_role` and `madfam_org_roles`', () => {
    assert.equal(mapTeamRoleFromClaims({ role: 'admin' }), 'communicator');
    assert.equal(mapTeamRoleFromClaims({ voxa_role: 'slp' }), 'communicator');
    assert.equal(mapTeamRoleFromClaims({ madfam_org_roles: ['admin'] }), 'communicator');
  });

  it('ignores roles of other applications and malformed entries', () => {
    assert.equal(mapTeamRoleFromClaims({ roles: ['hcm:admin', 'kalya:manage'] }), 'communicator');
    assert.equal(mapTeamRoleFromClaims({ roles: ['voxa:admin:x', 'xvoxa:admin'] }), 'communicator');
    assert.equal(mapTeamRoleFromClaims({ roles: 'voxa:admin' }), 'communicator');
    assert.equal(mapTeamRoleFromClaims({ roles: [42, null] }), 'communicator');
  });

  it('defaults to communicator', () => {
    assert.equal(mapTeamRoleFromClaims({}), 'communicator');
  });
});
