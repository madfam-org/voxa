# Changelog

All notable changes to Voxa are documented here.

## [Unreleased]

### Added

- API: text predictions can come from Selva, the ecosystem model gateway, when `SELVA_ENABLED=true` (default `false`). Requests carry `X-Sensitivity: restricted` and only the current partial utterance, authenticate with a cached Janua `client_credentials` token, and fall back to the local predictor on any failure (`source: "local"`; `source: "selva"` when Selva answered). The `ai_processing` consent check still runs first. Symbol predictions stay local.
- Local predictor: a Spanish (es-MX) core-vocabulary continuation table, chosen by the board locale, so Spanish boards get Spanish suggestions instead of English "please"/"now". Pending review by a credentialed speech-language pathologist. Languages without a table (French) get no text suggestions rather than English ones.

### Changed

- Consent is a server-side record per user and purpose (`GET/PUT /v1/consents`, tables `consents` and `consent_events`), replacing the client-supplied `X-Voxa-AI-Consent` header, which no longer grants anything. Prediction routes need `ai_processing`; activations need `usage_analytics` and store counts only. Spoken text is kept only under a separate `utterance_text` consent for organizations on the `VOXA_UTTERANCE_TEXT_DPA_ORG_IDS` allow-list (empty by default), and opted-in text is cleared after 90 days. The web banner and Settings show two separate choices (word suggestions, usage counts) and save them to the server; `localStorage` is an offline cache.
- Activations on the shared `demo-core` board answer 403. A board owner can delete the board's activation history (`DELETE /v1/events/activations?boardId=`).
- Startup migrations hold a PostgreSQL advisory lock, so processes that start together do not race.
- API: plan entitlements come from the `voxa_tier` claim of the verified Janua access token (`free`, `family`, `clinic`) instead of a per-request call to the billing API, which answered for no user, so everyone silently got the free tier. A missing, malformed or unknown claim still resolves to `free` and is logged. `GET /v1/billing/entitlement` now answers `{ tier, features, source: "janua" }` (previously `{ entitlement: { … } }`). `DHANAM_API_URL` and `DHANAM_API_TOKEN` are no longer read.
- Migration `0005_purge_legacy_utterance_text` clears `activation_events.speech_text` on rows recorded before server-side consent existed (irreversible; count rows stay). Count-only dry run: `apps/api/scripts/legacy-utterance-text-dry-run.sql`.

### Security

- Dependencies: cleared the advisories outside the mobile app. API: `@sentry/node` 8 → 10, which moves `@opentelemetry/core` to 2.x (GHSA-8988-4f7v-96qf; Sentry 8 and 9 have no fixed release). Dev tooling: `drizzle-kit` 0.30 → 0.31 and esbuild overrides for `@esbuild-kit/core-utils` and `tsx` (GHSA-67mh-4wv8-2f99, GHSA-g7r4-m6w7-qqqr). Web build: `postcss` used by `next` → 8.5.28 (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp). Root dev tool: `body-parser` 2.3.0 and `qs` 6.16.0 under the shadcn CLI (GHSA-v422-hmwv-36x6, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g). Each override is noted in `package.json` under `//pnpm.overrides`. The mobile app's Expo tree is unchanged and waits for the Expo SDK upgrade.

### Removed

- CI: the production web deploy no longer logs in to the identity provider with an admin account to sync Argo CD and restart pods; Argo CD auto-syncs the digest pin, which already bumps the pod template's `restartedAt`. The three scripts that step used (`scripts/deploy/*`) and the June GA soak-window tools (`soak-window-progress.sh`, `soak-status.sh`, `verify-soak-window.sh`, `setup-staging-soak-secrets.sh`) moved to MADFAM's private operations repository.
- CI: the daily smoke no longer appends to `docs/launch/SOAK_LOG.md` or pushes to `main`; its permissions are read-only.
- Commercial research (pricing strategy, competitor benchmark, feature-parity scorecard, survey payloads), the GA status record with platform identifiers, the GHCR org-admin procedure and the operator-only scripts under `scripts/deploy/` and `scripts/launch/` that no workflow runs. They moved to MADFAM's private operations repository; the deploy, on-call, backup and auth docs were generalized for a public repo. `scripts/deploy/restart-voxa-web.sh` now reads the Enclii service id from `VOXA_WEB_SERVICE_ID` / `VOXA_STAGING_WEB_SERVICE_ID` and fails closed when it is unset.

### Fixed

