import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { displayMediaUrl, isValidMediaId, mediaIdFromApiUrl } from './media-url.js';

const API = 'https://voxa-api.example.test';
const ID = '3f1c2a9e-7b4d-4c1e-9a8f-0d2b6e5c4a31';

describe('media URLs for media elements', () => {
  it('maps API media URLs to the same-origin proxy', () => {
    assert.equal(displayMediaUrl(`${API}/v1/media/${ID}`, API), `/api/media/${ID}`);
    assert.equal(mediaIdFromApiUrl(`${API}/v1/media/${ID}`, `${API}/`), ID);
  });

  it('leaves pictograms, data URLs and other origins unchanged', () => {
    assert.equal(
      displayMediaUrl('/symbols/mulberry/EN/want.svg', API),
      '/symbols/mulberry/EN/want.svg',
    );
    assert.equal(displayMediaUrl('data:image/png;base64,AAAA', API), 'data:image/png;base64,AAAA');
    const foreign = `https://elsewhere.example.test/v1/media/${ID}`;
    assert.equal(displayMediaUrl(foreign, API), foreign);
    assert.equal(displayMediaUrl(undefined, API), undefined);
  });

  it('never maps a path that is not exactly one media id', () => {
    assert.equal(mediaIdFromApiUrl(`${API}/v1/media/${ID}/extra`, API), null);
    assert.equal(mediaIdFromApiUrl(`${API}/v1/media/..%2Fboards`, API), null);
    assert.equal(mediaIdFromApiUrl(`${API}/v1/boards/${ID}`, API), null);
    assert.equal(isValidMediaId('../boards'), false);
    assert.equal(isValidMediaId(ID), true);
  });
});
