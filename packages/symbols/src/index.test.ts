import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arasaacImageUrl, searchArasaac } from './arasaac.js';

describe('@voxa/symbols', () => {
  it('builds ARASAAC image URLs', () => {
    assert.equal(arasaacImageUrl(6456), 'https://static.arasaac.org/pictograms/6456/6456_300.png');
    assert.equal(arasaacImageUrl(6456, 500), 'https://static.arasaac.org/pictograms/6456/6456_500.png');
  });

  it('maps ARASAAC search results', async () => {
    const hits = await searchArasaac('eat', {
      limit: 2,
      fetchImpl: async () =>
        new Response(
          JSON.stringify([
            { _id: 6456, keywords: [{ keyword: 'eat' }], tags: ['verb', 'food'] },
            { _id: 123, keywords: [{ keyword: 'dinner' }], tags: ['noun'] },
            { _id: 999, keywords: [{ keyword: 'ignored' }], tags: [] },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.id, 6456);
    assert.equal(hits[0]?.keyword, 'eat');
    assert.equal(hits[0]?.source, 'arasaac');
    assert.match(hits[0]?.imageUrl ?? '', /6456_300\.png$/);
  });

  it('returns empty for short queries', async () => {
    const hits = await searchArasaac('a');
    assert.deepEqual(hits, []);
  });
});
