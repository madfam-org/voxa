import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapJanuaRole } from './janua.js';

describe('mapJanuaRole', () => {
  it('maps admin roles', () => {
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['admin'] }), 'admin');
    assert.equal(mapJanuaRole({ sub: 'u1', role: 'admin' }), 'admin');
  });

  it('maps editor roles', () => {
    assert.equal(mapJanuaRole({ sub: 'u1', roles: ['editor'] }), 'editor');
    assert.equal(mapJanuaRole({ sub: 'u1', voxa_role: 'slp' }), 'editor');
  });

  it('defaults to communicator', () => {
    assert.equal(mapJanuaRole({ sub: 'u1' }), 'communicator');
  });
});
