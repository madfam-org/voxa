# Changelog

All notable changes to Voxa are documented here. What ships today, per
capability: [docs/capabilities.md](./docs/capabilities.md).

## [Unreleased]

### Operations docs and tests

- Availability and alerting docs say what is true ([#54](https://github.com/madfam-org/voxa/pull/54)). `replicas:` in `k8s/production` records the intended floor (web 2, API 2); the Argo CD app ignores `/spec/replicas`, so a replica change in git does not reach the cluster and the platform operator scales and verifies live (`docs/deploy/ENCLII.md`, `docs/ops/RUNBOOK.md`, `AGENTS.md` invariant 20). The runbook and deploy guide now say how an outage reaches on-call (critical platform alerts through Alertmanager and Courier), what covers Voxa today, the pending platform change that adds the production `voxa` namespace to the client availability alerting, including the critical `ClientDeploymentUnavailable` ([enclii#695](https://github.com/madfam-org/enclii/pull/695)), and that the status page is not an alert path.
- The deployment-unavailable alert now covers Voxa: since [enclii#695](https://github.com/madfam-org/enclii/pull/695) (2026-10-05) a production Voxa Deployment below its desired pods for 5 minutes pages on-call (`ClientDeploymentUnavailable`, critical); staging stays out. `docs/deploy/ENCLII.md`, `docs/ops/RUNBOOK.md` and the `AGENTS.md` pending-work list updated.
- `scripts/launch/deploy-contract.test.mjs` fails when a PodDisruptionBudget allows no voluntary disruption at its Deployment's manifest replica count (production or staging) or when production web or API drops below 2 replicas in git.

## 2026-10-05 — Sessions, settings sync and sign-in on every host

Pull requests [#39](https://github.com/madfam-org/voxa/pull/39), [#42](https://github.com/madfam-org/voxa/pull/42)–[#44](https://github.com/madfam-org/voxa/pull/44), [#46](https://github.com/madfam-org/voxa/pull/46), [#47](https://github.com/madfam-org/voxa/pull/47), [#48](https://github.com/madfam-org/voxa/pull/48) and [#49](https://github.com/madfam-org/voxa/pull/49)–[#52](https://github.com/madfam-org/voxa/pull/52), merged after the stabilization wave on 2026-10-04 and 2026-10-05 (UTC), plus this documentation and test close-out. On 2026-10-05 production served all of it (web build `f3972fb`, API build `bd4a150`, no `AUTH_URL` pin); staging pins land but do not roll out until the staging Argo CD app tracks `main`.

### Accounts and sessions

- Web sign-in moves to Auth.js with the Janua OIDC provider (code flow with PKCE, `state` and `nonce`). The session is an encrypted httpOnly cookie; page JavaScript never holds a token and calls the API only through the same-origin proxy `/api/v1/*`, which refuses cross-origin writes and forwards no cookie ([#39](https://github.com/madfam-org/voxa/pull/39)).
- Live sync connects in browsers: the WebSocket opens with a single-use, 30-second ticket (`POST /v1/ws-ticket`, stored hashed; migration `0008_ws_tickets`) and closes when the access token expires. Before this, every browser upgrade got 401 in production ([#39](https://github.com/madfam-org/voxa/pull/39)).
- Sign-out is POST-only and ends the Janua session too (RP-initiated logout). «Cambiar de cuenta» (Janua's account chooser, `prompt=select_account`) and «Entrar como otra persona» (`prompt=login`) on the sign-in page and in the app, in es/en/fr. Sign-out and both switches purge the previous account's boards, queued saves and consent copy from a shared tablet; a queued save is never sent under another account ([#39](https://github.com/madfam-org/voxa/pull/39)).
- Sign-in works on the landing and the app host and returns to the host where it started. After [#39](https://github.com/madfam-org/voxa/pull/39) every Janua callback was redirected to the server's bind address (`https://0.0.0.0:3000/…`); [#50](https://github.com/madfam-org/voxa/pull/50) pinned `AUTH_URL` as a hotfix, [#51](https://github.com/madfam-org/voxa/pull/51) rebuilds each request's URL from the allow-listed public host (`AUTH_PUBLIC_HOSTS`; any other host answers 400), and [#52](https://github.com/madfam-org/voxa/pull/52) removed the pin and made the deploy smoke strict on both hosts.
- Outside this repository: the Voxa Janua client is first-party (no consent screen) and registers the Auth.js callback and the sign-in page for each of the four web hosts; the old `/auth/callback` URIs are gone. The Janua fixes that sign-in and switching rely on are [janua#694](https://github.com/madfam-org/janua/pull/694)–[#698](https://github.com/madfam-org/janua/pull/698).

### Settings sync (opt-in)

- Communicator and access settings can follow a person between devices, only with the new `settings_sync` consent (off by default; access settings can reveal a disability). `GET/PUT /v1/me/settings` act on the signed-in user only, accept an allow-list of 28 fields, cap the body at 16 KB and write compare-and-set (409 with the current document). Turning it off deletes the server copy. The web app is local first: per-field merge (newer change wins), push after a pause, offline queue; the chosen voice stays on each device (migration `0009_user_settings`; [#47](https://github.com/madfam-org/voxa/pull/47)).

### Access and trust

- The switch-scan pause while speaking always ends: on `end` or `error`, when the engine reports idle, or after a bound from the message length (2–15 s) ([#44](https://github.com/madfam-org/voxa/pull/44)). Recorded clips and GLP video are bounded the same way (4 s without progress, or length plus 2 s; 60 s when unknown), and a clip that stalls is spoken instead ([#49](https://github.com/madfam-org/voxa/pull/49)).
- The public demo never blocks communication: the sales dialog is gone; a call to action below the board shows after five spoken messages or on request and never takes focus on its own ([#44](https://github.com/madfam-org/voxa/pull/44)).
- The editor PIN is stored as a salted PBKDF2-SHA-256 hash; a plain PIN from an earlier version is migrated on its next unlock ([#44](https://github.com/madfam-org/voxa/pull/44)).
- Copy (es/en/fr): the landing hero and the dwell setting say what ships (direct touch, switch scanning or pointer dwell; an eye tracker works only when its own software moves the pointer); the claims stop-list rejects gaze listed as an input of its own ([#49](https://github.com/madfam-org/voxa/pull/49)).
- One product sentence everywhere: README, `AGENTS.md`, `llms.txt`, both `package.json` descriptions and the served `llms.txt` / `llms-full.txt` open with the same one-liner, and a test fails when they drift ([#44](https://github.com/madfam-org/voxa/pull/44), [#49](https://github.com/madfam-org/voxa/pull/49)).
- Copy (es/en/fr): the classic light theme is described without a competitor's product name; Spanish says "terapeutas de lenguaje". `LICENSE` names Innovaciones MADFAM S.A.S. de C.V., as `NOTICE` does ([#42](https://github.com/madfam-org/voxa/pull/42)).

### Operations and CI

- API rollouts drain on `SIGTERM`: readiness turns 503, WebSockets get a 1001 close frame, requests in flight finish, then Redis and the database pool close; a second signal or the 20 s deadline (`SHUTDOWN_DEADLINE_MS`) exits 1 ([#43](https://github.com/madfam-org/voxa/pull/43)).
- CI fails when the PostgreSQL or Redis suites cannot run, instead of passing with them skipped ([#43](https://github.com/madfam-org/voxa/pull/43)).
- Workflows: read-only token by default with per-job grants, superseded pull-request runs cancelled, every action pinned to a commit SHA with its version, Dependabot keeping them current, and a repository guard ([#43](https://github.com/madfam-org/voxa/pull/43)). The reviewed action majors are taken; `sigstore/cosign-installer` is held at v3 because the cluster's Kyverno does not verify cosign v3 signatures yet, and Dependabot ignores its majors ([#46](https://github.com/madfam-org/voxa/pull/46)); its grouped minor update moved the installer to v3.10.1, which still installs cosign v2 ([#48](https://github.com/madfam-org/voxa/pull/48)).
- Web deploys run the strict sign-in host smoke (`scripts/launch/verify-auth-public-origin.sh`, `VERIFY_SAME_HOST=1`) on both hosts of each environment, after the build-identity wait ([#51](https://github.com/madfam-org/voxa/pull/51), [#52](https://github.com/madfam-org/voxa/pull/52)).

### Documentation and tests (this close-out)

- Public docs match what ships: a capabilities page with status and evidence per row, the accessibility statement, `AGENTS.md` (invariants 1–19, the guards table, how a change ships, including the two-step rule for environment changes against image rollouts), `docs/auth/JANUA.md` (the final sign-in model, the Janua client and a troubleshooting table), `docs/deploy/ENCLII.md` (deploy smokes, Kyverno exceptions, the cosign hold) and the data model (`ws_tickets`). The June 2026 "SLP sign-off" stays withdrawn (ruling R89) ([#42](https://github.com/madfam-org/voxa/pull/42) and this close-out).
- `scripts/launch/deploy-contract.test.mjs` fails when a web manifest sets `AUTH_URL`, when a deploy workflow's auth smoke is not strict or names other hosts than the manifest's `AUTH_PUBLIC_HOSTS`, and when a deploy workflow moves cosign-installer off v3.
- The daily production smoke matches catalog labels in any locale instead of English strings (on 2026-10-03 it failed when `/demo` rendered in Spanish).

### Changes for API clients

- New: `POST /v1/ws-ticket`; `GET /v1/ws` takes only `ticket=` (no `accessToken=`, no `Authorization`, no development headers) ([#39](https://github.com/madfam-org/voxa/pull/39)).
- New: `GET/PUT /v1/me/settings` (403 `CONSENT_REQUIRED`, 409 `VERSION_CONFLICT`, 428 without a version, 413 `PAYLOAD_TOO_LARGE`) and the consent purpose `settings_sync` ([#47](https://github.com/madfam-org/voxa/pull/47)).

### Known gaps after this release

Staging's Argo CD app still tracks a deleted branch (staging keeps a June build), Redis is not bound in production, paid tiers cannot be granted yet, the privacy policy does not list the `settings_sync` purpose, the Kyverno signature exceptions wait on [#34](https://github.com/madfam-org/voxa/pull/34), the mobile app has no store build, and the clinical review is pending. The prioritized list is in [AGENTS.md](./AGENTS.md#pending-work-and-known-gaps).

## 2026-10-04 — Stabilization and compliance wave

Pull requests [#8](https://github.com/madfam-org/voxa/pull/8)–[#41](https://github.com/madfam-org/voxa/pull/41), merged 2026-10-01 to 2026-10-04 (UTC). Every change below is on `main` and deployed to production (staging pins land too, and roll out once the staging Argo CD app tracks `main`).

### Honest product and copy

- Public copy (es/en/fr) says only what the code backs: no SLA, priority sync, "full AI", per-user dashboards, care-team invites, "offline-ready", eye-tracker integrations or release review by speech therapists; a stop-list test keeps them out. Contact mailbox `hola@madfam.io`. Paid-plan buttons go to a discovery call (`kalya.app/madfam`) until a checkout exists; prices stay visible ([#20](https://github.com/madfam-org/voxa/pull/20), [#36](https://github.com/madfam-org/voxa/pull/36)).
- Eye gaze: the app and statement describe what ships — dwell for devices that move the pointer and the `voxa:gaze` event bridge for integrators ([#36](https://github.com/madfam-org/voxa/pull/36)).
- Commercial research and operator-only material moved to MADFAM's private operations repository; deploy, on-call, backup and auth docs generalized for a public repository ([#15](https://github.com/madfam-org/voxa/pull/15)).

### Symbols and licensing

- The full Mulberry Symbols set (3,436 SVG, CC BY-SA 4.0) replaces the non-commercial library on every surface: offline es/en/fr search (Spanish keywords for 450 symbols, pending clinical review), credits page `/legal/symbols`, `NOTICE`, OBF `license` objects on exported images; old references render label-only ([#17](https://github.com/madfam-org/voxa/pull/17), [#18](https://github.com/madfam-org/voxa/pull/18), [#19](https://github.com/madfam-org/voxa/pull/19)).
- Core words get a Mulberry symbol only where the picture matches the word in es-MX, en-US and fr-FR; otherwise the label shows ([#17](https://github.com/madfam-org/voxa/pull/17)).

### Spanish first

- Spanish starter content (Core 47, Core 100, literacy keyboard with Spanish letters, visual schedule) and speech in the board's language ([#17](https://github.com/madfam-org/voxa/pull/17)).
- Spanish agreement as the message is built ("yo querer beber" → "yo quiero beber"), with a Base form toggle and a setting; a fully translated communicator and editor with an in-app dialog instead of browser prompts, guarded against hard-coded text ([#29](https://github.com/madfam-org/voxa/pull/29)).
- Spanish word suggestions in the local predictor; French gets none rather than English ([#28](https://github.com/madfam-org/voxa/pull/28)).

### Boards, access methods and voices

- Core boards in 24, 36 and 60 cells with one motor plan, and a first-run setup that builds the first board ([#41](https://github.com/madfam-org/voxa/pull/41)).
- Switch scanning that never traps (Back position, automatic return), auto and step scan, first-item hold, acceptance time, post-selection pause; a scan highlight visible on every theme; light themes at AA contrast; moving buttons in the editor by tap or arrow keys ([#36](https://github.com/madfam-org/voxa/pull/36)).
- Voice choice per language with rate, pitch and volume, install guidance, and one speech path for every utterance ([#38](https://github.com/madfam-org/voxa/pull/38)).
- Offline start of `/app` (a working service worker), uploaded media through a same-origin proxy, GLP video in a visible dialog, and a spoken fallback for recordings ([#32](https://github.com/madfam-org/voxa/pull/32)).

### Open Board Format

- Spec OBF 0.1 and OBZ export and import; imports create new boards and never overwrite; safe unzip; embedded media kept, remote pictures never fetched; beta one-page imports from three other AAC formats, labelled as such; a plan-limit notice instead of a generic error ([#35](https://github.com/madfam-org/voxa/pull/35)).

### Identity, roles and plans

- Roles only from namespaced Janua application roles (`voxa:admin`, `voxa:editor`, `voxa:slp`), scoped to the token's organization; owners edit their own boards; the demo board is read-only; development headers never work in production ([#16](https://github.com/madfam-org/voxa/pull/16)).
- Plan limits from the Janua `voxa_tier` claim instead of a per-request billing call; a missing or unknown claim resolves to `free` ([#23](https://github.com/madfam-org/voxa/pull/23)).

### Privacy and consent

- Consent as a server-side record per person and purpose; usage logging stores counts only; spoken text only for an allow-listed organization with a separate opt-in, cleared after 90 days; owners can delete a board's usage history ([#24](https://github.com/madfam-org/voxa/pull/24)).
- Text stored before server-side consent was cleared by migration `0005` ([#25](https://github.com/madfam-org/voxa/pull/25)).

### Word suggestions

- No third-party LLM call: suggestions come from the local predictor ([#20](https://github.com/madfam-org/voxa/pull/20)); an optional path through Selva, MADFAM's model gateway (`X-Sensitivity: restricted`, partial utterance only), is built and off by default ([#28](https://github.com/madfam-org/voxa/pull/28)).

### API robustness and sync

- Rate limits that never throttle signed-in users by address, body limits, compare-and-set board writes (409 on a lost race), scoped SQL for lists and plan counts, fail-closed file store in production, media type and quota checks, admin-only motor-plan override on the server, board `layout` and `display` persisted (they were dropped by the PostgreSQL store), and a Redis sync hub that degrades loudly ([#37](https://github.com/madfam-org/voxa/pull/37)).
- Migrations journaled and drift-checked, one database pool per process, atomic file store, startup connection retry ([#10](https://github.com/madfam-org/voxa/pull/10), [#11](https://github.com/madfam-org/voxa/pull/11), [#12](https://github.com/madfam-org/voxa/pull/12)).

### Security and edge

- Host-aware `robots.txt`, `sitemap.xml` and `llms.txt` (only the landing host is indexable); nonce CSP, HSTS and the static header set on web; secure headers and an exact CORS allow-list on the API ([#21](https://github.com/madfam-org/voxa/pull/21)).
- Next image optimizer off and smoke-checked ([#13](https://github.com/madfam-org/voxa/pull/13)); dependency advisories cleared outside the mobile tree ([#8](https://github.com/madfam-org/voxa/pull/8), [#27](https://github.com/madfam-org/voxa/pull/27)) and in it with Expo SDK 57 ([#31](https://github.com/madfam-org/voxa/pull/31)).

### Mobile

- Expo SDK 57, EAS configuration from the environment (no committed identifiers), symbols on the mobile communicator, and a credential-free bundle check in CI ([#31](https://github.com/madfam-org/voxa/pull/31)).

### Delivery and CI

- Images on Node 22 pinned by digest with no package manager at runtime; deploys wait until `/health` serves the commit's `build`; an image smoke on pull requests ([#33](https://github.com/madfam-org/voxa/pull/33)).
- Staging rebuilds from `main` beside production, signed like production, and hosts the signed-in specs; it never gates production ([#30](https://github.com/madfam-org/voxa/pull/30)).
- No admin credential in any deploy; one concurrency group per deploy workflow; a read-only daily smoke ([#22](https://github.com/madfam-org/voxa/pull/22)). Surge-first rollouts, two web replicas, PodDisruptionBudgets and a real web readiness probe ([#26](https://github.com/madfam-org/voxa/pull/26)). *Correction (2026-10-05): #26 changed `replicas:` in the manifest only; the Argo CD app ignores `/spec/replicas`, so production web ran one pod until the platform operator scaled it to two on 2026-10-05. The live count is the operator's to scale (see Unreleased).* GitHub-hosted runners pinned to `ubuntu-24.04` ([#9](https://github.com/madfam-org/voxa/pull/9)).
- Unit tests discovered instead of listed; axe on the Spanish pages; licence, LLM-egress and public-repo hygiene guards ([#40](https://github.com/madfam-org/voxa/pull/40)). `AGENTS.md` and its pending-work list ([#12](https://github.com/madfam-org/voxa/pull/12), [#14](https://github.com/madfam-org/voxa/pull/14)).

### Changes for API clients

- `GET /v1/billing/entitlement` answers `{ tier, features, source: "janua" }` (was `{ entitlement: { … } }`) ([#23](https://github.com/madfam-org/voxa/pull/23)).
- `POST /v1/boards/import/:format` creates new boards; the old `POST /v1/boards/:id/import/*` answers 410 ([#35](https://github.com/madfam-org/voxa/pull/35)).
- The `X-Voxa-AI-Consent` header grants nothing; use `PUT /v1/consents` ([#24](https://github.com/madfam-org/voxa/pull/24)). `/v1/sync/events` is removed ([#16](https://github.com/madfam-org/voxa/pull/16)).
- New error codes: 409 `VERSION_CONFLICT`, 403 `MOTOR_PLANNING_OVERRIDE_FORBIDDEN`, 413 `PAYLOAD_TOO_LARGE`, `MEDIA_TOO_LARGE` (was 400) and `MEDIA_QUOTA_EXCEEDED`, 415 `MEDIA_TYPE_MISMATCH`, 429 `RATE_LIMITED` ([#37](https://github.com/madfam-org/voxa/pull/37)); `POST /v1/boards` answers 400 for an unknown `templateId` ([#41](https://github.com/madfam-org/voxa/pull/41)).

### Known gaps after this wave

Live updates between devices do not connect in browsers yet, Redis is not bound in production, paid tiers cannot be granted yet, the mobile app has no store build, and the clinical review is pending. The prioritized list is in [AGENTS.md](./AGENTS.md#pending-work-and-known-gaps).

## 2026-06 — GA preparation (previously listed under Unreleased)

### Added

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
