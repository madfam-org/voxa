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
| `apps/api`                      | `@voxa/api` — Hono on Node 22: boards, sync (REST + WebSocket), media, activation events, AI, billing. Drizzle ORM on postgres-js.  |
| `apps/web`                      | `@voxa/web` — Next.js 15 board UI, editor and settings (standalone output).                                                         |
| `apps/mobile`                   | `@voxa/mobile` — Expo SDK 57 communicator app (EAS builds).                                                                         |
| `packages/*`                    | `core` (domain model), `obf` (Open Board Format), `import-adapters`, `vocabulary`, `symbols`, `sync`, `access`, `ai`, `i18n`, `ui`. |
| `e2e`                           | Playwright smoke, accessibility (axe) and staging specs.                                                                            |
| `apps/api/drizzle/migrations`   | SQL migrations, `meta/_journal.json` and their snapshots (`0000`–`0007`).                                                           |
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

- Test files are **discovered, never listed**. Every package's `test` script
  is `node ../../scripts/run-unit-tests.mjs` (the API adds
  `--import ./src/test-support/isolated-data-dir.ts`): it finds every
  `*.test.{ts,tsx,mts,cts,js,mjs}` under the package's `src/` (skipping
  `node_modules` and build output) and runs them with
  `node --import tsx --test`. A new test file runs as soon as it exists; do
  not add file names to `package.json`. To keep a file out of the unit job,
  add it to `EXCLUDED` in `scripts/run-unit-tests.mjs` with the reason (empty
  today: Postgres suites skip themselves, browser specs live in `e2e/`). The
  test-discovery guard fails if a tracked test does not run or if a file the
  old hand-written lists ran (`scripts/guards/fixtures/unit-tests-before-discovery.txt`)
  is no longer discovered; when you rename or delete one of those tests,
  edit that file in the same change. `pnpm test:guards` runs the guards' own
  tests (`scripts/**/*.test.mjs`, plain Node).
- `node --test` runs each file in its own process, in parallel. The API suite
  also preloads `apps/api/src/test-support/isolated-data-dir.ts`, which gives
  every test process its own temporary `VOXA_DATA_DIR`, so test files never
  share the file store. `src/store/file-board-store.test.ts` guards that
  wiring. Never point tests at `apps/api/data/`.
- The API's `*.pg.test.ts` files (`routes/media.pg.test.ts`,
  `routes/consent.pg.test.ts`, `db/legacy-utterance-purge.pg.test.ts`,
  `store/pg-board-store.pg.test.ts`) run against a real PostgreSQL when
  `VOXA_TEST_DATABASE_URL` is set (they migrate and write there, so use a
  throwaway database; ids are unique per run because the files share it) and
  skip themselves otherwise. `src/ws/sync-hub.redis.test.ts` also needs
  `VOXA_TEST_REDIS_URL`: it starts two API processes on that database and
  Redis and proves cross-replica delivery and global presence. CI provides
  `postgres:16` and `redis:7` service containers; `turbo.json` passes both
  variables through.
