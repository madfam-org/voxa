import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildContentSecurityPolicy,
  generateNonce,
  originOf,
  webSocketOriginOf,
} from './security-headers';

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(';').map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name!, sources];
    }),
  );
}

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';

describe('buildContentSecurityPolicy', () => {
  const prod = buildContentSecurityPolicy(NONCE, {
    apiUrl: 'https://api.example.test/',
    oidcIssuers: ['https://id.example.test', 'https://id.example.test/'],
  });
  const d = directives(prod);

  it('allows scripts only from self and the nonce, without strict-dynamic or eval', () => {
    assert.deepEqual(d.get('script-src'), ["'self'", `'nonce-${NONCE}'`]);
    assert.doesNotMatch(prod, /strict-dynamic|unsafe-eval/);
  });

  it('derives connect-src from the API (https and wss) and the issuer, deduplicated', () => {
    assert.deepEqual(d.get('connect-src'), [
      "'self'",
      'https://api.example.test',
      'wss://api.example.test',
      'https://id.example.test',
    ]);
  });

  it('locks framing, base, objects and form targets', () => {
    assert.deepEqual(d.get('default-src'), ["'self'"]);
    assert.deepEqual(d.get('frame-ancestors'), ["'none'"]);
    assert.deepEqual(d.get('base-uri'), ["'self'"]);
    assert.deepEqual(d.get('object-src'), ["'none'"]);
    assert.deepEqual(d.get('form-action'), ["'self'", 'https://id.example.test']);
    assert.deepEqual(d.get('font-src'), ["'self'"]);
    assert.deepEqual(d.get('style-src'), ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(d.get('media-src'), ["'self'", 'blob:']);
    assert.deepEqual(d.get('img-src'), ["'self'", 'data:', 'blob:', 'https://api.example.test']);
  });

  it('names no third-party symbol host', () => {
    assert.doesNotMatch(prod, /arasaac/i);
  });

  it('omits sources whose env is unset or not http(s)', () => {
    const bare = directives(buildContentSecurityPolicy(NONCE, { apiUrl: 'javascript:alert(1)', oidcIssuers: [undefined] }));
    assert.deepEqual(bare.get('connect-src'), ["'self'"]);
    assert.deepEqual(bare.get('form-action'), ["'self'"]);
    assert.deepEqual(bare.get('img-src'), ["'self'", 'data:', 'blob:']);
  });

  it('maps a local http API to ws and adds eval only in development', () => {
    const dev = directives(buildContentSecurityPolicy(NONCE, { apiUrl: 'http://localhost:4000', isDev: true }));
    assert.ok(dev.get('connect-src')?.includes('ws://localhost:4000'));
    assert.ok(dev.get('script-src')?.includes("'unsafe-eval'"));
  });

  it('rejects a short or malformed nonce', () => {
    assert.throws(() => buildContentSecurityPolicy('abc', {}));
    assert.throws(() => buildContentSecurityPolicy("x' 'unsafe-inline", {}));
  });
});

describe('nonce and origin helpers', () => {
  it('generates distinct 128-bit base64 nonces', () => {
    const a = generateNonce();
    const b = generateNonce();
    assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
    assert.notEqual(a, b);
  });

  it('parses origins and websocket origins', () => {
    assert.equal(originOf('https://api.example.test/v1'), 'https://api.example.test');
    assert.equal(originOf(undefined), null);
    assert.equal(originOf('not a url'), null);
    assert.equal(webSocketOriginOf('https://api.example.test'), 'wss://api.example.test');
  });
});