- Local predictor: a continuation is appended to the whole message ("I want" → "I want more") instead of replacing its last word ("i more").
- CI: staging rebuilds from `main`. The `staging` branch was deleted, so the staging deploy workflows never ran and staging stayed on a June build. They now run on every push to `main` that touches their app (the same paths as production), cosign-sign the image like production and pin its digest in `k8s/staging/`, with their own concurrency groups and build-cache scope, so they never block or change a production deploy. The staging Argo CD app must be pointed at `main` by a platform operator (see `docs/deploy/ENCLII.md`).
- CI: the daily smoke runs the signed-in specs (`staging-auth`, `clinical-workflow`, `editor-workflow`, `media-workflow`, `offline-sync`) against staging in a separate job, and skips with a notice when the `VOXA_STAGING_*` secrets are absent. The production read-only job is unchanged.
- E2E: helpers and signed-in specs match catalog-backed labels in every locale (`e2e/helpers/i18n.ts`), since `/app` renders in Spanish by default; `saveBoardAndWait` clicked an English "Save" that does not exist there. The accessibility-settings helper waits for the panel's real name, and the e2e package now type-checks.
- CI: each deploy workflow has its own concurrency group. The shared web+API group let one workflow's pending run displace the other's, so a merge could leave production web without the change while its API deploy succeeded.
- CI: the daily smoke (`e2e-smoke.yml`, now "Daily smoke") runs only checks that mean something today: production GA gate, production demo, Redis readiness (warning), and Playwright smoke plus axe on production public pages.
- Web: paid-plan calls to action (Family, Institutional, demo gate) go to a discovery call at `https://kalya.app/madfam` until a checkout exists; the `/app?upgrade=family` dead end and the unused checkout URL builder are removed. Prices stay visible.
- API: predictions come only from the in-process local predictor (`source: "local"`); the optional third-party LLM backend is removed. The suggestion strip is labelled as basic suggestions.
- Copy (es/en/fr): removed or reworded claims with nothing behind them (SLA, priority sync, full AI and GLP workflows, per-end-user dashboards, care-team invites and team roles, offline-ready, eye-dwell, centrally enforced AI policy, release review by speech therapists). Contact mailbox is `hola@madfam.io`. A stop-list test guards the catalogs.
- Web: the institutional total applies IVA to the whole net total and rounds up to the peso; the per-seat line shows the net parts.
- API: migration `0003_media_assets` is now listed in the drizzle journal (it was never applied by the startup migrator, so `media_assets` was missing on migrator-built databases); it is idempotent for databases that already have the table. Drizzle snapshots added so `db:generate` diffs against the real schema; CI fails on migration/journal/snapshot drift.
- API: the media store (`POST/GET /v1/media`) and activation events opened a new PostgreSQL pool on every request and never closed it. The API now uses one process-wide pool (default 5 connections, `DATABASE_POOL_MAX`), shared with the board store and closed on shutdown.
- API: the JSON file store (used when `DATABASE_URL` is unset) rewrote `boards.json` in place, so a concurrent reader or a restart after a crash mid-write could see a truncated file. Writes are now atomic (temp file, `fsync`, `rename`). The directory is configurable with `VOXA_DATA_DIR`, and the API test suite gives every parallel test process its own directory, which removes the intermittent `Unexpected end of JSON input` test failures.
- API: a transient connection refusal at startup no longer exits the process on the first attempt. Startup migrations retry connection-level errors with backoff for up to `DATABASE_STARTUP_RETRY_MS` (default 30 s); SQL and migration errors still fail immediately.
- API: `db:migrate` scrubs query parameters from its error output, like the server does.

### Added

- Web: `robots.txt`, `sitemap.xml` and `llms.txt` are public and host-aware. Only hosts in `VOXA_INDEXABLE_HOSTS` (production: the landing host) are crawlable, with the named AI crawlers allowed on the public pages and `/app`, `/auth`, `/api` disallowed; every other host answers `Disallow: /`. The API answers `Disallow: /`.
- Web: per-request nonce Content-Security-Policy (no third-party origins), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (camera and microphone for this origin only), `X-Frame-Options: DENY`, no `X-Powered-By`. Pages render per request so the nonce reaches Next.js scripts.
- API: secure headers (nosniff, frame deny, referrer, HSTS, deny-all CSP, same-site CORP) and an exact CORS allow-list from `CORS_ALLOWED_ORIGINS` (no subdomain wildcard).
- `AGENTS.md` and `llms.txt`; CI runs the PostgreSQL-backed API test against a `postgres:16` service container.
- Full GA remediation plan: `docs/launch/REMEDIATION_PLAN.md` (W1–W4 waves)
- Customer migration guide: `docs/launch/MIGRATION.md` (OBF import path)
- Multi-board library: web board picker, **New board**, `VoxaClient.createBoard()`
- Per-button `hidden` flag (editor) and symbol display modes (`hideLabels`, `hideSymbols`)
- Authenticated soak checks: billing entitlement, AI consent gate, board create, OBF round-trip
- CI auth soak step in `e2e-smoke.yml` (when `VOXA_STAGING_*` secrets configured)

### Changed

