/**
 * Behaviour of `public/sw.js`, run in a VM with a fake Cache Storage and
 * network. The worker must parse as plain JavaScript (browsers reject
 * TypeScript), never cache per-user answers, and serve the app shell offline.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeEach, describe, it } from 'node:test';

const SW_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sw.js');
const ORIGIN = 'https://voxa.example.test';

interface FakeResponse {
  status: number;
  type: string;
  redirected: boolean;
  body: string;
  clone(): FakeResponse;
}

function response(body: string, status = 200, type = 'basic', redirected = false): FakeResponse {
  const res: FakeResponse = { status, type, redirected, body, clone: () => ({ ...res }) };
  return res;
}

type Req = { url: string; method: string; mode: string };
const keyOf = (r: Req | string) => (typeof r === 'string' ? r : r.url);

class FakeCache {
  entries = new Map<string, FakeResponse>();
  async match(r: Req | string) {
    return this.entries.get(keyOf(r));
  }
  async put(r: Req | string, res: FakeResponse) {
    this.entries.set(keyOf(r), res);
  }
  async delete(r: Req | string) {
    return this.entries.delete(keyOf(r));
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
}

let stores: Map<string, FakeCache>;
let network: (url: string) => Promise<FakeResponse>;
let networkCalls: string[];
let listeners: Map<string, (event: unknown) => void>;
let deletedByCleanup: string[];

function loadWorker(): void {
  listeners = new Map();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined, matchAll: async () => [] },
  };
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new FakeCache());
      return stores.get(name)!;
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => {
      deletedByCleanup.push(name);
      return stores.delete(name);
    },
  };
  const fetch = async (r: Req | string) => {
    networkCalls.push(keyOf(r));
    return network(keyOf(r));
  };
  vm.runInNewContext(readFileSync(SW_PATH, 'utf8'), { self, caches, fetch, URL, console });
}

async function dispatchFetch(url: string, mode = 'no-cors', method = 'GET') {
  let responded: Promise<FakeResponse> | undefined;
  const waits: Array<Promise<unknown>> = [];
  listeners.get('fetch')!({
    request: { url, method, mode },
    respondWith: (p: Promise<FakeResponse>) => {
      responded = p;
    },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  await Promise.all(waits);
  return responded;
}

describe('service worker (public/sw.js)', () => {
  beforeEach(() => {
    stores = new Map();
    networkCalls = [];
    deletedByCleanup = [];
    network = async (url) => response(`net:${url}`);
    loadWorker();
  });

  it('is plain JavaScript (node --check exits 0)', () => {
    execFileSync(process.execPath, ['--check', SW_PATH]);
  });

  it('never answers session, media proxy, API-origin or non-GET requests', async () => {
    assert.equal(await dispatchFetch(`${ORIGIN}/api/auth/session`, 'cors'), undefined);
    assert.equal(await dispatchFetch(`${ORIGIN}/api/media/3f1c2a9e-7b4d-4c1e-9a8f-0d2b6e5c4a31`), undefined);
    assert.equal(await dispatchFetch('https://voxa-api.example.test/v1/boards/demo-core', 'cors'), undefined);
    assert.equal(await dispatchFetch(`${ORIGIN}/_next/static/chunks/a.js`, 'no-cors', 'POST'), undefined);
    assert.equal(stores.size, 0);
  });

  it('serves the app shell network first and from the cache when offline', async () => {
    const online = await dispatchFetch(`${ORIGIN}/app`, 'navigate');
    assert.equal((await online)!.body, `net:${ORIGIN}/app`);

    network = async () => {
      throw new TypeError('Failed to fetch');
    };
    const offline = await dispatchFetch(`${ORIGIN}/app`, 'navigate');
    assert.equal((await offline)!.body, `net:${ORIGIN}/app`);
  });

  it('does not cache a redirect (signed-out visit) as the shell', async () => {
    network = async () => response('', 0, 'opaqueredirect');
    await (await dispatchFetch(`${ORIGIN}/en/app`, 'navigate'));
    const shell = [...stores.entries()].find(([name]) => name.startsWith('voxa-shell-'));
    assert.equal(shell?.[1].entries.size ?? 0, 0);
  });

  it('serves build assets and pictograms cache first', async () => {
    const chunk = `${ORIGIN}/_next/static/chunks/main-abc.js`;
    const symbol = `${ORIGIN}/symbols/mulberry/EN/want.svg`;
    await (await dispatchFetch(chunk));
    await (await dispatchFetch(symbol));
    network = async () => {
      throw new TypeError('Failed to fetch');
    };
    assert.equal((await (await dispatchFetch(chunk)))!.body, `net:${chunk}`);
    assert.equal((await (await dispatchFetch(symbol)))!.body, `net:${symbol}`);
  });

  it('deletes caches of older versions on activate, and only Voxa caches', async () => {
    stores.set('voxa-shell-v0', new FakeCache());
    stores.set('another-app-cache', new FakeCache());
    const waits: Array<Promise<unknown>> = [];
    listeners.get('activate')!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    assert.deepEqual(deletedByCleanup, ['voxa-shell-v0']);
    assert.ok(stores.has('another-app-cache'));
  });

  it('forgets the cached shell when the user signs out', async () => {
    await (await dispatchFetch(`${ORIGIN}/app`, 'navigate'));
    assert.ok([...stores.keys()].some((name) => name.startsWith('voxa-shell-')));
    assert.equal(await dispatchFetch(`${ORIGIN}/auth/signout`, 'navigate'), undefined);
    assert.ok(![...stores.keys()].some((name) => name.startsWith('voxa-shell-')));
  });
});
