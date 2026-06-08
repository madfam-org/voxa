# Voxa full GA remediation plan

**Target:** Close remaining M2–M3 gates for full web commercial GA by **2026-06-18**.

Track execution in [GA_CHECKLIST.md](./GA_CHECKLIST.md). Live state: [GA_STATUS.md](./GA_STATUS.md).

## Remediation waves

| Wave | Focus | Status | Exit |
|------|-------|--------|------|
| **W0** | Platform hygiene (GHCR, Kyverno, webhook) | ✅ Done 2026-06-08 | PolicyExceptions removed |
| **W1** | Soak automation + ops safety | 🟡 This sprint | CI auth soak green; Janua script idempotent |
| **W2** | P0 product gaps | 🟡 This sprint | OBF soak ✅; board library; migration doc |
| **W3** | Clinical + launch gate | Pending | SLP sign-off; 7-day soak log |
| **W4** | P1 baseline (post-GA) | Q3 2026 | Parity ≥ 80% P1 |

## W1 — Soak automation & ops safety

| # | Item | Implementation | Owner |
|---|------|----------------|-------|
| 1 | Janua OAuth script idempotent | `register-janua-oauth-client.sh` — noop on 409; `--rotate-secret` opt-in | Engineering ✅ |
| 2 | Auth soak in CI | `e2e-smoke.yml` + GitHub secrets → `fetch-staging-access-token.sh` | Engineering ✅ |
| 3 | Extended API soak | `soak-scenarios.sh --with-auth`: billing, AI consent, board create | Engineering ✅ |
| 4 | Daily soak cron | Weekdays 14:00 UTC (`e2e-smoke.yml`) | CI ✅ |

**GitHub secrets (repo `madfam-org/voxa`):**

| Secret | Purpose |
|--------|---------|
| `VOXA_STAGING_OIDC_CLIENT_ID` | Janua confidential client |
| `VOXA_STAGING_OIDC_CLIENT_SECRET` | Token exchange |
| `VOXA_STAGING_TEST_EMAIL` | Soak test user |
| `VOXA_STAGING_TEST_PASSWORD` | Soak test user |

## W2 — P0 product remediation

| # | Item | Implementation | Parity |
|---|------|----------------|--------|
| 5 | OBF import validation | Auth soak round-trip on staging | P0 ✅ |
| 6 | Multi-board library | Web board picker + `createBoard()` sync client | P1 → MVP for GA |
| 7 | Migration guide | [MIGRATION.md](./MIGRATION.md) | Checklist ✅ |
| 8 | Symbol display modes | `hideLabels` + existing `hideSymbols` | P1 partial |
| 9 | Per-button hide | `hidden` flag on buttons (editor) | P1 partial |

## W3 — Launch gate (human + time)

| # | Item | Action |
|---|------|--------|
| 10 | Staging soak 7 days | `./scripts/launch/soak-scenarios.sh` daily through **2026-06-15** |
| 11 | Manual scenarios | [STAGING_SOAK.md](./STAGING_SOAK.md) — CVI, switch, editor OBF |
| 12 | SLP sign-off | [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — clinical reviewer |
| 13 | Declare M3 web GA | Update README/CHANGELOG; comms |

## W4 — Platform & parity (post-M3)

| # | Item | Notes |
|---|------|-------|
| 14 | PgBouncer RBAC | Platform — `voxa` / `voxa_staging` in `pgbouncer-config` |
| 15 | `REDIS_URL` | Multi-replica WebSocket sync |
| 16 | Mobile EAS | [MOBILE_GA.md](./MOBILE_GA.md) |
| 17 | `.obz` + ARASAAC | [FEATURE_PARITY.md](./FEATURE_PARITY.md) P1 |
| 18 | Janua duplicate client | Deactivate stray `jnc_GbA_…` in Janua admin; keep `jnc_4qRWyI…` | ✅ Script + 3 deactivated 2026-06-08 |

## Verification commands

```bash
# Unauthenticated soak
./scripts/launch/soak-scenarios.sh

# Authenticated soak (needs voxa-audience token)
VOXA_TEST_ACCESS_TOKEN='…' ./scripts/launch/soak-scenarios.sh --with-auth

# Or headless token fetch
OIDC_CLIENT_ID='…' OIDC_CLIENT_SECRET='…' \
JANUA_TEST_EMAIL='…' JANUA_TEST_PASSWORD='…' \
VOXA_TEST_ACCESS_TOKEN="$(./scripts/launch/fetch-staging-access-token.sh)" \
  ./scripts/launch/soak-scenarios.sh --with-auth

# Unit + typecheck
pnpm test && pnpm typecheck
```

## Definition of done (full web GA)

- [x] GHCR public; Kyverno bypass removed
- [x] Automated staging soak (unauthenticated + auth when secrets set)
- [x] OBF auth round-trip validated
- [ ] 7 consecutive daily soak log entries green
- [ ] SLP sign-off recorded
- [ ] No open S1/S2 on staging during soak window