- CI (`.github/workflows/ci.yml`, on pushes and PRs to `main`): the
  repository guards (`pnpm guards`, `pnpm test:guards`; see [Guards](#guards)),
  typecheck, `pnpm test`, the Drizzle drift step (`drizzle-kit generate` must produce no
  changes), the EAS config check, `pnpm build`, then an axe job against the
  built web app, which also runs `pnpm test:e2e:offline`
  (`e2e/specs/offline-media.spec.ts`: offline reload of `/app`, uploaded
  photo, visible GLP video, spoken fallback; it starts the built API itself
  with a file store and a test JWKS) and `pnpm test:e2e:access`
  (`e2e/specs/access-methods.spec.ts`, same local API: tap-only button moves
  in a `hasTouch` browser, keyboard move commands, the admin motor-plan
  override, a refused 422 save leaving the queue) and `pnpm test:e2e:voices`
  (`e2e/specs/voice-choice.spec.ts`, no API: a stubbed `speechSynthesis`
  proves a button press, "Speak" and a prediction chip speak with the chosen
  `voiceURI`, rate, pitch, volume and the board's `lang`; axe on the Voice
  settings section in a light and a dark theme) and `pnpm test:e2e:first-run`
  (`e2e/specs/first-run.spec.ts`, same local API as the offline spec: a new
  user picks switch scanning, 36 cells and a voice and lands on a 36-cell
  es-MX board with scanning on; a returning user and `/demo` never see the
  setup; a 402 offers the existing board; axe on every step in a light and a
  dark theme). The axe job scans `/app`
  in all four board themes and, in Spanish (the default, unprefixed locale),
  the landing, `/demo`, `/app` and its settings panel; both fail on serious
  or critical violations. The standalone server binds `HOSTNAME=0.0.0.0` as
  in production: bound to `127.0.0.1`, Next hands middleware a `localhost`
  request URL and every unprefixed Spanish path redirects to itself.
- Playwright: `pnpm test:e2e:smoke`, `pnpm test:e2e:a11y`,
  `pnpm test:e2e:offline`, `pnpm test:e2e:access`, `pnpm test:e2e:voices`,
  `pnpm test:e2e:first-run`, `pnpm test:e2e:staging`,
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
5. **Atomic file store, never in production.** Without `DATABASE_URL` the API
   keeps boards in `boards.json` under `VOXA_DATA_DIR` (default `./data`) and
   replaces it with temp file + `fsync` + `rename`. Do not reintroduce
   in-place writes. With `NODE_ENV=production` and no `DATABASE_URL` the API
   exits 1 at startup, and `/health/ready` answers 503 on the file store in
   production (`src/store/fail-closed.test.ts`).
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
11. **Imports create new boards; OBF is the spec.** `POST /v1/boards/import/:format`
    turns a file into NEW boards owned by the caller (counted against the plan
    limit) and never writes into an existing board; the old
    `POST /v1/boards/:id/import/*` answers 410. Do not reintroduce an import that
    replaces a board or passes `forceMotorPlanning`. `@voxa/obf` writes spec
    OBF 0.1 (`open-board-0.1`, 2-D `grid.order`, `images[]`/`sounds[]`,
    `load_board{}`, `rgb()` colours) with Voxa-only data as `ext_voxa_*`; it
    reads spec files and the old Voxa dialect. Archives go through `safeUnzip`
    (zip-slip, symlinks, entry count, sizes, compression ratio → 400). Embedded
    media is stored through the media store for the new board; remote picture
    URLs are never fetched (only the vendored Mulberry set is kept). Grid 3,
    Snap and TouchChat imports are beta (one page, words only) and say so in
    the UI and public copy. Tested in `packages/obf/src/*.test.ts` (schemas in
    `packages/obf/schema/`), `apps/api/src/routes/import.routes.test.ts`,
    `apps/api/src/store/board-import.test.ts` and the browser spec
    `e2e/specs/board-import.spec.ts` (`pnpm --filter @voxa/e2e test:import`,
    run in the CI a11y job like `test:offline`).
12. **One speech path, device voices only.** Every utterance in the web app
    (button speech, "Speak", prediction chips, the keyboard, scan cues, the
    spoken fallback for recorded media, the public demo) is built by
    `buildUtterance` in `apps/web/src/lib/play-button-speech.ts`: `lang` is
    the board's speech locale, the voice is the device-local choice for that
    locale (else the best ranked installed voice,
    `apps/web/src/lib/speech-voices.ts`), and rate, pitch and volume come from
    the communicator settings. Never call `speechSynthesis.speak` elsewhere.
    Voice quality labels come only from the voice's name and `localService`;
    the "higher voice" preset is an approximation, never called a child
    voice. Licensed or cloud voices are an open owner decision. Tested in
    `apps/web/src/lib/speech-voices.test.ts`,
    `apps/web/src/lib/play-button-speech.test.ts` and
    `e2e/specs/voice-choice.spec.ts`.

13. **Board writes are compare-and-set; reads are scoped.** The PostgreSQL
    store reads one board by id, applies the change, and updates the row only
    `WHERE id = $1 AND version = $2`, with the sync event in the same
    transaction: of two writers on one version exactly one wins and the other
    gets 409 `VERSION_CONFLICT` with `currentVersion` (a PUT without
    `expectedVersion` retries up to three times). The motor-planning 422 is
    unchanged, and the server enforces the override: `forceMotorPlanning: true`
    is honoured only for a `voxa:admin` of the board's organization
    (`canOverrideMotorPlanning`); anyone else gets 403
    `MOTOR_PLANNING_OVERRIDE_FORBIDDEN` and nothing is saved, while an explicit
    `locked: false` in the same save still unlocks and moves
    (`src/routes/motor-planning-override.routes.test.ts`). Every content field of a `Board` is persisted, including
    `layout` and `display` (columns since migration 0007; before it the
    PostgreSQL store dropped them while the file store kept them).
    `listBoardsForActor` filters in SQL with the `canAccessBoard`
    rule, `countBoardsOwnedBy` uses `count(*)`, events are trimmed per board in
    one statement. Never load every board (`select … from boards` without a
    `WHERE`) on a request path. Tested in `src/store/pg-board-store.pg.test.ts`
    (a test-only SQL observer in `src/db/client.ts` sees query text, never
    parameters).
14. **Request limits and media checks.** On `/v1/*`, in memory per replica
    with pruned, bounded buckets (`src/middleware/rate-limit.ts`). The web
    server proxies browser calls, so every user can arrive from one address:
    **authenticated traffic is never limited per address.** A per-address
    limit (`CF-Connecting-IP`, else the socket peer; never `X-Forwarded-For`)
    counts only requests without a bearer token (`RATE_LIMIT_IP_PER_MINUTE`,
    600); a per-address failure limit counts 401s and answers 429 past
    `RATE_LIMIT_AUTH_FAILURES_PER_MINUTE` (60), never to a token that
    verifies; per verified user, `GET /v1/media/:id` has its own budget
    (`RATE_LIMIT_MEDIA_PER_MINUTE`, 600) and everything else shares
    `RATE_LIMIT_PER_MINUTE` (300: a signed-in selection costs about three
    requests, two predictions and one activation). Body ceilings (`src/middleware/body-limit.ts`:
    1 MB JSON, media uploads at their maximum plus 1 MB, an outer 51 MB
    ceiling on `POST /v1/boards/import/:format`, whose own 30 MB limit answers
    400 `ARCHIVE_TOO_LARGE`) answer 413 `PAYLOAD_TOO_LARGE` without buffering past the limit. Uploads
    must match their declared type by magic bytes (`src/lib/media-sniff.ts`,
    415 `MEDIA_TYPE_MISMATCH`), count against `MEDIA_QUOTA_BYTES_PER_USER`
    (default 500 MB, 413 `MEDIA_QUOTA_EXCEEDED`, summed from `size_bytes`
    under a per-user advisory lock), and are served with `nosniff` and
    `Content-Disposition: inline`. Tested in `src/middleware/rate-limit.test.ts`
    (5 users × 150 requests from one address: no 429; the 61st bad token from
    one address: 429; 300 media reads by one user: no 429),
    `src/middleware/body-limit.test.ts` and
    `src/routes/media-hardening.routes.test.ts`.
15. **Co-editing across replicas needs Redis, and degrades loudly.** With
    `REDIS_URL` reachable the sync hub relays board events between replicas and
    counts presence globally (`syncHub: "redis"`). Without it, or with Redis
    down, it serves locally, keeps reconnecting, and `/health/ready` stays 200
    with a `syncHubWarning`; Redis never blocks startup or readiness. Tested in
    `src/ws/sync-hub.test.ts` and `src/ws/sync-hub.redis.test.ts`.
15. **Core sizes keep one motor plan.** The `core-24` (4×6), `core-36` (6×6)
    and `core-60` (6×10) templates come from ONE ordered core list per
    locale (`packages/core/src/core-grid-sizes.ts`) laid along a fixed growth
    order, and each size is the top-left block of the next: a smaller board
    is exactly the part of a larger one inside its block, so growing never
    moves a word the user learned (same row and column, same label). Only
    word-bank words, Fitzgerald part of speech kept, Mulberry symbol from the
    allow-map or label-only, no duplicate label in any locale. The vocabulary
    is pending clinical review: the template metadata says
    `vocabularyReview: "pending-clinical-review"` and the UI says so where a
    template is chosen; never claim a review that has not happened (R89).
    Changing the order or the sizes means keeping the rule, which
    `packages/core/src/core-grid-sizes.test.ts` checks for every locale and
    size. The first-run setup (`apps/web/src/components/first-run-setup.tsx`)
    builds the first board from these templates; it shows once per user and
    device on `/app` for a signed-in user with no board (never `/app/edit` or
    `/demo`), writes the existing communicator settings, and offers an
    existing board instead of a second one (no 402 dead end). Tested in
    `apps/web/src/lib/first-run.test.ts` and `e2e/specs/first-run.spec.ts`.

## Guards

Checks that keep fixed things fixed. "Unit job" is `pnpm test` in the CI
`build` job; "axe job" is the CI `a11y` job. A guard that reads nothing fails
rather than passing (each one asserts how much it read).

| Guard | What it fails on | Where it lives | Where it runs | Added |
| ----- | ---------------- | -------------- | ------------- | ----- |
| Test discovery | a tracked `*.test.*` the unit job does not run; a package test script that names files by hand; a test the old lists ran that is no longer discovered | `scripts/run-unit-tests.mjs`, `scripts/guards/test-discovery.mjs` | CI build job (`pnpm guards`, `pnpm test:guards`) | this guard set |
| Licence (ruling R86) | the removed non-commercial symbol library's name or hosts (case-insensitive) in any tracked file outside a short allowlist (history, legacy-data shim, guards, tests); a vendored symbol set (`apps/*/{public,assets}/symbols/<set>/`) without a licence file at its root or a `NOTICE` entry | `scripts/guards/licence.mjs`; also `packages/symbols/src/no-removed-symbol-hosts.test.ts` (hosts in source), `apps/web/src/symbol-credits-messages.test.ts` (credits copy) | CI build job; unit job | voxa#18, voxa#35 (OBF licence objects), this guard set |
| No direct LLM egress (ruling R88) | model-vendor API hosts and SDK imports or dependencies in `apps/` or `packages/` (the Selva client `apps/api/src/lib/selva.ts` may import an OpenAI-compatible SDK); vendor API-key variables (`OPENAI_API_KEY` style) in code, manifests or workflows anywhere | `scripts/guards/llm-egress.mjs` | CI build job | this guard set |
| Public-repo hygiene | RFC 1918 addresses (outside test fixtures and SVG path data), `*.svc.cluster.local` names, the operator SSH host pattern, Cloudflare tunnel ids, `@madfam.io` addresses other than role mailboxes. Real client names are checked by MADFAM's private estate scan, not in this repository. | `scripts/guards/hygiene.mjs` (per-rule allowlist by file) | CI build job | this guard set |
| Claims stop-list | public copy claims with nothing behind them, the retired mailbox, the upgrade dead end | `apps/web/src/lib/claims-stoplist.test.ts` | unit job | voxa#20 |
| Crawling and security headers | robots, sitemap and `llms.txt` per host; CSP, HSTS and the static header set | `apps/web/src/lib/crawling.test.ts`, `apps/web/src/lib/security-headers.test.ts`, `apps/web/src/next-config.test.ts`, `apps/api/src/middleware/security-headers.test.ts` | unit job | voxa#21 |
| Authorization regressions | namespaced app roles, org scope, read-only demo board, fail-closed dev auth | `apps/api/src/routes/authz.routes.test.ts`, `apps/api/src/lib/board-access.test.ts` | unit job | voxa#16 |
| Hardcoded UI text | user-facing literals outside the es/en/fr catalogs | `apps/web/src/hardcoded-ui-text.test.ts` | unit job | voxa#29 |
| Service worker | `sw.js` must parse as plain JavaScript and never cache `/api/*` or other origins | `apps/web/src/service-worker.test.ts` | unit job | voxa#32 |
| Image optimizer off | `/_next/image` must answer 404 | `apps/web/src/next-config.test.ts`; `scripts/launch/verify-prod-image-optimizer.sh` | unit job; axe job; after each production web deploy | voxa#13 |
| Image smoke and build identity | images on Node 22 without package managers, health 200 under the Deployment's securityContext; deploys wait until `/health` serves the commit's `build` | `.github/workflows/image-smoke.yml`, `apps/*/src/lib/build-info.test.ts`, `scripts/launch/wait-for-build.sh` | image-smoke workflow (Dockerfile, lockfile or `package.json` changes); deploy workflows | voxa#33 |
| Accessibility (axe) | serious or critical WCAG 2.2 AA violations on public pages, the editor panels, `/app` in four themes and the Spanish landing, `/demo`, `/app` and settings | `e2e/specs/a11y.spec.ts` | axe job | voxa#4, voxa#36, this guard set (Spanish) |

Guard output is `file:line rule`, never the matched text, because CI logs of
a public repository are public. To allowlist a file, add its path (not a
wildcard over the repo) to the guard's list with the reason, in the same PR.

## Deploy

| Workflow                                                     | Trigger                                                        | Effect                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `deploy-voxa-api.yml`                                        | push to `main` touching `apps/api/**`, `packages/**`; dispatch | build, cosign-sign, pin digest in `k8s/production`, wait for `/health` to serve this commit's `build` |
| `deploy-voxa-web.yml`                                        | push to `main` touching `apps/web/**`, `packages/**`; dispatch | same for web (`/api/health` `build`); then smoke `/demo` and `/_next/image` → 404 |
| `deploy-voxa-api-staging.yml`, `deploy-voxa-web-staging.yml` | push to `main` with the same paths (plus the workflow file); dispatch | build, cosign-sign, pin digest in `k8s/staging`, wait for the staging host to serve this commit's `build`; never gates production |
| `mobile-eas.yml`, `mobile-eas-submit.yml`, `ghcr-public.yml` | dispatch only                                                  | EAS build/submit, package visibility                                             |
| `e2e-smoke.yml` ("Daily smoke")                              | daily schedule; dispatch                                       | job `smoke`: read-only production checks (`verify-prod-ga`, `verify-prod-demo`, `verify-prod-redis`, which warns until Redis is bound; Playwright smoke and axe on public pages). Job `staging-signed-in`: the signed-in specs against staging; skips with a notice without the `VOXA_STAGING_*` secrets |

Argo CD auto-syncs the pinned manifests; the web pin commit also bumps the pod
template's `restartedAt`, so no workflow calls Argo or restarts pods, and no
workflow holds an identity-provider or platform credential. Each deploy
workflow has its own concurrency group. GitHub-hosted jobs are pinned to
`ubuntu-24.04`. Full runbook: [docs/deploy/ENCLII.md](./docs/deploy/ENCLII.md);
on-call: [docs/ops/RUNBOOK.md](./docs/ops/RUNBOOK.md).

Both images build from `node:22-alpine` pinned by digest (through
`mirror.gcr.io`), and their runtime stage deletes npm, npx, corepack and yarn;
nothing at runtime needs them (the API migrates in-process). `image-smoke.yml`
builds both images without pushing on changes to a Dockerfile, the lockfile or
a `package.json`, and checks Node 22, no package manager, and `/health` (API) /
`/api/health` (web) answering 200 under the Deployment's securityContext.

Build identity: the deploy workflows pass `GIT_SHA=<commit>` as a build arg,
the runner stage sets it as `GIT_SHA` (default `unknown`), and the API
`/health`, `/health/ready` and the web `/api/health` serve it as `build`
(`src/lib/build-info.ts` in each app: a 7–40 character hex id or `unknown`,
nothing else). Every deploy smoke runs `scripts/launch/wait-for-build.sh`,
which polls for up to 12 minutes (Argo CD polls git about every 3 minutes,
then the surge rollout) until `build` equals the commit, so a green deploy run
proves the new image is serving, not just that an old pod answers 200.

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
| **Production and staging do not bind `REDIS_URL` yet.** Both API Deployments read it from `voxa-secrets` (optional), but production's `/health/ready` reports `syncHub: local`, so the key is not set there (staging unverified). | With two production replicas, a co-editor on the other pod sees no live change and presence counts one pod. Data is safe (writes are compare-and-set). | P1 | Platform operator: add `REDIS_URL` (shared Redis with AUTH, this app's own DB index) to `voxa-secrets` for each environment, then `REQUIRE_REDIS=1 ./scripts/launch/verify-prod-redis.sh` | — |
| **Media bytes live in the shared PostgreSQL.** Uploads are size-capped, type-checked and quota-bound per user, but the bytes are stored in `media_assets.data`. | Large media grows the shared database, its backups and WAL. | P2 | Owner ruling (object storage behind signed URLs) | — |
| **Prettier is not enforced.** `pnpm format` exists but CI does not check it, and several files predate it.                                                                                                                   | Formatting drifts and creates noise in unrelated PRs.                                                                                                                                   | P3       | Engineering work (one reformat, then a CI check)                                | —        |
| **Selva predictions are off.** `SELVA_ENABLED` defaults to `false`, so every text suggestion comes from the local predictor. Turning it on needs a Janua service client for this edge, its id and secret delivered to the API, and a local model behind Selva for `restricted` requests. | Until then suggestions are rule-based only. Turning it on early is safe (every failure falls back to local) but pointless. | P2 | Ecosystem and operator work; no Voxa code change is needed | — |
| **Real-time board sync never connects for a signed-in user.** The API's `teamAuth()` runs on `/v1/*` and answers the `/v1/ws` upgrade with 401, because a browser WebSocket cannot send the bearer header and the token travels as `?accessToken=` (which only `src/lib/ws-auth.ts` reads, after the middleware). | The sync badge reads offline for every signed-in user, an editor's edits are queued locally instead of saved live, and changes from another device arrive only on reload. Found by `e2e/specs/access-methods.spec.ts`. | P1 | Engineering work (exempt `/v1/ws` from `teamAuth`, which `resolveWsTeam` already authenticates; or a short-lived WS ticket) | — |
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
