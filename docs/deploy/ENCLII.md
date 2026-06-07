# Enclii deployment runbook for Voxa

Voxa deploys to **enclii.dev** using the [zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md): all manifests, Dockerfiles, and CI live in this repo. Nothing is added to the `enclii` monorepo.

## Architecture

```
GitHub (madfam-org/voxa)
  ├── push main     → CI builds images → digest commit → k8s/production
  ├── push staging  → CI builds images → digest commit → k8s/staging
  └── lifecycle callback → api.enclii.dev

Enclii (ArgoCD + Cloudflare Tunnel)
  ├── voxa.enclii.dev              → voxa-web (production)
  ├── api.voxa.enclii.dev          → voxa-api (production)
  ├── voxa.staging.enclii.dev      → voxa-web (staging)
  └── api.staging.voxa.enclii.dev  → voxa-api (staging)
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

5. Staging: create `staging` branch from `main`, run staging workflows, then:
   ```bash
   enclii onboard --repo madfam-org/voxa --project voxa \
     --manifest-path k8s/staging --environment staging --preflight
   ```

## Day-to-day deploys

| Environment | Branch | Manifests | Domains |
|-------------|--------|-----------|---------|
| Production | `main` | `k8s/production/` | `voxa.enclii.dev`, `api.voxa.enclii.dev` |
| Staging | `staging` | `k8s/staging/` | `voxa.staging.enclii.dev`, `api.staging.voxa.enclii.dev` |

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

## Storage note (v0.5)

The API persists boards to `/app/data/boards.json` on an `emptyDir` volume. Data is ephemeral across pod restarts until PostgreSQL is wired via `voxa-secrets` and a future store migration.

## References

- [EXTERNAL_REPO_DEPLOY.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/EXTERNAL_REPO_DEPLOY.md)
- [ONBOARDING_GUIDE.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/ONBOARDING_GUIDE.md)
- Reference implementation: [madfam-site](https://github.com/madfam-org/madfam-site)
