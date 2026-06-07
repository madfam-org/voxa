# Changelog

All notable changes to Voxa are documented here.

## [Unreleased]

### Added

- Legal pages: privacy, terms, accessibility statement, and AI consent banner
- Janua SSO: web OIDC sign-in flow, session API, API Bearer JWT verification
- PostgreSQL persistence via Drizzle ORM (`DATABASE_URL`); automatic migrations on API startup
- Store abstraction with file-backed fallback for local development
- `/health/ready` probe with database connectivity check
- API integration tests for board routes and store operations
- `docs/data-model.md`, `SECURITY.md`, GA remediation documentation

### Changed

- Deploy workflows run post-deploy smoke checks against madfam.io health and legal URLs
- Web deployments expose Janua OIDC env vars; secrets template includes OIDC_CLIENT_SECRET
- Kubernetes API readiness probes target `/health/ready`

## [0.5.0] — 2026-06

### Added

- Expo mobile app (`apps/mobile`) with offline cache
- Web service worker and IndexedDB background sync
- AI prediction strip (stub heuristics)
- Enclii deployment to madfam.io (production + staging)
- CVI themes, switch scanning, eye dwell accessibility modes
- OBF import/export and motor-planning validation

### Fixed

- API Docker image: `pnpm deploy` for runtime dependencies
- API listens on `LISTEN_HOST=0.0.0.0` for Kubernetes probes
- Junction-based tunnel routing for `voxa-api.*` hosts

## [0.2.0] — earlier

- Cloud sync API, team editing roles, WebSocket hub

## [0.1.0] — earlier

- Web prototype, core types, OBF skeleton, API scaffold
