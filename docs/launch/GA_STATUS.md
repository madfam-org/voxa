# Voxa GA status — wrap-up (2026-06-08)

Commercial general availability target: **https://voxa.madfam.io**

This document records deployment state after the Enclii/Janua GA push. Use it with [GA_CHECKLIST.md](./GA_CHECKLIST.md) for remaining items and [../deploy/ENCLII.md](../deploy/ENCLII.md) for day-to-day ops.

## Executive summary

**Voxa is live in production and staging** with PostgreSQL, Janua SSO, API auth enforcement, billing hooks, and legal pages. CI builds and deploys via Enclii GitOps. GitHub → Enclii webhook signature verification is **resolved** (2026-06-08). **Staging soak in progress** (2026-06-08 → 2026-06-15) with automated scenarios + **full authenticated soak passing** (OIDC, OBF, AI consent, billing gates — 2026-06-08). GitHub Actions secrets for CI auth soak are **configured** (`VOXA_STAGING_*`). GHCR packages are **public** and Kyverno PolicyExceptions removed (2026-06-08). Remaining for **full web GA**: SLP sign-off, soak completion through 2026-06-15.

## Live verification (last confirmed)

| Check | Production | Staging |
|-------|------------|---------|
| Web health | `GET /api/health` → 200 | 200 |
| API ready | `store: postgres`, `authEnforced: true` | same |
| Unauthenticated boards | `GET /v1/boards` → **401** | **401** |
| Janua sign-in | `/auth/signin` → Continue with Janua | same |
| ArgoCD | `voxa-services` Synced / Healthy | `voxa-staging-services` Synced / Healthy |

```bash
curl -sS https://voxa-api.madfam.io/health/ready
curl -sS -o /dev/null -w '%{http_code}\n' https://voxa-api.madfam.io/v1/boards
curl -sS https://voxa-api-staging.madfam.io/health/ready
```

## What shipped

### Infrastructure & deploy

- **Enclii platform (2026-06-08):** pushed `madfam-org/enclii@7e73094c` — `docs-site` Kyverno PolicyException (unblocks `core-services` sync), Stakater Reloader on `switchyard-api`, `kubectl.kubernetes.io/restartedAt` for service restarts (requires next switchyard-api image build to take effect in API).
- **Enclii onboarding** completed for `madfam-org/voxa` (prod) and staging (`onboard/ensure`).
- **ArgoCD apps:** `voxa-services` (branch `main`, `k8s/production/`), `voxa-staging-services` (branch `staging`, `k8s/staging/`).
- **Domains & junctions:** web → `voxa-web`, API → `voxa-api` (Tulana pattern; tunnel routes via Cloudflare).
- **Images:** GHCR digest-pinned; CI updates `kustomization.yaml` and deployment YAML.
- **GHCR visibility (2026-06-08):** `voxa/voxa-api` and `voxa/voxa-web` confirmed **public**; Kyverno `PolicyException` YAML removed from `k8s/production/` and `k8s/staging/`.

### Data & auth

- **PostgreSQL:** shared cluster DBs `voxa` (prod) and `voxa_staging` (staging) via `scripts/deploy/provision-shared-postgres.sh`; `DATABASE_URL` in `voxa-secrets`.
- **Janua SSO:** OAuth client audience `voxa`; `OIDC_CLIENT_SECRET` in cluster secrets; public client id in GitHub variable `NEXT_PUBLIC_OIDC_CLIENT_ID` (`jnc_4qRWyI-ul_GL28hrSxrX7AvIyotFMBuB`).
- **API auth:** `VOXA_JANUA_AUTH_REQUIRED=true` on deployments; verify via `health/ready.authEnforced`. After env-only deploys, run `scripts/deploy/restart-voxa-api.sh` (Argo sync alone may not recycle pods).

### GitHub ↔ Enclii (2026-06-07)

