# Commercial GA checklist

Track progress toward general availability at `voxa.madfam.io`.

## Platform (Enclii / ops)

- [ ] GHCR packages public; Kyverno `PolicyException` removed
- [ ] `ENCLII_CALLBACK_TOKEN` set on `madfam-org/voxa`
- [ ] GitHub webhook → `https://api.enclii.dev/v1/webhooks/github`
- [ ] `DATABASE_URL` bound via Enclii addon (prod addon provisioned; bind when ready)
- [ ] `REDIS_URL` applied (WebSocket multi-replica — post-GA scaling)
- [x] Post-deploy smoke tests in deploy workflows (prod + staging)
- [x] Backup/restore runbook (`docs/ops/BACKUP_RESTORE.md`)
- [x] On-call runbook (`docs/ops/RUNBOOK.md`)
- [x] Sentry hook (`SENTRY_DSN` on API — optional until DSN provisioned)

## Product / API

- [x] PostgreSQL store + migrations (`DATABASE_URL`)
- [x] `/health/ready` with store ping
- [x] Janua SSO scaffold (web OIDC + API JWT verification)
- [ ] Janua OAuth client registered + secrets applied in prod
- [ ] `JANUA_AUTH_REQUIRED=true` after OIDC live
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
- [ ] `@axe-core/playwright` in CI
- [ ] Mobile EAS pipeline + store listings

## Launch

- [ ] Staging soak (1 week) with auth + billing test mode
- [x] Version `1.0.0` in repo (tag pending release)
- [ ] SLP accessibility sign-off
- [ ] Status page linked from README

See [CHANGELOG.md](../CHANGELOG.md) and [data-model.md](../data-model.md).
