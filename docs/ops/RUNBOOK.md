# Voxa on-call runbook

> Public-safe summary. Platform identifiers, operator scripts and break-glass procedures live in MADFAM's private operations repository, not here.

## Severity levels

| Level | Example | Response |
|-------|---------|----------|
| S1 | Production down, data loss | Page on-call immediately |
| S2 | Degraded sync or auth | Mitigate within 1 hour |
| S3 | Non-critical bug | Next business day |

## Health checks

```bash
curl -sS https://voxa-api.madfam.io/health
curl -sS https://voxa-api.madfam.io/health/ready
curl -sS -o /dev/null -w '%{http_code}\n' https://voxa.madfam.io/legal/privacy
```

Expected ready payload once Postgres and auth are live:

```json
{"status":"ready","service":"voxa-api","store":"postgres","authEnforced":true}
```

Unauthenticated `GET /v1/boards` should return **401** when `authEnforced` is true.

## Common incidents

### API returns 503 on `/health/ready`

1. Check ArgoCD app `voxa-services` sync status in Enclii.
2. Verify `voxa-secrets` contains `DATABASE_URL` if Postgres is expected.
3. Read the `voxa-api` logs through Enclii (web console or CLI).
4. If migrations failed, fix schema and restart deployment.

### API pod exits at boot with a connection error

Symptom: a new API pod logs `Voxa API startup migrations: database unreachable (ECONNREFUSED) …` lines, then either becomes ready or exits with `Failed to start Voxa API`.

1. A few retry lines followed by readiness are expected: startup retries a transient connection refusal (also `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`) for `DATABASE_STARTUP_RETRY_MS` (default 30 s). Nothing to do.
2. If the pod still exits after the budget, the database is unreachable from the pod: check the Postgres server's health, the `postgres` egress in `enclii.yaml`, and the `DATABASE_URL` host and port in `voxa-secrets`.
3. An SQL or migration error is never retried; fix the migration (see [data-model.md](../data-model.md#migrations)) and redeploy.

### Postgres reports too many connections

The API holds one pool per process, capped by `DATABASE_POOL_MAX` (default 5), against a shared server with a fixed connection limit. See the [connection budget](../deploy/ENCLII.md#connection-budget-contract). Check the replica count times `DATABASE_POOL_MAX` before raising either.

### Web loads but sync fails

1. Confirm `NEXT_PUBLIC_API_URL` points to `https://voxa-api.madfam.io`.
2. Verify Cloudflare tunnel junction routes `voxa-api.*` to the API service (not web).
3. Check CORS: browser origin must be `https://voxa.madfam.io` or staging equivalent.

### Janua auth errors (401)

1. Confirm Janua OAuth client `voxa` is registered.
2. Verify `OIDC_CLIENT_SECRET`, `JANUA_ISSUER_URL`, and `JANUA_AUDIENCE=voxa` in secrets.
3. Set `VOXA_JANUA_AUTH_REQUIRED=true` on the API deployment (not only in secrets — `envFrom` can override `JANUA_AUTH_REQUIRED`). Verify rollout with `curl -sS https://voxa-api.madfam.io/health/ready | jq .authEnforced` (expect `true`).

### API auth not enforced after deploy (`authEnforced` missing)

Symptom: Argo shows **Synced** but `/health/ready` has no `authEnforced` field and `/v1/boards` returns 200 without a Bearer token.

1. Confirm Git has `VOXA_JANUA_AUTH_REQUIRED=true` on `voxa-api` deployment and the latest API digest in `kustomization.yaml`.
2. Sync Argo app (`voxa-services` / `voxa-staging-services`) via Enclii.
3. **Rolling-restart the API** through an Enclii service restart (Argo ignores `restartedAt`; env-only changes may not recycle pods). The operator procedure is private.
4. Re-verify:
   ```bash
   curl -sS https://voxa-api.madfam.io/health/ready
   curl -sS -o /dev/null -w '%{http_code}\n' https://voxa-api.madfam.io/v1/boards
   ```
5. Sign in at `https://voxa.madfam.io/auth/signin` and confirm `/api/auth/session` returns a token that succeeds against `/v1/boards`.

### GitHub → Enclii webhook returns 401 after secret rotation

Symptom: GitHub hook deliveries show `Invalid HTTP Response: 401`; Enclii responds `{"error":"Invalid signature"}`.

1. Confirm `madfam-org/voxa` has a webhook to `https://api.enclii.dev/v1/webhooks/github` and the `ENCLII_CALLBACK_TOKEN` repository secret is set.
2. Escalate to the platform operator: the platform's webhook secret must match the repository's, and the platform API must reload it. That procedure (and any break-glass step) is private.
3. Re-test: GitHub hook **Redeliver** on a `ping` event should return **200**.

### Rate limit spikes (429)

Two limiters answer 429 `{"code":"RATE_LIMITED"}` with `Retry-After: 60`: per client address (`CF-Connecting-IP`, `RATE_LIMIT_IP_PER_MINUTE`, default 600) before authentication, and per signed-in user (`RATE_LIMIT_PER_MINUTE`, default 120) after it. Both are per replica.

1. Identify abusive IP or user via ingress logs.
2. Temporarily lower `RATE_LIMIT_IP_PER_MINUTE` or `RATE_LIMIT_PER_MINUTE` on the API deployment if needed (a clinic or school behind one address shares the address limit).
3. Escalate repeat offenders through MADFAM security channel.

### Co-editors do not see each other's changes

`curl -sS https://voxa-api.madfam.io/health/ready`: `"syncHub":"local"` means changes reach only clients on the same replica. With a `syncHubWarning`, `REDIS_URL` is set but Redis is unreachable (the API reconnects by itself; check the shared Redis and the `allow-data-egress` policy). Without one, `REDIS_URL` is not bound: see [ENCLII.md](../deploy/ENCLII.md#real-time-co-editing-across-replicas-redis).

## Rollback

1. Revert the digest in `k8s/production/voxa-api-deployment.yaml` or `voxa-web-deployment.yaml` to last known good SHA.
2. Sync Argo app via Enclii ops or `enclii apps sync voxa-services`.
3. Re-run smoke tests from deploy workflow or manually curl health endpoints.

## Escalation

- **Platform / Enclii:** MADFAM platform on-call
- **Auth (Janua):** auth.madfam.io operators
- **Billing (Dhanam):** billing on-call when a paying user's token carries the wrong `voxa_tier` (the API logs `voxa entitlement: … resolved to free`)

## Post-incident

Document timeline, root cause, and follow-ups in the team incident log. Update [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) if data recovery was involved.
