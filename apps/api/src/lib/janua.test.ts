import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapJanuaRole } from './janua.js';

describe('mapJanuaRole', () => {
  it('maps namespaced Voxa application roles', () => {
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['voxa:admin'] }), 'admin');
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['voxa:editor'] }), 'editor');
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['voxa:slp'] }), 'editor');
  });

  it('ignores Janua organization roles and legacy role claims', () => {
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['admin'] }), 'communicator');
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['owner', 'editor', 'slp'] }), 'communicator');
    assert.equal(mapJanuaRole({ sub: 'u1', role: 'admin' }), 'communicator');
    assert.equal(mapJanuaRole({ sub: 'u1', voxa_role: 'slp' }), 'communicator');
    assert.equal(mapJanuaRole({ sub: 'u1', madfam_org_roles: ['admin'] }), 'communicator');
  });

  it('defaults to communicator', () => {
    assert.equal(mapJanuaRole({ sub: 'u1' }), 'communicator');
  });
});
