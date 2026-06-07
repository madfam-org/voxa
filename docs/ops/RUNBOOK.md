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

Expected ready payload: `{"status":"ready","service":"voxa-api","store":"postgres"}` once `DATABASE_URL` is bound.

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
3. Set `VOXA_JANUA_AUTH_REQUIRED=true` on the API deployment (not only in secrets — `envFrom` can override `JANUA_AUTH_REQUIRED`). Verify rollout with `curl -sS https://voxa-api.madfam.io/health/ready | jq .authEnforced` before enabling traffic.

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
