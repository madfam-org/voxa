# Changelog

All notable changes to Voxa are documented here.

## [Unreleased]

### Added

- Full GA remediation plan: `docs/launch/REMEDIATION_PLAN.md` (W1–W4 waves)
- Customer migration guide: `docs/launch/MIGRATION.md` (OBF import path)
- Multi-board library: web board picker, **New board**, `VoxaClient.createBoard()`
- Per-button `hidden` flag (editor) and symbol display modes (`hideLabels`, `hideSymbols`)
- Authenticated soak checks: billing entitlement, AI consent gate, board create, OBF round-trip
- CI auth soak step in `e2e-smoke.yml` (when `VOXA_STAGING_*` secrets configured)

### Changed

- `register-janua-oauth-client.sh` is idempotent by default; `--rotate-secret` opt-in
- `soak-scenarios.sh` uses POST for AI auth gates; extended `--with-auth` coverage
- Soak fixture aligned to OBF 3.x format

### Added (prior unreleased)
- Feature parity tracker: `docs/launch/FEATURE_PARITY.md` (P0–P3 checklist, scorecard, OpenAAC alignment)
- GA roadmap Phase 6 (competitive parity) and milestone M6

### Added (prior unreleased)

- Commercial GA roadmap: `docs/launch/GA_ROADMAP.md` (phases, milestones M0–M6)
- SLP accessibility sign-off template: `docs/launch/SLP_SIGNOFF.md`
- Mobile GA path: `docs/launch/MOBILE_GA.md`, `apps/mobile/eas.json` (preview + production profiles)
- Staging soak log: `docs/launch/SOAK_LOG.md`; daily check script `scripts/launch/soak-daily-check.sh`
- GHCR visibility script: `scripts/deploy/make-ghcr-packages-public.sh`
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

- GA wrap-up doc: `docs/launch/GA_STATUS.md` (live state, platform IDs, remaining P0–P2 items)
- Runbook: GitHub → Enclii webhook 401 after secret rotation (`docs/ops/RUNBOOK.md`)

### Changed (prior unreleased)

- GA checklist and Enclii deploy runbook updated for GitHub webhook + callback token setup
- Platform webhook/callback secrets rotated; `ENCLII_CALLBACK_TOKEN` and Enclii webhook registered on `madfam-org/voxa` (hook `637900323`)
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
