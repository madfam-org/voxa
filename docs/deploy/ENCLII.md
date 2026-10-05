# Enclii deployment runbook for Voxa

> Public-safe summary. Operator procedures, platform identifiers and break-glass steps live in MADFAM's private operations repository, not here.

Voxa deploys to **madfam.io** via Enclii using the [zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md): Dockerfiles, `k8s/`, CI, and `enclii.yaml` live in this repo. ArgoCD apps are registered by Enclii runtime onboarding (`onboard/ensure`); tunnel routing uses junctions on `voxa-web` / `voxa-api` services.

**Commercial GA:** [GA_ROADMAP.md](../launch/GA_ROADMAP.md) · [GA_CHECKLIST.md](../launch/GA_CHECKLIST.md)

## Architecture

```
GitHub (madfam-org/voxa)
  ├── push main     → deploy-voxa-{web,api}.yml build, sign, digest commit → k8s/production
  ├── push main     → deploy-voxa-{web,api}-staging.yml build, sign, digest commit → k8s/staging
  └── lifecycle callback → api.enclii.dev

Enclii (ArgoCD + Cloudflare Tunnel)
  ├── voxa.madfam.io              → voxa-web (production)
  ├── voxa-app.madfam.io          → voxa-web (production)
  ├── voxa-api.madfam.io          → voxa-api (production)
  ├── voxa-staging.madfam.io      → voxa-web (staging)
  ├── voxa-app-staging.madfam.io  → voxa-web (staging)
  └── voxa-api-staging.madfam.io  → voxa-api (staging)
```

Routing uses Cloudflare Tunnel routes (Enclii junctions) to the `voxa-web` and `voxa-api` services. There is **no Ingress** in this repo.

## Prerequisites

