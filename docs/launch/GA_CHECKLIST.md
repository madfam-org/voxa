# Commercial GA checklist

Track progress toward general availability at `voxa.madfam.io`.

## Platform (Enclii / ops)

- [ ] GHCR packages public; Kyverno `PolicyException` removed
- [ ] `ENCLII_CALLBACK_TOKEN` set on `madfam-org/voxa`
- [ ] GitHub webhook → `https://api.enclii.dev/v1/webhooks/github`
- [ ] `DATABASE_URL` applied via Enclii secrets (PostgreSQL live)
- [ ] `REDIS_URL` applied (WebSocket multi-replica — post-GA scaling)
- [ ] Post-deploy smoke tests green in CI
- [ ] Backup/restore runbook tested (`docs/ops/` — TBD)
- [ ] Sentry or equivalent error tracking

## Product / API

- [x] PostgreSQL store + migrations (`DATABASE_URL`)
- [x] `/health/ready` with store ping
- [x] Janua SSO scaffold (web OIDC + API JWT verification)
- [ ] Janua OAuth client registered + secrets applied in prod
- [ ] `JANUA_AUTH_REQUIRED=true` after OIDC live
- [ ] Board membership / tenant isolation
- [ ] Dhanam billing + entitlements
- [ ] Production AI MVP (consent-gated LLM proxy)
- [ ] Rate limiting + tightened CORS

## Legal & trust

- [ ] Privacy policy live
- [ ] Terms of service live
- [ ] Accessibility statement
- [ ] Consent banner for AI telemetry

## Quality

- [x] Board route integration tests
- [x] Store operation unit tests
- [ ] Playwright e2e (communicator + editor flows)
- [ ] `@axe-core/playwright` in CI
- [ ] Mobile EAS pipeline + store listings

## Launch

- [ ] Staging soak (1 week) with auth + billing test mode
- [ ] Version `1.0.0` tag
- [ ] SLP accessibility sign-off
- [ ] Status page + on-call runbook

See [CHANGELOG.md](../CHANGELOG.md) and [data-model.md](../data-model.md).
