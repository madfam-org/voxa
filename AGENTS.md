# Voxa agent guide

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
| `apps/mobile`                   | `@voxa/mobile` — Expo SDK 52 communicator app (EAS builds).                                                                         |
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
pnpm turbo typecheck --filter='!@voxa/mobile'  # what CI runs
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
  built web app.
- Playwright: `pnpm test:e2e:smoke`, `pnpm test:e2e:a11y`,
  `pnpm test:e2e:staging`. Authenticated specs skip themselves without
  `JANUA_TEST_EMAIL`/`JANUA_TEST_PASSWORD` (or `VOXA_TEST_ACCESS_TOKEN`).

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
   migration errors are never retried.
4. **No query parameters in responses or logs.** Since drizzle-orm 0.44 a
   `DrizzleQueryError` carries the SQL and its bound parameters (board
   content, user ids, media bytes). `src/lib/db-errors.ts` (`unwrapDbError`,
   `errorMessage`) and `app.onError` strip them; use them for any error that
   reaches a response body or a log line. Tested in
   `src/lib/db-errors.test.ts`.
5. **Atomic file store.** Without `DATABASE_URL` the API keeps boards in
   `boards.json` under `VOXA_DATA_DIR` (default `./data`) and replaces it with
   temp file + `fsync` + `rename`. Do not reintroduce in-place writes.

## Deploy

| Workflow                                                     | Trigger                                                        | Effect                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `deploy-voxa-api.yml`                                        | push to `main` touching `apps/api/**`, `packages/**`; dispatch | build, cosign-sign, pin digest in `k8s/production`, smoke `/health`              |
| `deploy-voxa-web.yml`                                        | push to `main` touching `apps/web/**`, `packages/**`; dispatch | same for web                                                                     |
| `deploy-voxa-api-staging.yml`, `deploy-voxa-web-staging.yml` | push to `staging` with the same paths; dispatch                | build and pin in `k8s/staging` (not signed)                                      |
| `mobile-eas.yml`, `mobile-eas-submit.yml`, `ghcr-public.yml` | dispatch only                                                  | EAS build/submit, package visibility                                             |
| `e2e-smoke.yml`                                              | daily schedule; dispatch                                       | soak checks, scenario scripts and production GA verification (`scripts/launch/`) |

Argo CD syncs the pinned manifests. GitHub-hosted jobs are pinned to
`ubuntu-24.04`. Full runbook: [docs/deploy/ENCLII.md](./docs/deploy/ENCLII.md);
on-call: [docs/ops/RUNBOOK.md](./docs/ops/RUNBOOK.md).

## Known gaps

- `tar` 6.2.1 (critical advisory) ships inside the Expo SDK 52 CLI
  (`@expo/cli`). It is mobile build tooling only, never in the API or web
  images; the fix is an Expo SDK upgrade.
- The web app does not set `images.unoptimized`; it renders no `next/image`
  today, so the image optimizer is unused but still reachable.
- `e2e-smoke.yml`: the last recorded scheduled runs (2026-08-20 to 08-22)
  failed on the demo-board smoke, and no scheduled run is recorded since.
- Staging images are not signed; only production deploys run cosign.
- `pnpm format` (Prettier) is not enforced in CI and several files predate it.

## Related repositories and contracts

- **Janua (identity).** The API verifies Janua access tokens with `jose`
  (`src/lib/janua.ts`): JWKS from `JANUA_JWKS_URL` (default
  `${JANUA_ISSUER_URL}/.well-known/jwks.json`), `iss` = `JANUA_ISSUER_URL`,
  `aud` = `JANUA_AUDIENCE` (default `voxa`), RS256 only. Contract:
  [Janua ecosystem integration guide](https://github.com/madfam-org/janua/blob/main/docs/guides/ECOSYSTEM_INTEGRATION.md).
  Voxa setup: [docs/auth/JANUA.md](./docs/auth/JANUA.md).
- **Dhanam (billing).** `src/lib/dhanam.ts` reads entitlements from
  `GET ${DHANAM_API_URL}/api/v1/entitlements/:userId` with a service bearer
  token (`DHANAM_API_TOKEN`) and a 5 s timeout, and falls back to the free
  tier when it is unset or fails.
- **Enclii (deploy).** [Zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md).
