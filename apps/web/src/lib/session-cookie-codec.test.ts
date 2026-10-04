import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encode, decode } from 'next-auth/jwt';
import { armorSessionJwe, dearmorSessionJwe } from './session-cookie-codec';
import { decodeSessionJwt, encodeSessionJwt } from './session-jwt';

const SECRET = 'test-only-secret-for-the-codec-000111';
const SALT = 'authjs.session-token';

describe('session cookie armor', () => {
  it('round-trips an Auth.js JWE and never contains a JWT-shaped string', async () => {
    for (let i = 0; i < 25; i += 1) {
      const jwe = await encode({ token: { sub: `u${i}`, accessToken: 'eyJhbGciOiJSUzI1NiJ9.e30.sig' }, secret: SECRET, salt: SALT });
      assert.ok(jwe.startsWith('eyJ'), 'Auth.js JWE header is base64url JSON');
      const armored = armorSessionJwe(jwe);
      assert.match(armored, /^v1\.[A-Z2-7.]+$/);
      assert.ok(!armored.includes('eyJ'));
      assert.equal(dearmorSessionJwe(armored), jwe);
    }
  });

  it('encodeSessionJwt/decodeSessionJwt use Auth.js encryption underneath', async () => {
    const value = await encodeSessionJwt({ token: { sub: 'u1', teamRole: 'editor' }, secret: SECRET, salt: SALT });
    const decoded = await decodeSessionJwt({ token: value, secret: SECRET, salt: SALT });
    assert.equal(decoded?.sub, 'u1');
    await assert.rejects(decodeSessionJwt({ token: value, secret: 'another-secret-0000000000000000', salt: SALT }));
    const raw = dearmorSessionJwe(value)!;
    assert.equal((await decode({ token: raw, secret: SECRET, salt: SALT }))?.sub, 'u1');
  });

  it('rejects anything that is not an armored value', () => {
    assert.equal(dearmorSessionJwe('eyJhbGciOiJkaXIifQ..a.b.c'), null);
    assert.equal(dearmorSessionJwe('v1.abc.def'), null);
    assert.equal(dearmorSessionJwe('{"access_token":"x"}'), null);
  });
});
