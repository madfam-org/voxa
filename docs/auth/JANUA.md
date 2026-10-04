# Janua authentication

> Public-safe summary. Janua admin procedures and client identifiers live in MADFAM's private operations repository; this repo carries the mechanism and the variable names only.

Voxa uses [Janua](https://auth.madfam.io) for MADFAM SSO — the same identity provider as Tulana, forj, and madfam-site. Do not implement custom username/password auth in this repo.

## Web (Next.js): Auth.js with the Janua OIDC provider

The web app signs in with [Auth.js](https://authjs.dev) v5 (`next-auth`
5.0.0-beta.32) using Janua as an OIDC provider: authorization code flow with
PKCE, `state` and `nonce`. The ecosystem's canonical Next adapter,
`@madfam/janua-next`, is published only on MADFAM's private registry; this
public repository must install from public npm without credentials, so it uses
the documented alternative, the Auth.js `janua` provider (`src/auth.ts`).
Auth.js stores no users and no roles.

| Route | Purpose |
|-------|---------|
| `/auth/signin` | Sign-in page: «Continuar con Janua», «Cambiar de cuenta», «Entrar como otra persona» |
| `/api/auth/callback/janua` | Auth.js callback (code exchange, PKCE, state and nonce checks) |
| `/api/auth/session` | Identity and Voxa role for page scripts. **Never a token.** |
| `POST /auth/signout` | Ends the Voxa session and the Janua session (GET answers 405) |
| `/api/v1/*` | Same-origin proxy to the API: the server adds the bearer |
| `/api/media/:id` | Same-origin read of uploaded media (same session) |

### Session

- JWT strategy: the session lives in an encrypted, httpOnly cookie
  (`__Secure-authjs.session-token` in production, chunked when large),
  encrypted with `AUTH_SECRET` by Auth.js's own JWE. The cookie value is
  re-armored in base32 (`src/lib/session-cookie-codec.ts`) so it never contains
  a JWT-shaped (`eyJ…`) string.
- It holds Janua's access, refresh and id tokens. Page scripts never see them:
  the `session` callback returns `{ user: { id, name, email }, teamRole, expires }`.
- The Voxa role shown in the UI comes from the access token after it is
  verified RS256 against Janua's JWKS with audience `voxa`, at sign-in and after
  every refresh. The API re-verifies every call.
- Refresh: when the access token has less than 60 seconds left, the `jwt`
  callback exchanges the refresh token at Janua's token endpoint (Janua rotates
  it) and writes the new session on the same response. If the refresh fails, or
  the new token is for another subject, the session ends (cookie cleared).
- The middleware gates `/app` and `/app/edit` on a valid session (`auth()`), not
  on the presence of a cookie.

### API calls from the browser

Page code calls `/api/v1/...` on the web origin. The proxy
(`src/app/api/v1/[...path]/route.ts`, rules in `src/lib/api-proxy.ts`) forwards
only plain paths under `/v1/`, refuses cross-origin writes (`Origin` /
`Sec-Fetch-Site`), answers 401 without a session without calling the API,
never forwards the cookie or development identity headers, drops upstream
`Set-Cookie` and hop-by-hop headers and answers `Cache-Control: private, no-store`.

The live-sync WebSocket goes to the API origin with a single-use ticket: the
page asks `POST /api/v1/ws-ticket` (through the proxy), the API stores only the
ticket's SHA-256 for 30 seconds and consumes it on upgrade, and closes the
socket when the access token it came from expires.

### Sign-out and account switching (ruling R44)

- **Cerrar sesión:** `POST /auth/signout` (same origin only) deletes the Voxa
  session cookie and navigates the browser (303) to Janua's
  `end_session_endpoint` with `client_id`, `id_token_hint` and
  `post_logout_redirect_uri` = `<origin>/auth/signin`.
