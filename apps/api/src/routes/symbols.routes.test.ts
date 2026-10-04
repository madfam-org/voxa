import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import app from '../app.js';
import { createFileBoardStore } from '../store/file-board-store.js';
import { useTestStore } from '../store/index.js';

const EDITOR = { 'X-Voxa-User-Id': 'user-1', 'X-Voxa-Role': 'editor' };

interface SearchBody {
  symbols: { id: string; keyword: string; imageUrl: string; source: string; file: string }[];
  attribution: string;
  locale: string;
}

describe('symbol routes', () => {
  const realFetch = globalThis.fetch;
  let outbound: string[] = [];

  beforeEach(async () => {
    const store = createFileBoardStore();
    await store.resetStoreForTests?.();
    useTestStore(store);
    outbound = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      outbound.push(String(input instanceof Request ? input.url : input));
      throw new Error('symbol search must not make outbound requests');
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('is open to any signed-in role (board owners edit their own boards)', async () => {
    const res = await app.request('/v1/symbols/search?q=a', {
      headers: { 'X-Voxa-User-Id': 'user-1', 'X-Voxa-Role': 'communicator' },
    });
    assert.equal(res.status, 200);
  });

  it('returns empty results with the Mulberry credit for short queries', async () => {
    const res = await app.request('/v1/symbols/search?q=a', { headers: EDITOR });
    assert.equal(res.status, 200);
    const body = (await res.json()) as SearchBody;
    assert.deepEqual(body.symbols, []);
    assert.match(body.attribution, /Mulberry Symbols © Steve Lee/);
    assert.match(body.attribution, /CC BY-SA 4\.0/);
  });

  for (const [q, file] of [
    ['agua', 'EN/water.svg'],
    ['comer', 'EN/eat_,_to.svg'],
    ['ayuda', 'EN/help_,_to.svg'],
  ] as const) {
    it(`finds "${q}" in the vendored Mulberry set without network`, async () => {
      const res = await app.request(`/v1/symbols/search?q=${encodeURIComponent(q)}&locale=es`, {
        headers: EDITOR,
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as SearchBody;
      assert.equal(body.locale, 'es');
      assert.equal(body.symbols[0]?.file, file);
      assert.equal(body.symbols[0]?.imageUrl, `/symbols/mulberry/${file}`);
      assert.ok(body.symbols.every((hit) => hit.source === 'mulberry'));
      assert.ok(body.symbols.every((hit) => hit.imageUrl.startsWith('/symbols/mulberry/')));
      assert.deepEqual(outbound, []);
    });
  }

  it('ranks by locale (en, fr) and defaults unknown locales to es', async () => {
    const en = (await (await app.request('/v1/symbols/search?q=water&locale=en', { headers: EDITOR })).json()) as SearchBody;
    assert.equal(en.symbols[0]?.keyword, 'water');
    const fr = (await (await app.request('/v1/symbols/search?q=eau&locale=fr-FR', { headers: EDITOR })).json()) as SearchBody;
    assert.equal(fr.symbols[0]?.file, 'EN/water.svg');
    const xx = (await (await app.request('/v1/symbols/search?q=agua&locale=xx', { headers: EDITOR })).json()) as SearchBody;
    assert.equal(xx.locale, 'es');
    assert.deepEqual(outbound, []);
  });
});
