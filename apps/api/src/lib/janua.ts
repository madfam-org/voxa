import type { TeamRole } from '@voxa/core';
import { mapTeamRoleFromClaims } from '@voxa/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/** Read per call (not at import) so configuration is never frozen before env is set. */
function januaConfig() {
  const issuer = process.env.JANUA_ISSUER_URL || 'https://auth.madfam.io';
  return {
    issuer,
    jwksUrl: process.env.JANUA_JWKS_URL || `${issuer}/.well-known/jwks.json`,
    audience: process.env.JANUA_AUDIENCE || 'voxa',
  };
}

let jwks: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;

function getJwks(jwksUrl: string) {
  if (!jwks || jwks.url !== jwksUrl) {
    jwks = {
      url: jwksUrl,
      set: createRemoteJWKSet(new URL(jwksUrl), { cacheMaxAge: 10 * 60 * 1000 }),
    };
  }
  return jwks.set;
}

export interface JanuaClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  /** Janua application roles; only `voxa:*` entries are read (see mapTeamRoleFromClaims). */
  roles?: string[];
  org_id?: string;
  organization_id?: string;
  /** Voxa plan tier written by Janua (ADR-006); resolved in `src/lib/entitlement.ts`. */
  voxa_tier?: unknown;
}

export function mapJanuaRole(claims: JanuaClaims | Record<string, unknown>): TeamRole {
  return mapTeamRoleFromClaims(claims as Record<string, unknown>);
}

export async function verifyAccessToken(token: string): Promise<JanuaClaims> {
  const { issuer, jwksUrl, audience } = januaConfig();
  const { payload } = await jwtVerify(token, getJwks(jwksUrl), {
    issuer,
    audience,
    algorithms: ['RS256'],
    clockTolerance: 30,
  });
  return payload as JanuaClaims;
}
