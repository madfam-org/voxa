# Changelog

All notable changes to Voxa are documented here.

## [Unreleased]

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
