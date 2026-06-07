import type { TeamRole } from '@voxa/core';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const ISSUER = process.env.JANUA_ISSUER_URL || 'https://auth.madfam.io';
const JWKS_URL = process.env.JANUA_JWKS_URL || `${ISSUER}/.well-known/jwks.json`;
const AUDIENCE = process.env.JANUA_AUDIENCE || 'voxa';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL), { cacheMaxAge: 10 * 60 * 1000 });
  }
  return jwks;
}

export interface JanuaClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  role?: string;
  voxa_role?: string;
  roles?: string[];
  org_id?: string;
  organization_id?: string;
}

export function mapJanuaRole(claims: JanuaClaims | Record<string, unknown>): TeamRole {
  const roles = claims.roles;
  if (Array.isArray(roles)) {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('editor') || roles.includes('slp')) return 'editor';
  }

  const role = String(claims.role ?? claims.voxa_role ?? '').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'editor' || role === 'slp') return 'editor';
  return 'communicator';
}

export async function verifyAccessToken(token: string): Promise<JanuaClaims> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['RS256'],
  });
  return payload as JanuaClaims;
}

export function isJanuaConfigured(): boolean {
  return Boolean(process.env.JANUA_ISSUER_URL || process.env.JANUA_AUTH_REQUIRED === 'true');
}
