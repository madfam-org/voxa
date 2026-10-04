# Voxa agent guide

> Last Updated: 2026-10-04

> **Repository boundary:** operational detail (platform identifiers, operator procedures, break-glass steps) and commercial research (pricing, competitor benchmarks, outreach) live in MADFAM's private operations repository; this public repo holds only public-safe context, per MADFAM's repo-boundary contract.

Canonical instructions for any LLM agent (Claude, Codex, Cursor, …) working in
this repository. Human overview: [README.md](./README.md). Compact index for
LLMs: [llms.txt](./llms.txt).

Voxa is an open AAC (Augmentative and Alternative Communication) platform:
a Next.js board app, an Expo mobile app and a Hono sync/AI API, in one pnpm +
Turborepo monorepo. This repository is **public**: never commit secrets,
internal hostnames, cluster or database identifiers, or user data, and keep
fixtures free of real names and health information.

## Layout

| Path                            | What it is                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`                      | `@voxa/api` — Hono on Node 20: boards, sync (REST + WebSocket), media, activation events, AI, billing. Drizzle ORM on postgres-js.  |
| `apps/web`                      | `@voxa/web` — Next.js 15 board UI, editor and settings (standalone output).                                                         |
| `apps/mobile`                   | `@voxa/mobile` — Expo SDK 57 communicator app (EAS builds).                                                                         |
| `packages/*`                    | `core` (domain model), `obf` (Open Board Format), `import-adapters`, `vocabulary`, `symbols`, `sync`, `access`, `ai`, `i18n`, `ui`. |
| `e2e`                           | Playwright smoke, accessibility (axe) and staging specs.                                                                            |
| `apps/api/drizzle/migrations`   | SQL migrations, `meta/_journal.json` and snapshots `0000`–`0003`.                                                                   |
| `k8s/production`, `k8s/staging` | Kustomize manifests (digest-pinned images).                                                                                         |
| `enclii.yaml`                   | Enclii network and status declarations.                                                                                             |
| `docs/`                         | Architecture, data model, auth, deploy, ops, launch and legal docs.                                                                 |

## Commands

```bash
corepack enable && pnpm install
pnpm dev:api                                   # API on :4000 (file store unless DATABASE_URL is set)
pnpm dev:web                                   # web on :3000
pnpm turbo typecheck                           # what CI runs (mobile included)
pnpm test                                      # every package except e2e (turbo builds deps first)
pnpm --filter @voxa/api test                   # API suite only (build the workspace packages first)
pnpm build
```

## Tests

- Every package uses `node --import tsx --test` with an **explicit file list**
  in its `package.json` `test` script. A new test file does not run until you
  add it there.
- `node --test` runs each file in its own process, in parallel. The API suite
  also preloads `apps/api/src/test-support/isolated-data-dir.ts`, which gives
  every test process its own temporary `VOXA_DATA_DIR`, so test files never
  share the file store. `src/store/file-board-store.test.ts` guards that
  wiring. Never point tests at `apps/api/data/`.
- `apps/api/src/routes/media.pg.test.ts` runs against a real PostgreSQL when
  `VOXA_TEST_DATABASE_URL` is set (it migrates and writes there, so use a
  throwaway database) and skips itself otherwise. CI provides a `postgres:16`
  service container for it; `turbo.json` passes the variable through.
- CI (`.github/workflows/ci.yml`, on pushes and PRs to `main`): typecheck,
  `pnpm test`, the Drizzle drift step (`drizzle-kit generate` must produce no
  changes), the EAS config check, `pnpm build`, then an axe job against the
  built web app, which also runs `pnpm test:e2e:offline`
  (`e2e/specs/offline-media.spec.ts`: offline reload of `/app`, uploaded
  photo, visible GLP video, spoken fallback; it starts the built API itself
  with a file store and a test JWKS).
- Playwright: `pnpm test:e2e:smoke`, `pnpm test:e2e:a11y`,
  `pnpm test:e2e:offline`, `pnpm test:e2e:staging`,
  `pnpm test:e2e:staging:signed-in` (the five
  signed-in specs, one worker). Authenticated specs skip themselves without
  `JANUA_TEST_EMAIL`/`JANUA_TEST_PASSWORD` (or `VOXA_TEST_ACCESS_TOKEN`).
  `/app` renders in Spanish by default: match catalog-backed labels with
  `ui('<namespace.key>')` from `e2e/helpers/i18n.ts`, never an English string.
  `pnpm --filter @voxa/e2e typecheck` type-checks the specs.

## Invariants (do not break)

1. **Migration journal.** The migrator applies only files listed in
   `drizzle/migrations/meta/_journal.json`, and `db:generate` diffs against
   the newest snapshot. Add migrations with
   `pnpm --filter @voxa/api db:generate`; a hand-written file needs a journal
   entry with a larger `when` and a matching snapshot. `src/db/migrations-journal.test.ts` and the
   CI drift step enforce this. The API applies migrations at startup.
2. **One database pool per process.** `getSharedDb()` in
   `src/db/client.ts` is the only pool on request paths (board store, media
   store, `POST /v1/events/activations`, the readiness ping). Default size 5
   (`DATABASE_POOL_MAX`); migrations use their own `max: 1` client that is
   closed afterwards; `closeSharedDb()` runs on `SIGTERM`/`SIGINT`. The
   Postgres server is shared under a fixed connection limit and the API
   connects directly (no pooler): see
   [docs/deploy/ENCLII.md](./docs/deploy/ENCLII.md#connection-budget-contract).
   Never call `createDb()` per request.
3. **Startup retry is connection-level only.** `src/db/startup-retry.ts`
   retries `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND` and
   `EAI_AGAIN` on the startup migration for `DATABASE_STARTUP_RETRY_MS`
   (default 30 s), logs the code only, then fails as before. SQL and
   migration errors are never retried. Migrations run under a session
   advisory lock (`MIGRATION_LOCK_KEY`), so concurrent starts do not race.
4. **No query parameters in responses or logs.** Since drizzle-orm 0.44 a
   `DrizzleQueryError` carries the SQL and its bound parameters (board
   content, user ids, media bytes). `src/lib/db-errors.ts` (`unwrapDbError`,
   `errorMessage`) and `app.onError` strip them; use them for any error that
   reaches a response body or a log line. Tested in
   `src/lib/db-errors.test.ts`.
5. **Atomic file store.** Without `DATABASE_URL` the API keeps boards in
   `boards.json` under `VOXA_DATA_DIR` (default `./data`) and replaces it with
   temp file + `fsync` + `rename`. Do not reintroduce in-place writes.
6. **Next image optimizer off.** `apps/web/next.config.ts` sets
   `images.unoptimized: true` with `remotePatterns: []`, so `/_next/image`
   answers 404 (GHSA-2xp9-vwfh-vxw4 defence in depth). Nothing imports
   `next/image`; pictograms are plain `<img>` tags loaded straight from their
   URLs. Enforced by `apps/web/src/next-config.test.ts`, by the CI a11y job
   against the built standalone server and by
   `scripts/launch/verify-prod-image-optimizer.sh` after each production web
   deploy. Re-enabling the optimizer or adding a remote origin means changing
   the config, the test and this entry together, with exact origins only.
7. **Consent is a server-side record.** `src/lib/consents.ts` holds one
   record per user and purpose (`ai_processing`, `usage_analytics`,
   `utterance_text`); `GET/PUT /v1/consents` act on the signed-in user only.
   Predictions need `ai_processing`, activations need `usage_analytics` and
   store counts only; `speech_text` is written only with `utterance_text`
   from an organization in `VOXA_UTTERANCE_TEXT_DPA_ORG_IDS` (empty by
   default) and cleared after 90 days by `src/lib/utterance-retention.ts`.
   Never gate on a request header again, and never store activation text
   outside that path. Tested in `src/routes/consents.routes.test.ts`,
   `src/routes/events.routes.test.ts` and `src/routes/consent.pg.test.ts`.
8. **Entitlements come only from the verified Janua claim.** Plan limits
   (`maxBoardCount`, `hasFeature`) resolve from `voxa_tier` through
   `src/lib/entitlement.ts` and fail safe to `free`. Do not add a pull from the
   billing system, a request header or a body field that sets the tier.
   Tested in `src/lib/entitlement.test.ts` and
   `src/routes/entitlement.routes.test.ts` (real RS256 tokens).
9. **Model predictions go only through Selva, as `restricted`.** Text
   predictions call no model vendor directly. With `SELVA_ENABLED=true`,
   `src/lib/selva.ts` sends the current partial utterance (last 200
   characters, nothing else) to Selva's `/v1/chat/completions` with
   `X-Sensitivity: restricted` and a Janua `client_credentials` token cached
   until 60 s before expiry. Any failure (unset configuration, token error,
   HTTP error including Selva's 503 when it has no local model, timeout,
   malformed answer) answers 200 from the local predictor with
   `source: "local"`. It runs only after the `ai_processing` consent check,
   and logs carry reason codes, never utterance text or tokens. The local
   predictor (`packages/ai`) has English and Spanish continuation tables,
   selected by the board locale; the Spanish table awaits review by a
   credentialed speech-language pathologist. Tested in
   `src/lib/selva.test.ts`, `src/routes/ai.routes.test.ts` and
   `packages/ai/src/predict.test.ts`.
10. **Service worker and media.** `apps/web/public/sw.js` is plain JavaScript
    (`node --check` must pass; browsers do not run TypeScript there). It caches
    the `/app` shell, `/_next/static`, icons and `/symbols`, and never caches
    `/api/*` or any other origin: its caches are shared by every user of the
    browser. Uploaded media is loaded through the same-origin proxy
    `/api/media/:id`, which adds no access rule of its own (the API's
    `canAccessBoard` decides). Tested in `apps/web/src/service-worker.test.ts`,
    `apps/web/src/lib/media-proxy.test.ts` and `apps/api/src/routes/media-access.routes.test.ts`.

## Deploy

| Workflow                                                     | Trigger                                                        | Effect                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `deploy-voxa-api.yml`                                        | push to `main` touching `apps/api/**`, `packages/**`; dispatch | build, cosign-sign, pin digest in `k8s/production`, smoke `/health`              |
| `deploy-voxa-web.yml`                                        | push to `main` touching `apps/web/**`, `packages/**`; dispatch | same for web; smoke `/demo` and `/_next/image` → 404                             |
| `deploy-voxa-api-staging.yml`, `deploy-voxa-web-staging.yml` | push to `main` with the same paths (plus the workflow file); dispatch | build, cosign-sign, pin digest in `k8s/staging`, smoke the staging host; never gates production |
| `mobile-eas.yml`, `mobile-eas-submit.yml`, `ghcr-public.yml` | dispatch only                                                  | EAS build/submit, package visibility                                             |
| `e2e-smoke.yml` ("Daily smoke")                              | daily schedule; dispatch                                       | job `smoke`: read-only production checks (`verify-prod-ga`, `verify-prod-demo`, `verify-prod-redis`, which warns until Redis is bound; Playwright smoke and axe on public pages). Job `staging-signed-in`: the signed-in specs against staging; skips with a notice without the `VOXA_STAGING_*` secrets |

Argo CD auto-syncs the pinned manifests; the web pin commit also bumps the pod
template's `restartedAt`, so no workflow calls Argo or restarts pods, and no
workflow holds an identity-provider or platform credential. Each deploy
workflow has its own concurrency group. GitHub-hosted jobs are pinned to
`ubuntu-24.04`. Full runbook: [docs/deploy/ENCLII.md](./docs/deploy/ENCLII.md);
on-call: [docs/ops/RUNBOOK.md](./docs/ops/RUNBOOK.md).

## Pending work and known gaps (as of 2026-10-03)

This is the single pending-work list for the repository; `llms.txt` points
here. Product and launch phases live in
[docs/launch/GA_ROADMAP.md](./docs/launch/GA_ROADMAP.md). Priorities: **P0**
blocks production use, **P1** next, **P2** planned, **P3** cleanup.

| Item                                                                                                                                                                                                                         | Why it matters                                                                                                                                                                          | Priority | Kind                                                                            | Tracking |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- | -------- |
| **Mobile store builds are not set up.** The app is on Expo SDK 57, shows symbols and bundles in CI, but the EAS project, the App Store Connect and Google Play listings and the repository variables and secrets the mobile workflows read do not exist yet. | No preview or store build has ever been produced; the workflows stop with a message naming each missing variable. | P1 | Owner setup (names and commands in `docs/launch/MOBILE_GA.md`) | — |
| **Three mobile build-tool advisories have no compatible fix.** `node-forge` (Expo CLI code signing; no patched release), `braces` (Metro file watcher and the shadcn CLI; no patched release) and `decode-uri-component` 0.2 under `expo-router`'s `query-string` 7 (the fix, 0.5, is ESM-only and `query-string` 7 loads it with `require`). | Dev and build tooling, except `decode-uri-component`, which ships in the app and only parses the app's own deep links. | P3 | Upstream (re-check on each Expo SDK release) | — |
| **Staging's Argo CD app still tracks the deleted `staging` branch.** The staging workflows now pin `k8s/staging` on `main`, but `voxa-staging-services` reads branch `staging`, which no longer exists, so it cannot compare (ComparisonError) and staging keeps a June build. | Until the app tracks `main`, staging does not move and the daily signed-in specs test an old build. | P1 | Platform operator (point the app's source revision at `main`); then confirm the `VOXA_STAGING_*` test account still signs in and holds `voxa:slp` | — |
| **Paid tiers are not grantable yet.** The API reads the plan tier from the Janua `voxa_tier` claim, but the push that writes the claim for user subscriptions (billing → Janua) is not built. | Nobody can hold `family` or `clinic`, so every user gets the free limits (one board). Fails safe: no one gets a paid tier they did not buy. | P1 | Ecosystem work outside this repo; no Voxa change is needed once tokens carry the claim | Y1 |
| **Prettier is not enforced.** `pnpm format` exists but CI does not check it, and several files predate it.                                                                                                                   | Formatting drifts and creates noise in unrelated PRs.                                                                                                                                   | P3       | Engineering work (one reformat, then a CI check)                                | —        |
| **Selva predictions are off.** `SELVA_ENABLED` defaults to `false`, so every text suggestion comes from the local predictor. Turning it on needs a Janua service client for this edge, its id and secret delivered to the API, and a local model behind Selva for `restricted` requests. | Until then suggestions are rule-based only. Turning it on early is safe (every failure falls back to local) but pointless. | P2 | Ecosystem and operator work; no Voxa code change is needed | — |
| **Two internal literals left in deploy-functional or app files.** The Kubernetes web deployments still carry the OAuth client id as a literal, and a code comment in `apps/web/src/lib/pricing.ts` points at a pricing document that is now private. | The operational and commercial docs moved out on 2026-10-03; these two need a deploy-touching change, so they were left for a separate PR. | P2       | Engineering work (read the client id from configuration; reword the comment)    | —        |

The Next image optimizer gap listed here before 2026-10-02 is closed (#13,
invariant 6).

## Related repositories and contracts

- **Janua (identity).** The API verifies Janua access tokens with `jose`
  (`src/lib/janua.ts`): JWKS from `JANUA_JWKS_URL` (default
  `${JANUA_ISSUER_URL}/.well-known/jwks.json`), `iss` = `JANUA_ISSUER_URL`,
  `aud` = `JANUA_AUDIENCE` (default `voxa`), RS256 only, 30 s clock tolerance.
  Roles come only from namespaced app roles in `roles` (`voxa:admin`,
  `voxa:editor`, `voxa:slp`); bare organization roles are ignored, editors and
  admins act only inside their own `org_id`, owners edit their own boards and
  `demo-core` is read-only (`src/lib/board-access.ts`). Development headers
  (`X-Voxa-User-Id`/`X-Voxa-Role`) need `VOXA_DEV_AUTH=true` and never work in
  production. Contract:
  [Janua ecosystem integration guide](https://github.com/madfam-org/janua/blob/main/docs/guides/ECOSYSTEM_INTEGRATION.md).
  Voxa setup: [docs/auth/JANUA.md](./docs/auth/JANUA.md).
- **Entitlements (Janua claim, ADR-006).** The plan tier is a claim on the
  Janua access token: `voxa_tier`, one of `free`, `family`, `clinic`.
  `src/lib/entitlement.ts` reads it from the token `teamAuth()` has already
  verified (`TeamContext.tierClaim`) and holds the one tier → features table
  (`boards:N`, `ai:*`, `team:N`, `reports`). Dhanam (billing) is the only
  writer of the claim and writes it through Janua; Voxa never calls Dhanam.
  Exact values only (never a plan or SKU id); a missing, malformed or unknown
  claim resolves to `free` and logs one line without the claim value.
  `GET /v1/billing/entitlement` answers `{ tier, features, source: 'janua' }`.
  A tier change reaches Voxa when the user's next token is minted. The push
  that writes the claim for user subscriptions is not built yet (gate Y1), so
  paid tiers are not grantable and every user resolves to `free`.
- **Selva (model gateway).** Text predictions use Selva's OpenAI-compatible
  `/v1/chat/completions` (`src/lib/selva.ts`), authenticated by a Janua
  `client_credentials` token for this service's own client (scope
  `SELVA_SCOPE`, default `selva:infer`; audience is Selva's). Settings:
  `SELVA_ENABLED` (default `false`), `SELVA_BASE_URL`, `SELVA_CLIENT_ID`,
  `SELVA_CLIENT_SECRET` (secret), `JANUA_TOKEN_URL`, optional
  `SELVA_TIMEOUT_MS` (default 2000). Every request is `X-Sensitivity:
  restricted`, which Selva serves only from a local model and otherwise
  refuses with 503.
- **Enclii (deploy).** [Zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md).
