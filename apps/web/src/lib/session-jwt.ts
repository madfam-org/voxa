import {
  decode as authJsDecode,
  encode as authJsEncode,
  type JWT,
  type JWTDecodeParams,
  type JWTEncodeParams,
} from 'next-auth/jwt';
import { armorSessionJwe, dearmorSessionJwe } from './session-cookie-codec';

/**
 * Auth.js `jwt.encode`/`jwt.decode` for Voxa: Auth.js's own encryption, with
 * the armored cookie form of `session-cookie-codec.ts`.
 */
export async function encodeSessionJwt(params: JWTEncodeParams<JWT>): Promise<string> {
  return armorSessionJwe(await authJsEncode(params));
}

export async function decodeSessionJwt(params: JWTDecodeParams): Promise<JWT | null> {
  if (!params.token) return null;
  const jwe = dearmorSessionJwe(params.token);
  if (!jwe) return null;
  return authJsDecode({ ...params, token: jwe });
}
