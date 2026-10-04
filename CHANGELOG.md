# Changelog

All notable changes to Voxa are documented here. What ships today, per
capability: [docs/capabilities.md](./docs/capabilities.md).

## [Unreleased]

### Documentation

- Public docs match what ships: a capabilities page with status and evidence per row ([docs/capabilities.md](./docs/capabilities.md)), a rewritten README and architecture, the accessibility statement updated for switch scanning, voices and the first-run setup, `AGENTS.md` with its invariants numbered once and a "How a change ships" section, a `CLAUDE.md` pointer, and the served `llms.txt` plus a new `llms-full.txt` on the landing host. The June 2026 "SLP sign-off" is withdrawn: it was an internal product check, not a clinical review (ruling R89); launch records are marked historical.

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
- No admin credential in any deploy; one concurrency group per deploy workflow; a read-only daily smoke ([#22](https://github.com/madfam-org/voxa/pull/22)). Surge-first rollouts, two web replicas, PodDisruptionBudgets and a real web readiness probe ([#26](https://github.com/madfam-org/voxa/pull/26)). GitHub-hosted runners pinned to `ubuntu-24.04` ([#9](https://github.com/madfam-org/voxa/pull/9)).
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
