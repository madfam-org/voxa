# Voxa on-call runbook

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
3. Inspect API pod logs: `kubectl logs -l app=voxa-api -n voxa --tail=200`.
4. If migrations failed, fix schema and restart deployment.

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
3. **Rolling-restart API** (Argo ignores `restartedAt`; env-only changes may not recycle pods):
   ```bash
   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-api.sh all
   ```
4. Re-verify:
   ```bash
   curl -sS https://voxa-api.madfam.io/health/ready
   curl -sS -o /dev/null -w '%{http_code}\n' https://voxa-api.madfam.io/v1/boards
   ```
5. Sign in at `https://voxa.madfam.io/auth/signin` and confirm `/api/auth/session` returns a token that succeeds against `/v1/boards`.

### Rate limit spikes (429)

1. Identify abusive IP or user via ingress logs.
2. Temporarily lower `RATE_LIMIT_PER_MINUTE` on API deployment if needed.
3. Escalate repeat offenders through MADFAM security channel.

## Rollback

1. Revert the digest in `k8s/production/voxa-api-deployment.yaml` or `voxa-web-deployment.yaml` to last known good SHA.
2. Sync Argo app via Enclii ops or `enclii apps sync voxa-services`.
3. Re-run smoke tests from deploy workflow or manually curl health endpoints.

## Escalation

- **Platform / Enclii:** MADFAM platform on-call
- **Auth (Janua):** auth.madfam.io operators
- **Billing (Dhanam):** billing on-call when entitlements API errors persist

## Post-incident

Document timeline, root cause, and follow-ups in the team incident log. Update [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) if data recovery was involved.
