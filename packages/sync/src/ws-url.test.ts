import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBoardSyncWsUrl } from './ws-url.js';

describe('buildBoardSyncWsUrl', () => {
  it('builds a ws url with board id only', () => {
    assert.equal(
      buildBoardSyncWsUrl('https://api.example.test', 'demo-core'),
      'wss://api.example.test/v1/ws?boardId=demo-core',
    );
  });

  it('carries a single-use ticket, never an access token', () => {
    const url = buildBoardSyncWsUrl('http://localhost:4000/', 'board-1', 'tkt_abc');
    assert.match(url, /^ws:\/\/localhost:4000\/v1\/ws\?/);
    assert.match(url, /boardId=board-1/);
    assert.match(url, /ticket=tkt_abc/);
    assert.doesNotMatch(url, /accessToken/);
  });
});
