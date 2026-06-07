# Janua authentication

Voxa uses [Janua](https://auth.madfam.io) for MADFAM SSO — the same identity provider as Tulana, forj, and madfam-site. Do not implement custom username/password auth in this repo.

## Web (Next.js)

OIDC authorization code flow with PKCE:

| Route | Purpose |
|-------|---------|
| `/auth/signin` | Start Janua login |
| `/auth/callback` | Exchange code, set `voxa_session` cookie |
| `/auth/signout` | Clear session |
| `/api/auth/session` | Same-origin session + access token for sync client |

When `NEXT_PUBLIC_OIDC_ISSUER` and `NEXT_PUBLIC_OIDC_CLIENT_ID` are set, middleware redirects unauthenticated users to sign-in.

### Environment variables (web)

```bash
NEXT_PUBLIC_OIDC_ISSUER=https://auth.madfam.io
NEXT_PUBLIC_OIDC_CLIENT_ID=voxa
NEXT_PUBLIC_BASE_URL=https://voxa.madfam.io
OIDC_CLIENT_SECRET=<from Janua admin>
SESSION_COOKIE_SECRET=<random 32+ bytes>
```

Register redirect URI: `https://voxa.madfam.io/auth/callback` (and staging equivalent).

## API (Hono)

The API accepts:

1. **`Authorization: Bearer <janua-access-token>`** — verified against Janua JWKS (production)
2. **`X-Voxa-User-Id` / `X-Voxa-Role`** — local dev only when `JANUA_AUTH_REQUIRED` is not `true`

### Environment variables (API)

```bash
JANUA_ISSUER_URL=https://auth.madfam.io
JANUA_JWKS_URL=https://auth.madfam.io/.well-known/jwks.json
JANUA_AUDIENCE=voxa
JANUA_AUTH_REQUIRED=false   # set true after web OIDC is live
```

Template: `deploy/secrets-template.yaml`

### Role mapping

| Janua claim | Voxa `TeamRole` |
|-------------|-----------------|
| `admin` | `admin` |
| `editor`, `slp` | `editor` |
| (default) | `communicator` |

Claims checked: `roles[]`, `role`, `voxa_role`.

## Operator checklist

1. Register OAuth client `voxa` in Janua with production + staging redirect URIs.
2. Add client id/secret to web build args and Enclii secrets.
3. Deploy web with OIDC env vars set.
4. Set API `JANUA_*` secrets via Enclii onboard.
5. Flip `JANUA_AUTH_REQUIRED=true` when ready to disable header auth.

## References

- Tulana reference: `tulana/apps/web/src/lib/auth.ts`
- MADFAM canon: Janua is the only auth provider
