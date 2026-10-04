import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { offlineCacheUrls } from './offline-cache-urls.js';

const ORIGIN = 'https://voxa.example.test';

describe('offlineCacheUrls', () => {
  it('keeps the app shell page and same-origin build assets and pictograms', () => {
    const urls = offlineCacheUrls(`${ORIGIN}/en/app?x=1`, [
      `${ORIGIN}/_next/static/chunks/main-abc.js`,
      `${ORIGIN}/_next/static/css/app.css`,
      `${ORIGIN}/symbols/mulberry/EN/want.svg`,
      `${ORIGIN}/icons/icon.svg`,
      `${ORIGIN}/manifest.webmanifest`,
    ]);
    assert.deepEqual(urls, [
      `${ORIGIN}/en/app`,
      `${ORIGIN}/_next/static/chunks/main-abc.js`,
      `${ORIGIN}/_next/static/css/app.css`,
      `${ORIGIN}/symbols/mulberry/EN/want.svg`,
      `${ORIGIN}/icons/icon.svg`,
      `${ORIGIN}/manifest.webmanifest`,
    ]);
  });

  it('never includes session or media answers, or other origins', () => {
    const urls = offlineCacheUrls(`${ORIGIN}/app`, [
      `${ORIGIN}/api/auth/session`,
      `${ORIGIN}/api/media/3f1c2a9e-7b4d-4c1e-9a8f-0d2b6e5c4a31`,
      'https://voxa-api.example.test/v1/boards/demo-core',
      'https://cdn.example.test/_next/static/chunks/x.js',
    ]);
    assert.deepEqual(urls, [`${ORIGIN}/app`]);
  });

  it('does not treat other pages as the app shell', () => {
    assert.deepEqual(offlineCacheUrls(`${ORIGIN}/demo`, []), []);
    assert.deepEqual(offlineCacheUrls(`${ORIGIN}/fr/app/edit`, []), [`${ORIGIN}/fr/app/edit`]);
  });
});