- **Cambiar de cuenta:** ends the Voxa session, then `signIn('janua', …,
  { prompt: 'select_account' })` (Janua's account chooser).
- **Entrar como otra persona:** the same with `prompt: 'login'` (Janua asks for
  credentials even with a live session).
- Shared tablets: sign-out and both switches delete the account's local data
  first (offline board copies, queued saves, consent cache, editor unlock,
  service-worker shell cache; `src/lib/account-data.ts`). Device settings
  (access method, theme, editor PIN) stay. Each queued offline save carries the
  id of the account that made it and is deleted unsent, with a notice, under
  any other account.

### Environment variables (web)

```bash
AUTH_SECRET=<generated server-side; never the Janua client secret>
AUTH_JANUA_ISSUER=https://auth.madfam.io
AUTH_JANUA_CLIENT_ID=<Janua client id>
AUTH_JANUA_CLIENT_SECRET=<Janua client secret>
AUTH_URL=https://voxa.madfam.io          # public origin (callback and sign-out URLs)
NEXT_PUBLIC_API_URL=https://voxa-api.madfam.io
```

`/api/health/ready` answers 503 and names (never shows) whichever of
`AUTH_SECRET` and `AUTH_JANUA_*` is missing, so a rollout without them stalls on
the previous pods. In the Kubernetes manifests the client secret comes from the
existing `OIDC_CLIENT_SECRET` key of `voxa-secrets`, and the session secret
from the dedicated Secret `voxa-web-session`, which the ExternalSecret of the
same name fills from the platform's secret store (`secret/voxa`, property
`auth_secret`; `secret/voxa-staging` on staging). The value is generated
inside the store by the secret intake (`--generate auth_secret`); nobody
types or sees it.

Janua client registration, per host: redirect URI
`https://<host>/api/auth/callback/janua` (exact match) and post-logout redirect
`https://<host>/auth/signin`.

## API (Hono)

The API accepts:

1. **`Authorization: Bearer <janua-access-token>`** — verified against Janua JWKS
   (RS256 only, `iss`, `aud`, `exp`, 30 s clock tolerance).
2. **A single-use ticket** on the WebSocket (`GET /v1/ws?boardId=…&ticket=…`,
   minted by `POST /v1/ws-ticket` with a bearer; valid 30 s; consumed on
   upgrade). Access tokens are never read from the URL.
3. **`X-Voxa-User-Id` / `X-Voxa-Role`** (HTTP only; the WebSocket takes nothing but a ticket, which these headers can mint in development) —
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

1. Register, for production and staging, the Auth.js callback `https://<host>/api/auth/callback/janua` and the post-logout redirect `https://<host>/auth/signin` on the Voxa Janua client.
2. Generate the session secret in the platform's secret store with the Enclii secret intake (targets `voxa/web-session` and `voxa-staging/web-session`, key `auth_secret`); the `voxa-web-session` ExternalSecret delivers it.
3. Deploy web; `/api/health/ready` must answer 200.
4. Set API `JANUA_*` secrets via Enclii onboard.
5. Keep `VOXA_JANUA_AUTH_REQUIRED=true` on the API deployments; header auth is never available in production.

## Mobile (Expo)

PKCE authorization code flow via `expo-auth-session`:

| Piece | Purpose |
|-------|---------|
| `useMobileAuth` | Janua sign-in; session in SecureStore |
| `voxa://auth/callback` | OAuth redirect (register in Janua admin) |
| Bearer on `@voxa/sync` | Same account boards as web; the WebSocket opens with a ticket minted with that bearer |

Set in `app.json` / EAS `extra`:

```json
{
  "oidcIssuer": "https://auth.madfam.io",
  "oidcClientId": "voxa",
  "apiUrl": "https://voxa-api.madfam.io"
}
```

### Operator procedures

Registering the OAuth client, binding PostgreSQL and the full GA operator pass are platform-operator steps run with admin credentials. Their scripts and runbooks live in MADFAM's private operations repository.

## References

- MADFAM canon: Janua is the only auth provider
