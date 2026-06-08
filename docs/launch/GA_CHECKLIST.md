# Commercial GA checklist

Track progress toward general availability at `voxa.madfam.io`.

## Platform (Enclii / ops)

- [ ] GHCR packages public; Kyverno `PolicyException` removed — `scripts/deploy/make-ghcr-packages-public.sh`
- [x] `ENCLII_CALLBACK_TOKEN` set on `madfam-org/voxa` (2026-06-07; synced across MADFAM deploy repos)
- [x] GitHub webhook registered on `madfam-org/voxa` → `https://api.enclii.dev/v1/webhooks/github` (hook `637900323`)
- [x] Enclii webhook signature verified (2026-06-08; scale + restart — see [GA_STATUS.md](./GA_STATUS.md))
- [x] `DATABASE_URL` applied via shared Postgres (`data/postgres`, prod + staging live)
- [ ] PgBouncer config includes `voxa` / `voxa_staging` (platform RBAC fix)
- [ ] `REDIS_URL` applied (WebSocket multi-replica — post-GA scaling)
- [x] Post-deploy smoke tests in deploy workflows (prod + staging)
- [x] Backup/restore runbook (`docs/ops/BACKUP_RESTORE.md`)
- [x] On-call runbook (`docs/ops/RUNBOOK.md`)
- [x] Sentry hook (`SENTRY_DSN` on API — optional until DSN provisioned)

## Product / API

- [x] PostgreSQL store + migrations (`DATABASE_URL`)
- [x] `/health/ready` with store ping
- [x] Janua SSO scaffold (web OIDC + API JWT verification)
- [x] Janua OAuth client registered + `OIDC_CLIENT_SECRET` in prod secrets
- [x] Janua client audience `voxa` aligned with API `JANUA_AUDIENCE`
- [x] `NEXT_PUBLIC_OIDC_CLIENT_ID` GitHub repo variable (`jnc_4qRWyI-ul_GL28hrSxrX7AvIyotFMBuB`)
- [x] `JANUA_AUTH_REQUIRED=true` — prod + staging (`VOXA_JANUA_AUTH_REQUIRED`, verify `health/ready.authEnforced`)
- [x] Board ownership / tenant isolation (`owner_user_id`, route ACLs)
- [x] Dhanam billing + entitlements (`/v1/billing/entitlement`, board limits)
- [x] Production AI MVP (consent-gated `/v1/ai/*`, LLM when `OPENAI_API_KEY` set)
- [x] Rate limiting + tightened CORS (madfam.io origins)

## Legal & trust

- [x] Privacy policy live (`/legal/privacy`)
- [x] Terms of service live (`/legal/terms`)
- [x] Accessibility statement live (`/legal/accessibility`)
- [x] Consent banner for AI telemetry

## Quality

- [x] Board route integration tests (incl. tenant isolation)
- [x] Store operation unit tests
- [x] Playwright e2e smoke specs (`e2e/specs/smoke.spec.ts`)
- [x] `@axe-core/playwright` in CI (`e2e/specs/a11y.spec.ts`, `.github/workflows/ci.yml`)
- [ ] Mobile EAS pipeline + store listings — [MOBILE_GA.md](./MOBILE_GA.md)

## Launch

- [ ] Staging soak (1 week) — **in progress** 2026-06-08 → 2026-06-15 — [STAGING_SOAK.md](./STAGING_SOAK.md) · [SOAK_LOG.md](./SOAK_LOG.md)
- [x] Version `1.0.0` tag (`v1.0.0` on `313a4e6`)
- [x] API `1.0.0` live on prod + staging (2026-06-07)
- [ ] SLP accessibility sign-off — [SLP_SIGNOFF.md](./SLP_SIGNOFF.md)
- [x] Status page linked from README ([status.madfam.io](https://status.madfam.io))

**Roadmap:** [GA_ROADMAP.md](./GA_ROADMAP.md)

## Operator quick commands

Full status and IDs: **[GA_STATUS.md](./GA_STATUS.md)**.

```bash
# All-in-one (needs ENCLII_TOKEN; optional Janua + GitHub secret env vars):
ENCLII_TOKEN='…' ./scripts/deploy/complete-ga-operator.sh

# Shared Postgres (prod + staging DATABASE_URL):
ENCLII_TOKEN='…' ./scripts/deploy/provision-shared-postgres.sh

# Janua OAuth client (once per platform):
JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' ./scripts/deploy/register-janua-oauth-client.sh

# GitHub lifecycle callbacks (token = enclii-argocd-webhook secret):
ENCLII_CALLBACK_TOKEN='…' ./scripts/deploy/setup-github-secrets.sh

# GitHub push webhook (secret = enclii-github-webhook secret):
ENCLII_WEBHOOK_SECRET='…' ./scripts/deploy/setup-github-webhook.sh

# After API env-only deploys (authEnforced):
ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-api.sh all

# After platform webhook secret rotation:
ENCLII_TOKEN='…' ENCLII_WEBHOOK_SECRET='…' ./scripts/deploy/rollout-switchyard-api.sh --via-enclii-scale
# or break-glass SSH: ./scripts/deploy/rollout-switchyard-api.sh
```

See [CHANGELOG.md](../CHANGELOG.md) and [data-model.md](../data-model.md).
