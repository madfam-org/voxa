# Enclii deployment runbook for Voxa

Voxa deploys to **madfam.io** via Enclii using the [zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md): Dockerfiles, `k8s/`, CI, and `enclii.yaml` live in this repo. ArgoCD apps are registered by Enclii runtime onboarding (`onboard/ensure`); tunnel routing uses junctions on `voxa-web` / `voxa-api` services.

**Commercial GA:** [GA_ROADMAP.md](../launch/GA_ROADMAP.md) · [GA_CHECKLIST.md](../launch/GA_CHECKLIST.md) · [GA_STATUS.md](../launch/GA_STATUS.md)

## Architecture

```
GitHub (madfam-org/voxa)
  ├── push main     → deploy-voxa-{web,api}.yml build, sign, digest commit → k8s/production
  ├── push staging  → deploy-voxa-{web,api}-staging.yml build, digest commit → k8s/staging
  └── lifecycle callback → api.enclii.dev

Enclii (ArgoCD + Cloudflare Tunnel)
  ├── voxa.madfam.io              → voxa-web (production)
  ├── voxa-app.madfam.io          → voxa-web (production)
  ├── voxa-api.madfam.io          → voxa-api (production)
  ├── voxa-staging.madfam.io      → voxa-web (staging)
  ├── voxa-app-staging.madfam.io  → voxa-web (staging)
  └── voxa-api-staging.madfam.io  → voxa-api (staging)
```

Routing uses Cloudflare Tunnel to cluster services (`http://voxa-web.{namespace}.svc.cluster.local:80`). There is **no Ingress** in this repo.

## Prerequisites

