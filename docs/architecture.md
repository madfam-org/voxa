# Architecture

## Overview

Voxa is a TypeScript monorepo (pnpm workspaces + Turborepo): a Next.js web app,
an Expo mobile app and a Hono API, sharing the board model, vocabulary rules,
access methods and the Open Board Format layer through `packages/*`. The web
app is the product today; it runs in current browsers on phones, tablets and
computers. The mobile app builds in CI but is not in the app stores yet. What
ships, with status: [capabilities.md](./capabilities.md).

```
 Browser                                     Expo app (apps/mobile)
 ├─ landing /, /demo, /legal/*  (public)                │
 ├─ /app, /app/edit             (signed in)             │
 └─ service worker (apps/web/public/sw.js):             │
    /app shell (network first), /_next/static,          │
    icons, /symbols (cache first);                      │
    never /api/* and never another origin               │
            │                                           │
            ▼                                           │
 apps/web  Next.js 15 standalone, Node 22               │
 ├─ sign-in: Auth.js + Janua OIDC; encrypted httpOnly   │
 │  session holds the tokens (page JS never sees one)   │
 ├─ /api/v1/*  same-origin API proxy (adds the bearer)  │
 ├─ /api/media/:id   same-origin media proxy            │
 ├─ /api/health, /api/health/ready                      │
 ├─ robots.txt, sitemap.xml, llms.txt, llms-full.txt    │
 │  (host-aware: only the landing host is indexable)    │
 └─ /symbols/mulberry/**  vendored Mulberry SVGs        │
            │  REST (server-side bearer); WebSocket     │
            │  from the browser with a one-use ticket   │
            ▼                                           ▼
 apps/api  Hono on Node 22
 ├─ Janua JWKS: RS256 token verification, voxa:* application roles, voxa_tier claim
 ├─ Selva /v1/chat/completions (optional, off by default; X-Sensitivity: restricted)
 ├─ PostgreSQL (one pool per process): boards, sync events, activation counts,
 │  consents, media bytes; migrations at startup under an advisory lock
 └─ Redis (optional): board events and presence across API replicas
```

## Design principles

1. **Motor plans are stable.** Locked core slots never move silently; only an
   organization admin can override a lock, and the server enforces it. Core
   boards in different sizes share one layout, so growing a board never moves
   a learned word.
2. **Open interchange.** Open Board Format 0.1 is the import and export path;
   imports always create new boards. Other formats are beta adapters.
3. **Works through a network drop.** The open board keeps working offline,
   edits queue on the device, and `/app` reopens offline after one online visit.
4. **Accessibility by default.** Components and pages are checked with axe in
   CI before they ship.
5. **Data minimisation.** Consent per person and purpose, counts-only usage
   logging, no third-party AI calls; model suggestions, when switched on, send
   only the current partial message to MADFAM's gateway as `restricted`.
6. **Nothing claimed that does not ship.** Public text says only what `main`
   does; pending clinical review is stated, never implied away.

## Package responsibilities

| Package | Role |
|---------|------|
| `@voxa/core` | Board, button and profile types; starter templates (Core 47, Core 100, core 24/36/60, literacy keyboard, visual schedule); symbol allow-map; team-role mapping |
| `@voxa/ui` | Board grid and button components: touch targets ≥ 38 CSS px scaled by `targetScale`, 4 mm gutter, CVI themes with tested chrome colours, scan ring |
| `@voxa/obf` | Open Board Format 0.1 reader and writer (`.obf`, `.obz`), safe unzip, JSON Schemas |
| `@voxa/import-adapters` | Beta one-page imports from three other AAC file formats |
| `@voxa/vocabulary` | Fitzgerald Key, motor-plan validation, grid moves, word forms, Spanish conjugation and agreement |
| `@voxa/symbols` | Mulberry keyword index and offline es/en/fr search; legacy-reference handling |
| `@voxa/access` | Switch-scan state machine, hardware switches (keyboard and gamepad), dwell, gaze event bridge, touch activation and keyguard |
| `@voxa/sync` | API client: REST, WebSocket, save errors and the offline queue |
| `@voxa/ai` | Local rule-based predictor (English and Spanish tables) |
| `@voxa/i18n` | es (default), en and fr catalogs |

## Sync model

- **Boards** are JSON documents keyed by `boardId` with an integer `version`.
  Writes are compare-and-set: of two saves on one version, one wins and the
  other gets 409 `VERSION_CONFLICT` with the current version.
- **Roles** come only from Janua application roles: communicator (use),
  editor (`voxa:editor`, `voxa:slp`) and admin (`voxa:admin`), scoped to the
  person's organization. Owners edit their own boards; the demo board is
  read-only.
- **Sessions** (`apps/web/src/auth.ts`, [docs/auth/JANUA.md](./auth/JANUA.md)):
  Auth.js with Janua as OIDC provider; the encrypted session cookie keeps
  Janua's tokens on the server, refreshed before expiry. Page code calls the
  API through the same-origin proxy `/api/v1/*`. Sign-out ends the Janua
  session too, and switching account purges the previous account's local
  data.
- **Live updates** use a WebSocket hub that relays board events and counts
  presence. The browser opens it with a single-use ticket
  (`POST /v1/ws-ticket`, stored hashed in PostgreSQL for 30 seconds) and the
  API closes it when the access token expires. With `REDIS_URL` the hub spans
  replicas; without it each replica serves its own clients and
  `/health/ready` reports a warning.
- **Offline:** a save that cannot reach the API is queued in IndexedDB with
  the account that made it and sent when the connection returns, only for
  that account; a save the server refuses (422, 403 …) is
  shown and removed from the queue.
- **Usage counts** (optional, consent-gated) record board and button ids for
  the usage report, never what was said.

## Deployment (Enclii)

Voxa ships to **madfam.io** through Enclii (zero-touch model): Dockerfiles,
`k8s/` and GitHub Actions live in this repo; Argo CD apps and Cloudflare Tunnel
routes are managed by Enclii.

```
merge to main → deploy-voxa-{web,api}.yml          → build (GIT_SHA), cosign sign, pin digest → k8s/production
             └→ deploy-voxa-{web,api}-staging.yml  → build (GIT_SHA), cosign sign, pin digest → k8s/staging
Argo CD auto-syncs each pin; the smoke waits until /health serves the commit's build.
```

| Surface | Liveness | Readiness |
|---------|----------|-----------|
| Web | `GET /api/health` | `GET /api/health/ready` |
| API | `GET /health` | `GET /health/ready` |

Full runbook: [deploy/ENCLII.md](./deploy/ENCLII.md). Data model:
[data-model.md](./data-model.md). How a change ships:
[AGENTS.md](../AGENTS.md#how-a-change-ships).

## Technology choices

- **Monorepo:** pnpm 9 workspaces + Turborepo; Node 22 everywhere (images
  pinned by digest, no package manager at runtime).
- **Web:** Next.js 15, React 19, next-intl; per-request nonce CSP; image
  optimizer off.
- **API:** Hono on Node 22; Drizzle ORM on postgres-js, one shared pool per
  process ([connection budget](./deploy/ENCLII.md#connection-budget-contract));
  an atomic JSON-file store when `DATABASE_URL` is unset (never in production).
- **Mobile:** Expo SDK 57 (React Native 0.86), EAS builds by dispatch only.
- **Tests:** Node's test runner through `scripts/run-unit-tests.mjs` (files
  discovered), Playwright and axe for browser specs.