| Item | Status |
|------|--------|
| Webhook on `madfam-org/voxa` | Registered → `https://api.enclii.dev/v1/webhooks/github` (hook id **637900323**) |
| `ENCLII_CALLBACK_TOKEN` on voxa | Set |
| Platform webhook secrets | Rotated in cluster (`enclii/enclii-github-webhook`, `enclii/enclii-argocd-webhook`) via Enclii `POST /v1/admin/provision/secrets`; peer repo webhooks (janua, dhanam, enclii) and callback tokens updated to stay aligned |
| Enclii signature verification | **Verified** — scale-to-1 + rolling restart (2026-06-08); GitHub hook ping → **200** |

Scripts:

```bash
# Lifecycle callback secret (value = enclii-argocd-webhook K8s secret)
ENCLII_CALLBACK_TOKEN='…' ./scripts/deploy/setup-github-secrets.sh

# GitHub webhook (secret = enclii-github-webhook K8s secret)
ENCLII_WEBHOOK_SECRET='…' ./scripts/deploy/setup-github-webhook.sh
```

Full operator pass: `ENCLII_TOKEN='…' ./scripts/deploy/complete-ga-operator.sh`

## Platform reference IDs

| Resource | ID / name |
|----------|-----------|
| Enclii onboarding (prod) | `fcafbd10-1b9b-43c0-b870-5f3596090160` |
| Enclii project | `voxa` |
| Prod API service (restart) | `5df18423-044a-4dde-88a7-721727f6974b` |
| Staging API service (restart) | `4acac80d-eda8-48f2-91cb-e55d47044c58` |
| switchyard-api (platform restart) | `4080ddc2-7ec7-4eaf-bbf4-00884d7b38b3` |
| GitHub webhook (voxa) | `637900323` |

## Remaining work (GA checklist)

| Priority | Item | Owner / action |
|----------|------|----------------|
| ~~**P0**~~ | Enclii webhook signature verified | **Done** (2026-06-08) |
| **Launch** | Staging soak (7 days) | **In progress** 2026-06-08 → 2026-06-15 — [STAGING_SOAK.md](./STAGING_SOAK.md), [SOAK_LOG.md](./SOAK_LOG.md), `scripts/launch/soak-daily-check.sh` |
| **Launch** | SLP accessibility sign-off | After soak — [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) |
| ~~**P1**~~ | GHCR packages public; PolicyExceptions removed | **Done** 2026-06-08 |
| **P2** | PgBouncer entries for `voxa` / `voxa_staging` | Platform RBAC; direct Postgres OK |
| **P2** | `REDIS_URL` | Post-GA multi-replica WebSocket scaling |
| **Quality** | `@axe-core/playwright` in CI | **Done** — `e2e/specs/a11y.spec.ts`, CI `a11y` job |
| **Quality** | Mobile EAS + store listings | [MOBILE_GA.md](./MOBILE_GA.md) — Phase 4, parallel to web GA |
| **Parity** | AAC benchmark + feature parity tracker | [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md) · [FEATURE_PARITY.md](./FEATURE_PARITY.md) — Phase 6 / M6 |

Phased plan: [GA_ROADMAP.md](./GA_ROADMAP.md)

## Known issues & fixes

### 1. GitHub webhook → Enclii returns 401 (`Invalid signature`) — resolved 2026-06-08

**Cause:** K8s secret `enclii-github-webhook` was updated, but `switchyard-api` pods still held the previous `ENCLII_GITHUB_WEBHOOK_SECRET`. Reloader rollouts also stalled when new pods were **Pending** (`Insufficient cpu` on the cluster).

**Fix (no SSH):**

```bash
ENCLII_TOKEN='…' ENCLII_WEBHOOK_SECRET='…' \
  ./scripts/deploy/rollout-switchyard-api.sh --via-enclii-scale
gh api -X POST repos/madfam-org/voxa/hooks/637900323/pings
```

**Fix (break-glass SSH):**

```bash
cloudflared access login ssh.madfam.io
ssh ssh.madfam.io 'sudo /usr/local/bin/k3s kubectl rollout restart deployment/switchyard-api -n enclii'
```

