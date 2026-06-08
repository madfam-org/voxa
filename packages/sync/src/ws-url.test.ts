import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBoardSyncWsUrl } from './ws-url.js';

describe('buildBoardSyncWsUrl', () => {
  it('builds a ws url with board id only', () => {
    assert.equal(
      buildBoardSyncWsUrl('https://voxa-api.madfam.io', 'demo-core'),
      'wss://voxa-api.madfam.io/v1/ws?boardId=demo-core',
    );
  });

  it('includes accessToken when provided', () => {
    const url = buildBoardSyncWsUrl('http://localhost:4000', 'board-1', 'jwt-token');
    assert.match(url, /^ws:\/\/localhost:4000\/v1\/ws\?/);
    assert.match(url, /boardId=board-1/);
    assert.match(url, /accessToken=jwt-token/);
  });
});
