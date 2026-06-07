# Enclii deployment runbook for Voxa

Voxa deploys to **madfam.io** via Enclii using the [zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md): Dockerfiles, `k8s/`, CI, and `enclii.yaml` live in this repo. ArgoCD apps are registered by Enclii runtime onboarding (`onboard/ensure`); tunnel routing uses junctions on `voxa-web` / `voxa-api` services.

## Architecture

```
GitHub (madfam-org/voxa)
  ├── push main     → CI builds images → digest commit → k8s/production
  ├── push staging  → CI builds images → digest commit → k8s/staging
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

1. **GitHub secrets** on `madfam-org/voxa`:
   - `ENCLII_CALLBACK_TOKEN` — lifecycle events to Enclii (same value as other MADFAM repos; see [DEPLOYMENT_TRACKING.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/DEPLOYMENT_TRACKING.md))

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

## Storage

The API selects a store driver at startup:

| `DATABASE_URL` | Driver | Use |
|----------------|--------|-----|
| Set | PostgreSQL | Production and staging (durable) |
| Unset | JSON file (`./data/boards.json`) | Local dev only |

### Enable PostgreSQL in cluster

1. Provision credentials (template: `deploy/secrets-template.yaml`).
2. Apply via Enclii onboard:

   ```bash
   enclii onboard --repo madfam-org/voxa --project voxa \
     --manifest-path k8s/production \
     --secrets-file deploy/secrets-template.yaml
   ```

3. Sync ArgoCD (`voxa-services`). The API runs Drizzle migrations on startup and seeds the demo board when the database is empty.

4. Verify readiness:

   ```bash
   curl -sS https://voxa-api.madfam.io/health/ready
   # {"status":"ready","service":"voxa-api","store":"postgres"}
   ```

Until `DATABASE_URL` is bound, pods use the file store on an `emptyDir` volume (data lost on restart).

### Managed Postgres addon (recommended)

```bash
# Create addon (Enclii UI or API)
enclii addon create voxa --project voxa --plan standard-0 --engine postgres

# Wait until status=ready, then bind to voxa-api
enclii addon bind <addon_id> --service <voxa-api-service-id> --env-var DATABASE_URL

# Sync workloads
enclii ops apps sync --application voxa-services
```

Production addon `voxa` (id `c3ea79f2-e05e-4567-8f10-d9d98a0fc2dd`) was provisioned via Enclii; bind once status is **ready**, then verify:

```bash
curl -sS https://voxa-api.madfam.io/health/ready
# expect store: postgres
```

Schema reference: [docs/data-model.md](../data-model.md).

## References

- [EXTERNAL_REPO_DEPLOY.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/EXTERNAL_REPO_DEPLOY.md)
- [ONBOARDING_GUIDE.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/ONBOARDING_GUIDE.md)
- Reference implementation: [madfam-site](https://github.com/madfam-org/madfam-site)