See [../ops/RUNBOOK.md](../ops/RUNBOOK.md#github--enclii-webhook-returns-401-after-secret-rotation).

### 2. API `authEnforced` false after deploy

Argo shows Synced but pods did not pick up `VOXA_JANUA_AUTH_REQUIRED`. Use Enclii service restart, not Argo alone:

```bash
ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-api.sh all
```

### 3. PgBouncer provisioning fails

`POST /v1/admin/provision/postgres` returns `pgbouncer_status: failed: … configmaps "pgbouncer-config" is forbidden`. RBAC manifest exists in Enclii git (`switchyard-pgbouncer-manager`). **Non-blocking for GA:** Voxa uses direct Postgres (`postgres.data.svc.cluster.local:5432`).

### 4. Cluster break-glass without SSH

Webhook/callback **values** live in cluster secrets (`enclii-argocd-webhook`, `enclii-github-webhook`). Read path (documented in Enclii):

```bash
ssh ssh.madfam.io 'sudo /usr/local/bin/k3s kubectl get secret enclii-argocd-webhook -n enclii -o jsonpath="{.data.secret}" | base64 -d'
ssh ssh.madfam.io 'sudo /usr/local/bin/k3s kubectl get secret enclii-github-webhook -n enclii -o jsonpath="{.data.secret}" | base64 -d'
```

Local `kubectl` and non-interactive SSH to `ssh.madfam.io` require **Cloudflare Access** authentication.

## Operator script index

| Script | Purpose |
|--------|---------|
| `scripts/deploy/complete-ga-operator.sh` | Health check, Postgres, Janua client, GitHub secrets/webhook, API restart |
| `scripts/deploy/provision-shared-postgres.sh` | Shared Postgres + `DATABASE_URL` in secrets |
| `scripts/deploy/register-janua-oauth-client.sh` | Janua OAuth client (once) |
| `scripts/deploy/setup-github-secrets.sh` | `ENCLII_CALLBACK_TOKEN` on repo |
| `scripts/deploy/setup-github-webhook.sh` | GitHub webhook → Enclii |
| `scripts/deploy/restart-voxa-api.sh` | Rolling restart prod/staging API when auth env changes |
| `scripts/deploy/rollout-switchyard-api.sh` | Recycle switchyard-api after webhook secret rotation |
| `scripts/deploy/make-ghcr-packages-public.sh` | Org admin: public GHCR packages |
| `scripts/launch/soak-daily-check.sh` | Daily staging soak health checks |

## Security notes

- Janua admin credentials used during GA wiring should be **rotated** if shared outside the password manager.
- Never commit `OIDC_CLIENT_SECRET`, `DATABASE_URL`, or platform webhook tokens.
- Platform webhook rotation affects **all** MADFAM repos hooked to Enclii — keep GitHub hook secrets and K8s secrets in sync.

## Related docs

- [GA_CHECKLIST.md](./GA_CHECKLIST.md) — checkbox tracker
- [GA_ROADMAP.md](./GA_ROADMAP.md) — phased plan to full commercial GA
- [STAGING_SOAK.md](./STAGING_SOAK.md) · [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) · [MOBILE_GA.md](./MOBILE_GA.md)
- [../deploy/ENCLII.md](../deploy/ENCLII.md) — deploy runbook
- [../auth/JANUA.md](../auth/JANUA.md) — SSO setup
- [../ops/RUNBOOK.md](../ops/RUNBOOK.md) — on-call incidents
- [Enclii DEPLOYMENT_TRACKING](https://github.com/madfam-org/enclii/blob/main/docs/guides/DEPLOYMENT_TRACKING.md) — callback token source of truth
- [Enclii WEBHOOK_SETUP_GUIDE](https://github.com/madfam-org/enclii/blob/main/docs/guides/WEBHOOK_SETUP_GUIDE.md) — webhook HMAC secret