- Sign-out route accepts GET (fixes `/auth/signout` link)
- `e2e-smoke.yml` appends daily soak log and runs staging UX/auth Playwright specs
- `soak-scenarios.sh` uses POST for AI auth gates; extended `--with-auth` coverage
- Soak fixture aligned to OBF 3.x format

### Added (prior unreleased)
- Feature parity tracker (P0–P3 checklist; moved to the private operations repository on 2026-10-03)
- GA roadmap Phase 6 (competitive parity) and milestone M6

### Added (prior unreleased)

- Janua duplicate OAuth cleanup script (operator-only; moved to the private operations repository on 2026-10-03)
- Staging soak secrets helper: `scripts/launch/setup-staging-soak-secrets.sh`
- Playwright staging soak: `e2e/specs/staging-ux.spec.ts`, `staging-auth.spec.ts`, Janua login helper
- SLP accessibility sign-off template: `docs/launch/SLP_SIGNOFF.md`
- Mobile GA path: `docs/launch/MOBILE_GA.md`, `apps/mobile/eas.json` (preview + production profiles)
- Staging soak log: `docs/launch/SOAK_LOG.md`; daily check script `scripts/launch/soak-daily-check.sh`
- GHCR visibility script (org admin; moved to the private operations repository on 2026-10-03)
- `@axe-core/playwright` e2e suite: `e2e/specs/a11y.spec.ts`, CI `a11y` job on PR/main
- `e2e` workspace in `pnpm-workspace.yaml` (fixes `pnpm test:e2e`)

### Changed

- `BoardGrid` uses proper ARIA `grid` → `row` → `gridcell` structure (axe / WCAG)
- Staging soak window opened (2026-06-08 → 2026-06-15); `e2e-smoke` runs soak + axe daily
- GA checklist/status/README updated for roadmap and remaining launch gates

### Known / ops follow-up

- GHCR public visibility (org admin); then remove `k8s/*/signature-policyexception.yaml`
- PgBouncer RBAC; SLP sign-off after soak; mobile EAS builds

### Added (prior unreleased)

- GA wrap-up doc (live state and remaining P0–P2 items; moved to the private operations repository on 2026-10-03)
- Runbook: GitHub → Enclii webhook 401 after secret rotation (`docs/ops/RUNBOOK.md`)

### Changed (prior unreleased)

- GA checklist and Enclii deploy runbook updated for GitHub webhook + callback token setup
- Platform webhook/callback secrets rotated; `ENCLII_CALLBACK_TOKEN` and Enclii webhook registered on `madfam-org/voxa`
- Enclii webhook signature verified (2026-06-08)

## [1.0.0] — 2026-06-06

### Added

- Tenant isolation: board ownership, access control on all board routes
- Dhanam entitlements integration (`/v1/billing/entitlement`, board limits)
- Consent-gated AI API (`/v1/ai/predict/*`) with optional OpenAI LLM backend
- Rate limiting and production CORS (madfam.io origins)
- Sentry optional init via `SENTRY_DSN`
- Playwright e2e smoke tests (`e2e/`)
- Ops runbooks: `docs/ops/RUNBOOK.md`, `docs/ops/BACKUP_RESTORE.md`
- Migration `0001_tenant_isolation` (`owner_user_id`, `org_id`, `board_members`)

### Changed

- API version `1.0.0`; web predictions call API when consent granted
- Free tier includes stub AI via consent-gated API

## [0.5.0] — 2026-06

### Added

- Legal pages: privacy, terms, accessibility statement, and AI consent banner
- Janua SSO: web OIDC sign-in flow, session API, API Bearer JWT verification
- PostgreSQL persistence via Drizzle ORM (`DATABASE_URL`); automatic migrations on API startup
- Store abstraction with file-backed fallback for local development
- `/health/ready` probe with database connectivity check
- API integration tests for board routes and store operations
- `docs/data-model.md`, `SECURITY.md`, GA remediation documentation
- Expo mobile app (`apps/mobile`) with offline cache
- Web service worker and IndexedDB background sync
- AI prediction strip (stub heuristics)
- Enclii deployment to madfam.io (production + staging)
- CVI themes, switch scanning, eye dwell accessibility modes
- OBF import/export and motor-planning validation

### Changed

- Deploy workflows run post-deploy smoke checks against madfam.io health and legal URLs
- Web deployments expose Janua OIDC env vars; secrets template includes OIDC_CLIENT_SECRET
- Kubernetes API readiness probes target `/health/ready`

### Fixed

- API Docker image: `pnpm deploy` for runtime dependencies
- API listens on `LISTEN_HOST=0.0.0.0` for Kubernetes probes
- Junction-based tunnel routing for `voxa-api.*` hosts

## [0.2.0] — earlier

- Cloud sync API, team editing roles, WebSocket hub

## [0.1.0] — earlier

- Web prototype, core types, OBF skeleton, API scaffold
