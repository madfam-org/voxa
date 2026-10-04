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

1. **`Authorization: Bearer <janua-access-token>`** — verified against Janua JWKS
   (RS256 only, `iss`, `aud`, `exp`, 30 s clock tolerance).
2. **`X-Voxa-User-Id` / `X-Voxa-Role`** (and `?userId=&role=` on the WebSocket) —
   a local-development shortcut, honoured **only** when `NODE_ENV` is not
   `production` **and** `VOXA_DEV_AUTH=true` (and neither `VOXA_JANUA_AUTH_REQUIRED`
   nor `JANUA_AUTH_REQUIRED` is `true`). Otherwise a request without a bearer
   token gets **401**. The headers are not in the production CORS allow-list. The
   API test preload sets `VOXA_DEV_AUTH=true`; set it yourself for `pnpm dev:api`
   without Janua.

### Environment variables (API)

```bash
JANUA_ISSUER_URL=https://auth.madfam.io
JANUA_JWKS_URL=https://auth.madfam.io/.well-known/jwks.json
JANUA_AUDIENCE=voxa
VOXA_JANUA_AUTH_REQUIRED=true   # production and staging
VOXA_DEV_AUTH=true              # local development only; ignored in production
```

Template: `deploy/secrets-template.yaml`

### Role mapping

Voxa reads **only namespaced Janua application roles** from the `roles` claim,
following Janua's organization-claims contract: organization roles
(`owner`/`admin`/`member`/`employee`) are authority over the Janua account, ride
under `madfam_org_roles`, and never authorize inside a product. Janua's OIDC path
still lists legacy organization roles as bare strings in `roles`, so every
non-namespaced entry is ignored.

| `roles` entry | Voxa `TeamRole` |
|---------------|-----------------|
| `voxa:admin` | `admin` |
| `voxa:editor`, `voxa:slp` | `editor` |
| anything else (incl. bare `admin`, `editor`, `slp`; `role`; `voxa_role`) | `communicator` |

Grant app roles per organization membership with Janua's internal app-roles
grant endpoint (`app` = `voxa`, `role` = `admin` / `editor` / `slp`).

### Board access

- `demo-core` is readable by everyone and **editable by nobody** (no update,
  import, media upload, audit log or usage report).
- The **owner** of a board may read and edit it whatever their role.
- `editor` and `admin` may read and edit boards of **their own organization**
  (`board.org_id` equals the token's `org_id`; both must be present). There is no
  cross-tenant role.
- Any signed-in user may create boards they own, within the plan's board limit.
  The owner is the token `sub` and the organization is the token `org_id`; body
  values for either are ignored, on create and on update.

## Operator checklist

1. Register OAuth client `voxa` in Janua with production + staging redirect URIs.
2. Add client id/secret to web build args and Enclii secrets.
3. Deploy web with OIDC env vars set.
4. Set API `JANUA_*` secrets via Enclii onboard.
5. Keep `VOXA_JANUA_AUTH_REQUIRED=true` on the API deployments; header auth is never available in production.

## Mobile (Expo)

PKCE authorization code flow via `expo-auth-session`:

| Piece | Purpose |
|-------|---------|
| `useMobileAuth` | Janua sign-in; session in SecureStore |
| `voxa://auth/callback` | OAuth redirect (register in Janua admin) |
| Bearer on `@voxa/sync` | Same account boards as web |

Set in `app.json` / EAS `extra`:

```json
{
  "oidcIssuer": "https://auth.madfam.io",
  "oidcClientId": "voxa",
  "apiUrl": "https://voxa-api.madfam.io"
}
```

### Register OAuth client

```bash
JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' ./scripts/deploy/register-janua-oauth-client.sh
```

### Bind managed Postgres

Prefer shared Postgres for GA:

```bash
ENCLII_TOKEN='…' ./scripts/deploy/provision-shared-postgres.sh
```

Dedicated CloudNativePG addon (when provisioning succeeds):

```bash
ENCLII_TOKEN='…' ./scripts/deploy/bind-database-addon.sh \
  voxa <addon_id> <voxa-api-service-id> voxa-services
```

Full operator sweep:

```bash
ENCLII_TOKEN='…' JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' \
  ENCLII_CALLBACK_TOKEN='…' ENCLII_WEBHOOK_SECRET='…' \
  ./scripts/deploy/complete-ga-operator.sh
```

## References

- Tulana reference: `tulana/apps/web/src/lib/auth.ts`
- MADFAM canon: Janua is the only auth provider