1. **GitHub integration** on `madfam-org/voxa`:
   - **Webhook** → `https://api.enclii.dev/v1/webhooks/github` (HMAC secret = the platform's GitHub webhook secret)
   - **`ENCLII_CALLBACK_TOKEN`** — lifecycle events from Actions to Enclii (the platform's callback token)

   The platform operator registers the webhook and sets the repository secret; the values never come from this repo.

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
     --db-name <database-name> \
     --db-password "$(openssl rand -base64 32)" \
     --secrets-file ./deploy/secrets.env.example
   ```

5. **Staging** — `voxa-staging-services` ArgoCD app must track branch `main` and `k8s/staging/` (registered at runtime, not via Enclii `infra/argocd/projects/` entries). The `staging` branch was deleted; an app still pointed at it shows a ComparisonError and never syncs. A platform operator points the app's source revision at `main`. Do not re-run `onboard/ensure` for the staging project to do it: that endpoint keys the onboarding record by repository, so a staging call would rewrite the production record's desired state.

## Day-to-day deploys

Four workflows build, sign and pin images. Each runs on `workflow_dispatch` and on a push to `main` that touches its app, `packages/**` or its Dockerfile (the staging workflows also run when their own workflow file changes). Staging rebuilds beside production on every such merge and never gates it:

| Workflow | Branch | Paths | Signs (cosign) | Pins digests in |
|----------|--------|-------|----------------|-----------------|
| `deploy-voxa-api.yml` | `main` | `apps/api/**`, `packages/**` | yes | `k8s/production/` |
| `deploy-voxa-web.yml` | `main` | `apps/web/**`, `packages/**` | yes | `k8s/production/` |
| `deploy-voxa-api-staging.yml` | `main` | `apps/api/**`, `packages/**` | yes | `k8s/staging/` |
| `deploy-voxa-web-staging.yml` | `main` | `apps/web/**`, `packages/**` | yes | `k8s/staging/` |

Each workflow has its own concurrency group (`voxa-web-production`, `voxa-api-production`, `voxa-web-staging`, `voxa-api-staging`): GitHub keeps only the newest pending run per group, so a shared web+API group let one workflow's pending run displace the other's. The pin step retries (3 times in production, 5 with jitter in staging: fetch, reset to `origin/main`, re-apply the digest), so the workflows cannot clobber each other's pin. Staging images are tagged `staging-<sha>` and `staging`, and the staging builds read the production build cache without writing to it. They then run the deploy smokes below, and fail loudly if an image was pushed but never pinned. A docs-only change (root `*.md`, `docs/**`) deploys nothing. All GitHub-hosted jobs are pinned to `ubuntu-24.04`.

### Deploy smokes

Every check is an anonymous GET against the public hosts.

| Workflow | Smoke |
|----------|-------|
| all four | `scripts/launch/wait-for-build.sh`: polls `/health` (API) or `/api/health` (web) until it serves this commit's `build` (up to 12 minutes), so a green run proves the new image is serving, not just that an old pod answers 200 |
| `deploy-voxa-web.yml` | then `verify-prod-ga.sh` (informational, never fails the run), `verify-prod-demo.sh` (`/demo` serves the board), `verify-prod-image-optimizer.sh` (`/_next/image` → 404) and `VERIFY_SAME_HOST=1 scripts/launch/verify-auth-public-origin.sh` on the landing and the app host |
| `deploy-voxa-web-staging.yml` | then the same strict auth smoke on both staging web hosts and a public page |
| `deploy-voxa-api.yml`, `deploy-voxa-api-staging.yml` | the build check above (it reads `/health`, and readiness gates the rollout) |

The strict auth smoke checks that `/api/auth/providers` reports a callback on the host that was asked and that an anonymous callback probe redirects back to that same host, never to the server's `0.0.0.0` bind address (see [docs/auth/JANUA.md](../auth/JANUA.md#sign-in-stays-on-the-host-the-browser-used)). The CI axe job runs it too, against the standalone server bound to `0.0.0.0`, and `scripts/launch/deploy-contract.test.mjs` keeps each workflow's host list equal to its manifest's `AUTH_PUBLIC_HOSTS`.

### Environment changes and image rollouts

Argo CD applies a change under `k8s/` as soon as it lands on `main`, while an image built from the same merge rolls out minutes later, after the build, the signature and the digest pin. A manifest change that the new image needs, or that the old image cannot run with, therefore goes in its own manifest-only PR, before or after the image as the dependency requires, and only once `/api/health` (or `/health`) serves the image it depends on. The sign-in fix of October 2026 is the worked example: voxa#50 pinned `AUTH_URL` as a hotfix, voxa#51 shipped an image that builds its URLs per public host while the pin stayed, and voxa#52 removed the pin and made the smoke strict only after voxa#51's `build` was serving in production.

| Environment | Branch | Manifests | Domains |
|-------------|--------|-----------|---------|
| Production | `main` | `k8s/production/` | `voxa.madfam.io`, `voxa-app.madfam.io`, `voxa-api.madfam.io` |
| Staging | `main` | `k8s/staging/` | `voxa-staging.madfam.io`, `voxa-app-staging.madfam.io`, `voxa-api-staging.madfam.io` |

ArgoCD auto-syncs after digest commits (automated sync with self-heal); the web pin also bumps the pod template's `restartedAt`. No workflow calls Argo or restarts pods. Check status at [app.enclii.dev](https://app.enclii.dev) and the Enclii status page entries declared in `enclii.yaml`.

## Health checks

| Service | Probe | Path | Test |
|---------|-------|------|------|
| Web | liveness, startup | `GET /api/health` | `apps/web/src/app/api/health/route.test.ts` |
| Web | readiness | `GET /api/health/ready` (503 naming any missing `AUTH_SECRET` / `AUTH_JANUA_*` setting, or `invalid: ["AUTH_PUBLIC_HOSTS"]` for a malformed host list; names only, never values) | `apps/web/src/app/api/health/ready/route.test.ts` |
| API | liveness | `GET /health` | `apps/api/src/health.test.ts` |
| API | readiness, startup, status page | `GET /health/ready` (503 when the store is unreachable) | `apps/api/src/health.test.ts` |

### Availability during rollouts and node drains

- The production manifests set the intended replica floor: 2 web and 2 API replicas, spread across nodes when possible (`topologySpreadConstraints`, `ScheduleAnyway`). Staging sets 1 of each. The live count is not taken from git; see the next section.
- Rollouts are surge-first (`maxSurge: 1`, `maxUnavailable: 0`, `minReadySeconds: 5`): a new pod must pass readiness before an old one stops. If the surge pod cannot be scheduled, the rollout waits on the old pods, which keep serving. With one live pod a rollout still keeps a ready endpoint, but a crash or eviction of that pod is an outage until a replacement is ready.
- A `preStop` sleep of 5 s lets the endpoint removal reach the Service before the container gets `SIGTERM`.
- On `SIGTERM` the API drains (`apps/api/src/lib/graceful-shutdown.ts`): `/health/ready` answers 503, open WebSockets get a 1001 close frame (clients reconnect to the other replica), requests in flight finish, then Redis and the database pool close and the process exits 0. It exits 1 on a second signal or after `SHUTDOWN_DEADLINE_MS` (default 20 s, below the 30 s `terminationGracePeriodSeconds` minus the 5 s `preStop`). The web server is Next's standalone server, which already stops accepting and awaits in-flight requests on `SIGTERM` before it exits.
- `k8s/*/pod-disruption-budgets.yaml`: production keeps `minAvailable: 1` per Deployment, which allows one voluntary disruption only while that Deployment has at least 2 healthy pods; at 1 pod the budget allows none and a drain of that pod's node waits on it. Staging (1 replica) uses `maxUnavailable: 1` so its drains are never blocked. `scripts/launch/deploy-contract.test.mjs` fails when a budget allows no disruption at its manifest's replica count, or when production web or API drops below 2 replicas in git.
- Capacity: a production rollout briefly runs one pod more than the live count of the Deployment being updated (3 at the floor of 2; web requests 50m CPU / 128Mi per pod, API 100m / 256Mi).

### Replica counts: git records intent, the operator scales live

The Argo CD app `voxa-services` ignores `/spec/replicas` on Deployments and StatefulSets (`ignoreDifferences` with the sync option `RespectIgnoreDifferences=true`). A change to `replicas:` under `k8s/production/` therefore merges, Argo CD reports Synced and Healthy, and the cluster keeps the count it had. Everything else under `k8s/` is applied as usual.

To change the live count, the platform operator scales the Deployment and checks the result against the Deployment itself:

```bash
kubectl -n voxa scale deploy/voxa-web --replicas=2     # or deploy/voxa-api
kubectl -n voxa get deploy voxa-web voxa-api           # READY n/n and AVAILABLE must equal the spec
```

Change the manifest in the same direction so git keeps recording the intended floor. Never take a 200 from `/api/health/ready` or `/health/ready` as evidence of the replica count: one ready pod answers it. These commands need cluster access, which no workflow in this repository holds; the operator procedure around them is private.

### How an outage is detected

- **Alerts to on-call.** Critical alerts from the platform's Prometheus rules go through Alertmanager to Courier, the notification service of the angelia platform, which delivers them to the on-call phone. Courier forwards critical alerts only; warnings stay in Alertmanager.
- **What covers Voxa today.** A Voxa pod that crash loops (`PodCrashLooping`, every namespace); the Argo CD app degraded or missing (`ArgoCDAppDegraded`, `ArgoCDAppMissing`); and the shared dependencies Voxa runs on (PostgreSQL, Redis, the Cloudflare tunnel, node pressure). A Deployment that sits below its desired count without crash looping (for example a pod that never turns ready) is not covered until [enclii#695](https://github.com/madfam-org/enclii/pull/695) lands. It adds the production `voxa` namespace to the platform's client availability rules (the `client-slo` group): the critical `ClientDeploymentUnavailable` (available below desired for 5 minutes), which pages, and the warning rules `ClientServiceErrorRate`, `ClientServiceLatencyP95`, `ClientPodRestartRate` and `TenantResourceQuotaNearLimit`, which do not. `voxa-staging` stays out on purpose: staging serves an old build until its Argo CD app tracks `main` and would page falsely.
- **Status page.** [status.madfam.io](https://status.madfam.io) checks the five hosts declared in the `status:` block of `enclii.yaml` (production web, app and API, staging web and API; API entries use `/health/ready`). It shows state; it is not part of the alert path above.
- **Deploy and daily smokes.** A failed deploy smoke or daily smoke (`e2e-smoke.yml`) shows as a failed GitHub Actions run; it pages no one.

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

Production Enclii uses **runtime** ArgoCD registration. If the platform cannot create Argo CD applications, onboarding partially completes (namespace, domains, network policies) but workloads never sync.

**Platform fix:** a platform operator grants the missing permission, then re-run:

```bash
enclii onboard --repo madfam-org/voxa --project voxa --manifest-path k8s/production
# or POST /v1/admin/onboard/ensure
```

### Image gate rejects onboarding (`image must be digest-pinned`)

Workload `Deployment` YAML must contain `@sha256:` references, not short names like `voxa-web`. CI updates both `kustomization.yaml` and the deployment files on each build.

### Kyverno blocks sync (`verify-image-signatures`)

Both Voxa GHCR packages are public, and every deploy workflow (production and staging) signs the pushed digest with cosign keyless (GitHub Actions OIDC, recorded in the public Rekor log) **before** it pins the digest in `k8s/`. Kyverno verifies Voxa images like any other workload: the repository carries no `PolicyException` (the June 2026 stopgap from when the packages were private was removed in October 2026).

If admission denies a Voxa pod with `no matching signatures`, the pinned digest was not signed: rerun the deploy workflow's failed jobs. To check a digest anonymously, `GET https://ghcr.io/v2/madfam-org/voxa/<image>/manifests/sha256-<digest>.sig` with an anonymous pull token must answer 200. Do not re-add a `PolicyException`: it would also admit any future unsigned image.

Signature verification makes Kyverno stamp a digest-keyed `kyverno.io/verify-images` annotation on the Deployments and deny any request that changes it. The Argo CD apps must therefore diff client-side: an app whose `argocd.argoproj.io/compare-options` contains `ServerSideDiff=true` sends the git target (new digest, no annotation) through admission on every diff, is denied, and the whole app stops syncing (ComparisonError). Runtime-registered apps get client-side diff on the next Enclii `onboard/ensure`.

**Status (2026-10-05):** both exceptions are still in git. Removing them is [voxa#34](https://github.com/madfam-org/voxa/pull/34), which waits on read-only cluster checks (Argo CD diff mode and prune policy) so that the removal cannot stop the Argo apps from syncing.

### cosign is held at v2 (cosign-installer v3)

The deploy workflows sign with cosign v2, installed by `sigstore/cosign-installer` v3. cosign v3 (installer v4) writes its signature as a protobuf Sigstore bundle attached as an OCI 1.1 referrer instead of the `sha256-<digest>.sig` tag, and the cluster's Kyverno version verifies only the tag format. Taking the installer major before Kyverno verifies the new format would fail admission once the exceptions above are gone. Dependabot ignores the installer's majors (`.github/dependabot.yml`), and `scripts/launch/deploy-contract.test.mjs` fails if a deploy workflow pins anything but v3 ([voxa#46](https://github.com/madfam-org/voxa/pull/46)). To move on: upgrade Kyverno in Enclii to a version that verifies the bundle format and prove a cosign-v3-signed image is admitted without an exception, or take the installer major while pinning `cosign-release` to v2.

### API pod CrashLoop

- **`Cannot find module '@hono/node-server'`:** API image must use `pnpm deploy` in `apps/api/Dockerfile`.
- **Probes fail with running process:** API listens on `LISTEN_HOST=0.0.0.0` (do not use `HOSTNAME`, which Kubernetes sets to the pod name).

### API hostname serves Next.js (`voxa-api.*` returns web 404)

Multi-service apps must use **Enclii junctions** for tunnel routes (see Tulana). Do not declare `spec.domains` in `enclii.yaml` — onboarding yaml provisioning targets the single `metadata.name` service and can overwrite `voxa-api.*` routes to the web backend.

**Fix:** ask the platform operator to re-apply the junction route for `voxa-api.madfam.io` (a platform operation, never run from this repo).

### Staging HTTPS handshake failure

Cloudflare Universal SSL covers `*.madfam.io` only (one label). Nested names like `voxa.staging.madfam.io` fail TLS. Use single-level staging hosts (`voxa-staging.madfam.io`, etc.).

### Lifecycle callbacks no-op

The repository secret `ENCLII_CALLBACK_TOKEN` is missing or stale. The platform operator sets it (see [DEPLOYMENT_TRACKING.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/DEPLOYMENT_TRACKING.md)).

### GitHub push webhook 401 on Enclii

GitHub deliveries show `Invalid signature` when the repository's webhook secret and the platform's copy diverge, typically after a platform secret rotation.

1. The platform operator re-aligns the webhook secret and reloads the platform API (a platform procedure, not run from this repo).
2. Redeliver a hook `ping`; expect **200**. Details: [RUNBOOK.md](../ops/RUNBOOK.md).

## Storage

The API selects a store driver at startup:

| `DATABASE_URL` | Driver | Use |
|----------------|--------|-----|
| Set | PostgreSQL | Production and staging (durable) |
| Unset | JSON file (`boards.json` under `VOXA_DATA_DIR`, default `./data`) | Local dev and tests |

With `NODE_ENV=production` and no `DATABASE_URL` the API **refuses to start** (exit 1, with a message naming `DATABASE_URL`): the file store would live on the `/app/data` `emptyDir` volume, lose its data on restart and keep one copy per replica. `/health/ready` also answers 503 on the file store in production. Outside production the file store replaces `boards.json` atomically (temp file, `fsync`, `rename`), so a crash mid-write never leaves a truncated file.

### Concurrent edits

Board writes are compare-and-set: the API reads the board by id, applies the change, then updates the row only if its `version` is unchanged (`UPDATE … WHERE id = $1 AND version = $2 RETURNING`), and records the sync event in the same transaction. Of two writers on the same version exactly one wins; the other gets **409** `{"code":"VERSION_CONFLICT","currentVersion":N}`. A PUT without `expectedVersion` re-reads and retries up to three times instead. Board lists and the plan's board limit run scoped SQL (owner, or organization for editors and admins; `count(*)`), never a scan of every board.

### Real-time co-editing across replicas (Redis)

The production manifest sets two API replicas. WebSocket clients connect to any of them, so board changes must fan out through Redis: with `REDIS_URL` set and reachable, each replica publishes its `board.*` events on one channel and relays the others', and presence (`{"type":"connected","presence":N}`) counts clients on every replica (a sorted set per board with 30 s expiring entries, so a crashed replica's clients age out). `/health/ready` then reports `"syncHub":"redis"`.

- `REDIS_URL` is a key of the `voxa-secrets` Secret (the shared Redis requires a password and gives each app its own DB index, so the URL is never a literal in a manifest). Both API Deployments bind it explicitly with `optional: true`.
- Without it, or with Redis unreachable, the API keeps serving in **local** mode (events reach only clients on the same replica), keeps reconnecting in the background, switches to Redis by itself, and `/health/ready` stays 200 with a `syncHubWarning`. An unreachable Redis never makes a pod unready.
- The `allow-data-egress` NetworkPolicy already allows TCP 6379 to the `data` namespace; the data side admits namespaces labelled for data access, the same label that already admits Postgres.
- Verify after binding: `REQUIRE_REDIS=1 ./scripts/launch/verify-prod-redis.sh`.

### Request limits

| Variable | Default | Notes |
|----------|---------|-------|
| `RATE_LIMIT_IP_PER_MINUTE` | `600` | Per client address (`CF-Connecting-IP`, else the socket peer; never `X-Forwarded-For`), counting only requests **without** a bearer token. Authenticated traffic is never limited per address: the web server proxies browser calls, so all users can share one address. |
| `RATE_LIMIT_AUTH_FAILURES_PER_MINUTE` | `60` | Per client address: requests that end in 401. Past it, failing requests get 429; a token that verifies always passes. Bounds token spraying. |
| `RATE_LIMIT_PER_MINUTE` | `300` | Per verified user id, every route except media reads. A signed-in selection costs about three requests (two predictions, one activation). |
| `RATE_LIMIT_MEDIA_PER_MINUTE` | `600` | Per verified user id, `GET /v1/media/:id` only (opening a board loads all its pictures at once; browsers cache them afterwards). |
| `MEDIA_QUOTA_BYTES_PER_USER` | `524288000` (500 MB) | Total uploaded media per user; summed from stored sizes, 413 `MEDIA_QUOTA_EXCEEDED` past it. |

Both rate limits are in memory and per replica (two replicas allow up to twice the rate); they are abuse ceilings, not quotas. Body ceilings (413 `PAYLOAD_TOO_LARGE`, checked from `Content-Length` before reading, or cut off at the limit for chunked bodies): 1 MB for JSON; 51 MB for `POST /v1/media` (largest type, video, 50 MB); an outer 51 MB for `POST /v1/boards/import/:format` (the route itself refuses more than 30 MB with 400 `ARCHIVE_TOO_LARGE`). Uploads must match their declared type by magic bytes (415 `MEDIA_TYPE_MISMATCH`), and media is served with `X-Content-Type-Options: nosniff` and `Content-Disposition: inline`.

### How the API reaches Postgres

Production and staging connect **directly** to a shared PostgreSQL server on port 5432 (not through a connection pooler). `DATABASE_URL` lives in the `voxa-secrets` Secret; never commit it. The platform operator provisions the database and writes the URL into that Secret through Enclii. Templates: `deploy/secrets-template.yaml`, `deploy/secrets.env.example`.

On startup the API runs the Drizzle migrations (`apps/api/drizzle/migrations`, journaled in `meta/_journal.json`) on a dedicated single connection, closes it, seeds the demo board when the database is empty, and only then listens. A pod whose first connection is refused, reset, times out or cannot resolve the host (a transient connection refusal at startup, e.g. before the pod's network is ready) retries with backoff (0.5 s doubling to 5 s) for up to `DATABASE_STARTUP_RETRY_MS` (default 30 s), logging the error code only. After that, or on any SQL or migration error, it exits as before. Then verify readiness:

```bash
curl -sS https://voxa-api.madfam.io/health/ready
# {"status":"ready","service":"voxa-api","store":"postgres",...}
```

### Connection budget (contract)

The Postgres server is shared with other services under a fixed connection limit, so the API's share is bounded:

- Each API process opens **one** pool (`getSharedDb` in `apps/api/src/db/client.ts`), shared by the board store, the media store and `POST /v1/events/activations`. Request handlers must never open their own pool (`createDb` is for owners that close what they open, such as migrations).
- `DATABASE_POOL_MAX` (default `5`) caps that pool. Two production replicas hold at most 10 connections, plus 1 per pod while startup migrations run; during a rollout the surge pod adds one more pool (at most 15). Raise it only after checking the server's budget.
- Idle pooled connections close after 30 s. `closeSharedDb()` ends the pool on `SIGTERM`/`SIGINT`.
- The `/health/ready` probe pings through the same shared pool (`SELECT 1`); it opens no connection of its own.

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_POOL_MAX` | `5` | Max pooled connections per API process. |
| `DATABASE_STARTUP_RETRY_MS` | `30000` | Total time startup retries connection-level errors. `0` disables the retry. |
| `VOXA_DATA_DIR` | `./data` | File-store directory when `DATABASE_URL` is unset (never in production). |

### Managed Postgres addon (alternative)

An isolated Enclii-managed Postgres can replace the shared server:

```bash
enclii addon create voxa --project voxa --plan standard-0 --engine postgres
# when status=ready:
enclii addon bind <addon_id> --service <voxa-api-service-id> --env-var DATABASE_URL
enclii ops apps sync --application voxa-services
```

Keep the connection budget above in mind for any target.

Schema reference: [docs/data-model.md](../data-model.md).

## References

- [EXTERNAL_REPO_DEPLOY.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/EXTERNAL_REPO_DEPLOY.md)
- [ONBOARDING_GUIDE.md](https://github.com/madfam-org/enclii/blob/main/docs/guides/ONBOARDING_GUIDE.md)
- Reference implementation: [madfam-site](https://github.com/madfam-org/madfam-site)
