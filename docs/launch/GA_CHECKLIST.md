# Commercial GA checklist

> **Historical record (June 2026).** This file records the June 2026 launch plan and is kept for history; it is not the current status. What ships today: [capabilities.md](../capabilities.md). Pending engineering work: [AGENTS.md](../../AGENTS.md#pending-work-and-known-gaps). The June "SLP sign-off" is **withdrawn**: no credentialed speech-language pathologist has reviewed Voxa yet ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md), ruling R89).

Track progress toward general availability at `voxa.madfam.io`.

> Public-safe checklist. Operator procedures, platform identifiers and commercial research live in MADFAM's private operations repository.

## Platform (Enclii / ops)

- [x] GHCR packages public (2026-06-08)
- [ ] Kyverno `PolicyException` removed (it was restored on 2026-06-08 and is still in `k8s/*/signature-policyexception.yaml`)
- [x] `ENCLII_CALLBACK_TOKEN` set on `madfam-org/voxa` (2026-06-07; synced across MADFAM deploy repos)
- [x] GitHub webhook registered on `madfam-org/voxa` → `https://api.enclii.dev/v1/webhooks/github`
- [x] Enclii webhook signature verified (2026-06-08)
- [x] `DATABASE_URL` applied via the shared PostgreSQL server (prod + staging live)
- [ ] PgBouncer entries for the Voxa databases (platform fix; direct connections work today)
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
- [x] `NEXT_PUBLIC_OIDC_CLIENT_ID` GitHub repo variable set
- [x] `JANUA_AUTH_REQUIRED=true` — prod + staging (`VOXA_JANUA_AUTH_REQUIRED`, verify `health/ready.authEnforced`)
- [x] Board ownership / tenant isolation (`owner_user_id`, route ACLs)
- [x] Plan entitlements and board limits (`/v1/billing/entitlement`); since 2026-10-04 read from the Janua `voxa_tier` claim, not from the billing API
- [x] Consent-gated word suggestions (`/v1/ai/*`); since 2026-10-04 local only, with the switched-off Selva path (the third-party LLM backend was removed)
- [x] Rate limiting + tightened CORS (madfam.io origins)

## Legal & trust

- [x] Privacy policy live (`/legal/privacy`)
- [x] Terms of service live (`/legal/terms`)
- [x] Accessibility statement live (`/legal/accessibility`)
- [x] Consent banner for AI telemetry
- [x] Commercial landing + visitor demo at `/` and `/demo`; communicator at `/app` (2026-06-08)

## Quality

- [x] Board route integration tests (incl. tenant isolation)
- [x] Store operation unit tests
- [x] Playwright e2e smoke specs (`e2e/specs/smoke.spec.ts`)
- [x] `@axe-core/playwright` in CI (`e2e/specs/a11y.spec.ts`, `.github/workflows/ci.yml`)
- [ ] Mobile EAS pipeline + store listings — [MOBILE_GA.md](./MOBILE_GA.md) — preview CI ✅

## Feature roadmap (Phase 6)

Competitive research, the parity tracker and scorecard targets are private commercial material. Public status of shipped features is in [CHANGELOG.md](../../CHANGELOG.md).

- [x] Migration guide: OBF import path — [MIGRATION.md](./MIGRATION.md)
- [x] Recorded speech + GLP media, OBZ import; symbol search since 2026-10-04 on Mulberry Symbols only (the earlier non-commercial library was removed)
- [ ] Mobile store beta (M4)
- [ ] Usage logs + co-edit
- [ ] Hardware access + legacy-format import
- [ ] Clinical review by a credentialed SLP (pending; [SLP_SIGNOFF.md](./SLP_SIGNOFF.md))

## Launch

- [x] `VOXA_STAGING_*` GitHub secrets for CI auth soak (operator bootstrap, 2026-06-08)
- [x] Weekday `e2e-smoke` CI (health + auth API soak + Playwright) — green 2026-06-08
- [ ] Staging soak (1 week) — opened 2026-06-12, never completed (the soak tooling was retired on 2026-10-03) — [STAGING_SOAK.md](./STAGING_SOAK.md) · [SOAK_LOG.md](./SOAK_LOG.md)
- [ ] **Commercial GA declaration** — sign [GA_DECLARATION.md](./GA_DECLARATION.md) after soak completes
- [ ] Clinical review — the June "sign-off" by the product team is withdrawn (R89); pending a credentialed reviewer ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md))
- [x] Version `1.0.0` tag (`v1.0.0` on `313a4e6`)
- [x] API `1.0.0` live on prod + staging (2026-06-07)
- [x] Status page linked from README ([status.madfam.io](https://status.madfam.io))

**Roadmap:** [GA_ROADMAP.md](./GA_ROADMAP.md) · **Remediation:** [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md)

## Operator steps

Platform operator steps (database provisioning, Janua client registration, repository webhook and secrets, service restarts) are run with admin credentials from MADFAM's private operations repository. The public verification scripts are in `scripts/launch/`.

See [CHANGELOG.md](../../CHANGELOG.md) and [data-model.md](../data-model.md).