1. **GitHub integration** on `madfam-org/voxa`:
   - **Webhook** → `https://api.enclii.dev/v1/webhooks/github` (HMAC secret = the platform's GitHub webhook secret)
   - **`ENCLII_CALLBACK_TOKEN`** — lifecycle events from Actions to Enclii (the platform's callback token)

   Setup scripts (values come from the platform operator, never from this repo):

   ```bash
   ENCLII_WEBHOOK_SECRET='…' ./scripts/deploy/setup-github-webhook.sh
   ENCLII_CALLBACK_TOKEN='…' ./scripts/deploy/setup-github-secrets.sh
   ```

   Deploy workflows use the built-in `GITHUB_TOKEN` for GHCR push and digest commits (`contents: write`, `packages: write`). No `MADFAM_BOT_PAT` is required unless you prefer a dedicated bot account.

2. **Workflow permissions** — ensure Actions can write to the repo (Settings → Actions → General → Workflow permissions: *Read and write*).

3. **Enclii CLI** logged in (`enclii login`) or API token with admin scope.

## First-time onboarding

1. Merge deployment scaffolding to `main`.

2. Trigger production image builds (Actions → *Deploy Voxa Web/API* → Run workflow), or push a change under `apps/web` and `apps/api`. Wait for digest-pinned commits in `k8s/production/kustomization.yaml`.

3. Preflight:
   ```bash
   enclii onboard --repo madfam-org/voxa --project voxa \
     --manifest-path k8s/production --preflight
   ```

4. Full production onboard (optional DB when moving off JSON file store):
   ```bash
   enclii onboard --repo madfam-org/voxa --project voxa \
     --manifest-path k8s/production \
     --secret-name voxa-secrets \
     --db-name voxa \
     --db-password "$(openssl rand -base64 32)" \
     --secrets-file ./deploy/secrets.env.example
   ```

5. **Staging** — `voxa-staging-services` ArgoCD app tracks branch `staging` and `k8s/staging/` (registered at runtime via `POST /v1/admin/onboard/ensure`, not via Enclii `infra/argocd/projects/` entries).

## Day-to-day deploys

Four workflows build and pin images. Each runs on `workflow_dispatch` and on a push to its branch that touches its app, `packages/**` or its Dockerfile:

| Workflow | Branch | Paths | Signs (cosign) | Pins digests in |
|----------|--------|-------|----------------|-----------------|
| `deploy-voxa-api.yml` | `main` | `apps/api/**`, `packages/**` | yes | `k8s/production/` |
| `deploy-voxa-web.yml` | `main` | `apps/web/**`, `packages/**` | yes | `k8s/production/` |
| `deploy-voxa-api-staging.yml` | `staging` | `apps/api/**`, `packages/**` | no | `k8s/staging/` |
| `deploy-voxa-web-staging.yml` | `staging` | `apps/web/**`, `packages/**` | no | `k8s/staging/` |

The production workflows share the `voxa-kustomization-production` concurrency group and the pin step retries up to 3 times (fetch, reset to `origin/main`, re-apply the digest). They then smoke the public health URL and fail loudly if an image was pushed but never pinned. A docs-only change (root `*.md`, `docs/**`) deploys nothing. All GitHub-hosted jobs are pinned to `ubuntu-24.04`.

| Environment | Branch | Manifests | Domains |
|-------------|--------|-----------|---------|
| Production | `main` | `k8s/production/` | `voxa.madfam.io`, `voxa-app.madfam.io`, `voxa-api.madfam.io` |
| Staging | `staging` | `k8s/staging/` | `voxa-staging.madfam.io`, `voxa-app-staging.madfam.io`, `voxa-api-staging.madfam.io` |

ArgoCD syncs after digest commits. Check status at [app.enclii.dev](https://app.enclii.dev) and the Enclii status page entries declared in `enclii.yaml`.

## Health checks

| Service | Probe path | Test |
|---------|------------|------|
| Web | `GET /api/health` | `apps/web/src/app/api/health/route.test.ts` |
| API | `GET /health` | `apps/api/src/health.test.ts` |

Run locally: `pnpm test`

## Constraints (Kyverno / Enclii)

- Images must be pinned with `@sha256:` digests in **both** `kustomization.yaml` and workload deployment YAML (CI keeps them in sync).
- Docker builds use `provenance: false` and `sbom: false`.
- Do **not** add `NetworkPolicy` resources — use `network` in `enclii.yaml`.
- Service port **80** in K8s maps to container ports 3000 (web) and 8080 (api).

## Troubleshooting

### Deploy workflow fails at checkout with “could not read Username”

The repo is missing secrets. Deploy workflows use `GITHUB_TOKEN` (no `MADFAM_BOT_PAT` required). Ensure **Settings → Actions → General → Workflow permissions** is set to **Read and write**.

### Onboarding fails on `argocd_config` (forbidden: create applications)

Production Enclii uses **runtime** ArgoCD registration. If `switchyard-api` lacks RBAC to create `applications.argoproj.io` in namespace `argocd`, onboarding partially completes (namespace, domains, network policies) but workloads never sync.

**Platform fix:** grant `switchyard-api` `create`/`update` on ArgoCD Applications (same class of fix as [PHYND RBAC runbook](https://github.com/madfam-org/enclii/blob/main/docs/runbooks/PHYND_APP_ENCLII_BLOCKERS_2026-05-14.md)), then re-run:

```bash
enclii onboard --repo madfam-org/voxa --project voxa --manifest-path k8s/production
# or POST /v1/admin/onboard/ensure
```

### Image gate rejects onboarding (`image must be digest-pinned`)

Workload `Deployment` YAML must contain `@sha256:` references, not short names like `voxa-web`. CI updates both `kustomization.yaml` and the deployment files on each build.

### Kyverno blocks sync (`verify-image-signatures`, GHCR DENIED)

Until `ghcr.io/madfam-org/voxa/voxa-web` and `voxa-api` are **public** GitHub Packages, Kyverno keyless verification cannot pull manifests. A temporary `PolicyException` in `k8s/*/signature-policyexception.yaml` (sync-wave `-1`) unblocks rollout.

**Cleanup:** GitHub → madfam-org → Packages → each Voxa image → **Change visibility to public**, then remove the PolicyException manifests and sync.

### API pod CrashLoop

- **`Cannot find module '@hono/node-server'`:** API image must use `pnpm deploy` in `apps/api/Dockerfile`.
- **Probes fail with running process:** API listens on `LISTEN_HOST=0.0.0.0` (do not use `HOSTNAME`, which Kubernetes sets to the pod name).

### API hostname serves Next.js (`voxa-api.*` returns web 404)

Multi-service apps must use **Enclii junctions** for tunnel routes (see Tulana). Do not declare `spec.domains` in `enclii.yaml` — onboarding yaml provisioning targets the single `metadata.name` service and can overwrite `voxa-api.*` routes to the web backend.

**Fix:** `providers.cloudflare.tunnels-apply` for project `voxa` with target `voxa-api.madfam.io`.

### Staging HTTPS handshake failure

Cloudflare Universal SSL covers `*.madfam.io` only (one label). Nested names like `voxa.staging.madfam.io` fail TLS. Use single-level staging hosts (`voxa-staging.madfam.io`, etc.).

### Lifecycle callbacks no-op

Set `ENCLII_CALLBACK_TOKEN` on the repo (ArgoCD webhook secret — see [DEPLOYMENT_TRACKING.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/DEPLOYMENT_TRACKING.md)):

```bash
ENCLII_CALLBACK_TOKEN='<token>' ./scripts/deploy/setup-github-secrets.sh
```

### GitHub push webhook 401 on Enclii

GitHub deliveries show `Invalid signature` when the cluster secret and `switchyard-api` pod env diverge, or after a platform secret rotation without recycling pods.

1. Ensure repo webhook secret matches `enclii/enclii-github-webhook` (update via `setup-github-webhook.sh` or Enclii `POST /v1/admin/provision/secrets`).
2. Roll `switchyard-api` — Enclii service restart alone may not recycle pods under Argo self-heal. Use `scripts/deploy/rollout-switchyard-api.sh --via-enclii-scale`; a direct cluster restart is platform break-glass only.

3. Redeliver a hook `ping`; expect **200**. Details: [RUNBOOK.md](../ops/RUNBOOK.md), [GA_STATUS.md](../launch/GA_STATUS.md).

## Storage

The API selects a store driver at startup:

| `DATABASE_URL` | Driver | Use |
|----------------|--------|-----|
| Set | PostgreSQL | Production and staging (durable) |
| Unset | JSON file (`boards.json` under `VOXA_DATA_DIR`, default `./data`) | Local dev and tests |

Without `DATABASE_URL`, pods fall back to the file store on the `/app/data` `emptyDir` volume: data is lost on restart and each replica has its own copy. The file store replaces `boards.json` atomically (temp file, `fsync`, `rename`), so a crash mid-write never leaves a truncated file.

### How the API reaches Postgres

Production and staging connect **directly** to a shared PostgreSQL server on port 5432 (not through a connection pooler). `DATABASE_URL` lives in the `voxa-secrets` Secret; never commit it. `scripts/deploy/provision-shared-postgres.sh` creates the databases and writes the URL. Templates: `deploy/secrets-template.yaml`, `deploy/secrets.env.example`.

On startup the API runs the Drizzle migrations (`apps/api/drizzle/migrations`, journaled in `meta/_journal.json`) on a dedicated single connection, closes it, seeds the demo board when the database is empty, and only then listens. A pod whose first connection is refused, reset, times out or cannot resolve the host (a transient connection refusal at startup, e.g. before the pod's network is ready) retries with backoff (0.5 s doubling to 5 s) for up to `DATABASE_STARTUP_RETRY_MS` (default 30 s), logging the error code only. After that, or on any SQL or migration error, it exits as before. Then verify readiness:

```bash
curl -sS https://voxa-api.madfam.io/health/ready
# {"status":"ready","service":"voxa-api","store":"postgres",...}
```

### Connection budget (contract)

The Postgres server is shared with other services under a fixed connection limit, so the API's share is bounded:

- Each API process opens **one** pool (`getSharedDb` in `apps/api/src/db/client.ts`), shared by the board store, the media store and `POST /v1/events/activations`. Request handlers must never open their own pool (`createDb` is for owners that close what they open, such as migrations).
- `DATABASE_POOL_MAX` (default `5`) caps that pool. Two production replicas hold at most 10 connections, plus 1 per pod while startup migrations run. Raise it only after checking the server's budget.
- Idle pooled connections close after 30 s. `closeSharedDb()` ends the pool on `SIGTERM`/`SIGINT`.
- The `/health/ready` probe pings through the same shared pool (`SELECT 1`); it opens no connection of its own.

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_POOL_MAX` | `5` | Max pooled connections per API process. |
| `DATABASE_STARTUP_RETRY_MS` | `30000` | Total time startup retries connection-level errors. `0` disables the retry. |
| `VOXA_DATA_DIR` | `./data` | File-store directory when `DATABASE_URL` is unset. |

### Managed Postgres addon (alternative)

An isolated Enclii-managed Postgres can replace the shared server:

```bash
enclii addon create voxa --project voxa --plan standard-0 --engine postgres
# when status=ready:
enclii addon bind <addon_id> --service <voxa-api-service-id> --env-var DATABASE_URL
enclii ops apps sync --application voxa-services
```

`scripts/deploy/bind-database-addon.sh` automates the poll-and-bind. Keep the connection budget above in mind for any target.

Schema reference: [docs/data-model.md](../data-model.md).

## References

- [EXTERNAL_REPO_DEPLOY.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/EXTERNAL_REPO_DEPLOY.md)
- [ONBOARDING_GUIDE.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/ONBOARDING_GUIDE.md)
- Reference implementation: [madfam-site](https://github.com/madfam-org/madfam-site)
