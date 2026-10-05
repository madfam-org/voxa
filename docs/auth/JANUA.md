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
AUTH_PUBLIC_HOSTS=voxa.madfam.io,voxa-app.madfam.io   # hosts sign-in may run on (see below)
NEXT_PUBLIC_API_URL=https://voxa-api.madfam.io
```

`AUTH_URL` is **not set** in any deployment (see "Sign-in stays on the host
the browser used" below). Leave it unset locally too unless you want every
host pinned to one origin.

`/api/health/ready` answers 503 and names (never shows) whichever of
`AUTH_SECRET` and `AUTH_JANUA_*` is missing, and answers 503 with
`invalid: ["AUTH_PUBLIC_HOSTS"]` when an entry of that list is not a plain
host, so a rollout without them stalls on the previous pods. `/api/health`
reports `auth: { <name>: true|false }` (presence only) next to the image's
`build`. In the Kubernetes manifests the client secret comes from the
existing `OIDC_CLIENT_SECRET` key of `voxa-secrets` (a Secret key name kept
from the earlier client; the web reads it as `AUTH_JANUA_CLIENT_SECRET`), and
the session secret from the dedicated Secret `voxa-web-session`, which the
ExternalSecret of the same name fills from the platform's secret store
(`secret/voxa`, property `auth_secret`; `secret/voxa-staging` on staging).
The value is generated inside the store by the secret intake
(`--generate auth_secret`); nobody types or sees it.

### Sign-in stays on the host the browser used

One web deployment serves two hosts per environment: the landing host
(`voxa.madfam.io`) and the app host (`voxa-app.madfam.io`; `voxa-staging…` and
`voxa-app-staging…` on staging). The PKCE, state and nonce cookies and the
session cookie are host-scoped, so sign-in must stay on the host the browser
used; `AUTH_URL` (one origin for every host) cannot do that.

Behind the tunnel the Next.js standalone server hands route handlers a
request URL on its bind address (`HOSTNAME=0.0.0.0`, `PORT=3000`), and
Auth.js builds its callback, error and sign-out URLs from that URL's origin
(`trustHost` only skips Auth.js's own host check). Left alone, every Janua
callback redirects to `https://0.0.0.0:3000/auth/signin?error=Configuration`
(the October 2026 incident, voxa#50). So the exported Auth.js handlers
(`src/auth.ts`, used by the `[...nextauth]` route, the middleware session read
and the API proxy) first rebuild the request URL (`src/lib/public-origin.ts`,
voxa#51):

- host: the first `X-Forwarded-Host` value, else `Host`;
- scheme: `X-Forwarded-Proto` (`http` or `https`), else `https` (`http` for
  a loopback host);
- only when the host is in `AUTH_PUBLIC_HOSTS` (comma-separated; an entry
  without a port matches any port). Without the variable the list is the
  host of `NEXT_PUBLIC_BASE_URL` (and of `AUTH_URL`, if set) plus
  `localhost`, `127.0.0.1` and `[::1]` (development and tests).

A host outside the list is never used: Auth.js answers 400 (or falls back to
`AUTH_URL` when one is set), sign-out answers 400, the same-origin check of
the API proxy refuses, and the sign-in server actions go to the sign-in page
with `error=Configuration`. Sign-out returns to the sign-in page of the
allow-listed host the browser used.

The k8s web manifests set `AUTH_PUBLIC_HOSTS` to the landing and app host of
their environment and do not set `AUTH_URL` (voxa#52 removed the temporary
pin of voxa#50 once voxa#51's image was serving). Adding a web host means
adding it to `AUTH_PUBLIC_HOSTS`, to the deploy smoke's host list and to the
Janua client (next section) together;
`scripts/launch/deploy-contract.test.mjs` fails when a manifest sets
`AUTH_URL` or when the smoke's hosts and the manifest's hosts differ.

Checks:

- **Unit:** `src/lib/public-origin.test.ts` runs the real exported handlers
  with a request URL on `0.0.0.0:3000` and the forwarded headers of each host.
- **CI axe job:** `e2e/specs/auth-public-origin.spec.ts` and
  `scripts/launch/verify-auth-public-origin.sh` (strict) against the
  standalone server bound to `0.0.0.0`, with every manifest host allow-listed.
- **After each web deploy:** `VERIFY_SAME_HOST=1
  scripts/launch/verify-auth-public-origin.sh <landing> <app>` checks both
  hosts anonymously: `/api/auth/providers` must report a `callbackUrl` of
  `https://<host>/api/auth/callback/janua`, and an anonymous
  `/api/auth/callback/janua?code=probe&state=probe` must redirect to
  `https://<host>/…`, on the same host that was asked and never `0.0.0.0`.

### The Janua client

Production and staging use one confidential web client in Janua.

- **Redirect URIs (eight, exact match).** For each of the four web hosts
  (landing and app, production and staging): the Auth.js callback
  `https://<host>/api/auth/callback/janua` and the sign-in page
  `https://<host>/auth/signin`. Janua compares `redirect_uri` exactly
  (scheme, host and path). The sign-in page is registered because Janua
  accepts a `post_logout_redirect_uri` only when it is a registered redirect
  URI of the client (or the origin root of one). The `/auth/callback` URIs of
  the hand-rolled client that Auth.js replaced (voxa#39) are no longer
  registered and no longer exist in the app.
- **First-party (no consent screen).** The client is registered as a MADFAM
  first-party client (its allowed scopes include `madfam:silent_auth`), which
  Janua treats as pre-consented: a person signing in to Voxa is not asked to
  approve Voxa's access to their own MADFAM account. Third-party clients still
  see Janua's consent screen. Voxa requests
  `openid email profile offline_access` and does not use silent sign-in
  (`prompt=none`) today. Janua's rule:
  [pre-consent of first-party clients](https://github.com/madfam-org/janua/blob/main/docs/architecture/SILENT_SSO_SESSION.md#b6--pre-consent).
- **Account chooser.** «Cambiar de cuenta» sends `prompt=select_account`:
  Janua shows the accounts this browser holds and degrades to its login form
  when it holds none that still lives. «Entrar como otra persona» sends
  `prompt=login`, so Janua asks for credentials even with a live session.
  Janua's rules:
  [account switching](https://github.com/madfam-org/janua/blob/main/docs/architecture/SILENT_SSO_SESSION.md#account-switching-l1l3).

### Troubleshooting sign-in

| Symptom | Likely cause | Check and fix |
|---------|--------------|---------------|
| After Janua, the browser lands on `https://0.0.0.0:3000/…` or on the other Voxa host, or the sign-in page shows `error=Configuration` | Auth.js built its URLs on the bind address or on a pinned `AUTH_URL` | `curl -sS https://<host>/api/auth/providers` must show `callbackUrl` = `https://<host>/api/auth/callback/janua` on each host; run `VERIFY_SAME_HOST=1 ./scripts/launch/verify-auth-public-origin.sh <landing> <app>`. The host must be in `AUTH_PUBLIC_HOSTS` and the manifest must not set `AUTH_URL`. A host outside the list answers 400 by design. |
| Janua shows a consent screen for Voxa | The client is not registered as first-party | A platform operator marks the Voxa client first-party in Janua (allowed scope `madfam:silent_auth`); nothing changes in this repository. |
| Janua refuses the request with a redirect-URI error before its login form appears, or sign-out does not come back to Voxa | The host's callback or sign-in page is not a registered redirect URI | Register both URIs for that host on the client (exact scheme, host and path). Every host in `AUTH_PUBLIC_HOSTS` needs its pair. |
| `/api/health/ready` answers 503 with `missing` or `invalid` | A session or client setting is absent, or `AUTH_PUBLIC_HOSTS` has a malformed entry | The body names the settings, never their values; the rollout waits on the previous pods until they are fixed. |
| Signed in, but `/app` returns to the sign-in page after a while | The refresh token was refused (revoked, reused or expired), so the session ended by design | Sign in again. Janua's revocation semantics: [revocation and `POST /oauth/revoke` (RFC 7009)](https://github.com/madfam-org/janua/blob/main/docs/runbooks/oauth-shared-state-redis.md#post-oauthrevoke-rfc-7009). |

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

1. Register, for each web host (landing and app, production and staging), the Auth.js callback `https://<host>/api/auth/callback/janua` and the sign-in page `https://<host>/auth/signin` on the Voxa Janua client, and keep the client first-party (no consent screen).
2. Generate the session secret in the platform's secret store with the Enclii secret intake (targets `voxa/web-session` and `voxa-staging/web-session`, key `auth_secret`); the `voxa-web-session` ExternalSecret delivers it.
3. Deploy web; `/api/health/ready` must answer 200 on every web host and the deploy smoke (`verify-auth-public-origin.sh`, strict) must pass.
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

- MADFAM canon: Janua is the only auth provider.
- Janua: [organization claims and app roles](https://github.com/madfam-org/janua/blob/main/docs/architecture/CLAIMS_DE_ORGANIZACION_Y_SERVICE_PRINCIPALS.md) ·
  [first-party pre-consent](https://github.com/madfam-org/janua/blob/main/docs/architecture/SILENT_SSO_SESSION.md#b6--pre-consent) ·
  [account switching and `prompt` values](https://github.com/madfam-org/janua/blob/main/docs/architecture/SILENT_SSO_SESSION.md#account-switching-l1l3) ·
  [revocation, `POST /oauth/revoke` (RFC 7009) and readiness](https://github.com/madfam-org/janua/blob/main/docs/runbooks/oauth-shared-state-redis.md) ·
  [ecosystem integration guide](https://github.com/madfam-org/janua/blob/main/docs/guides/ECOSYSTEM_INTEGRATION.md).
  The Janua changes that sign-in and switching rely on are [janua#694](https://github.com/madfam-org/janua/pull/694) (consent
  state and the account chooser), [janua#695](https://github.com/madfam-org/janua/pull/695)–[#697](https://github.com/madfam-org/janua/pull/697) (revocation that fails closed
  and revokes, RFC 7009, readiness independent of Redis) and [janua#698](https://github.com/madfam-org/janua/pull/698) (health
  endpoints publish status fields only).
- Ecosystem: [Janua integration guide](https://github.com/madfam-org/solarpunk-foundry/blob/main/docs/JANUA_INTEGRATION.md).
- Auth.js: [authjs.dev](https://authjs.dev).
