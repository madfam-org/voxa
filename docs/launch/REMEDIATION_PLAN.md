# Voxa full GA remediation plan

**Target:** Close remaining M2–M3 gates for full web commercial GA by **2026-06-15**.

**Benchmark parity (M6):** See [PARITY_REMEDIATION_PLAN.md](./PARITY_REMEDIATION_PLAN.md) — separate multi-quarter program (~38% → ≥75% weighted scorecard).

Track execution in [GA_CHECKLIST.md](./GA_CHECKLIST.md). Live state: [GA_STATUS.md](./GA_STATUS.md).

## Remediation waves

| Wave | Focus | Status | Exit |
|------|-------|--------|------|
| **W0** | Platform hygiene (GHCR, Kyverno, webhook) | ✅ Done 2026-06-08 | PolicyExceptions removed |
| **W1** | Soak automation + ops safety | 🟡 In progress | CI auth soak green; daily soak log 7/7 |
| **W2** | P0 product gaps | 🟡 In progress | OBF soak ✅; board library MVP; migration doc |
| **W3** | Clinical + launch gate | 🟡 In progress | SLP ✅ 2026-06-08; soak through **2026-06-15** |
| **W4** | P1 baseline (post-M3) | Q3 2026 | [PARITY_REMEDIATION_PLAN.md](./PARITY_REMEDIATION_PLAN.md) W1–W2 |
| **W5** | P2 + M6 parity | Q3–Q4 2026 | Scorecard ≥ 75%; SLP parity sign-off |

## W1 — Soak automation & ops safety

| # | Item | Implementation | Owner |
|---|------|----------------|-------|
| 1 | Janua OAuth script idempotent | `register-janua-oauth-client.sh` — noop on 409; `--rotate-secret` opt-in | Engineering ✅ |
| 2 | Auth soak in CI | `e2e-smoke.yml` + GitHub secrets → `fetch-staging-access-token.sh` | Engineering ✅ |
| 3 | Extended API soak | `soak-scenarios.sh --with-auth`: billing, AI consent, board create | Engineering ✅ |
| 4 | Daily soak cron | Daily 14:00 UTC through GA window (`e2e-smoke.yml`) | CI ✅ |
| 5 | Prod GA gate in CI | `verify-prod-ga.sh` in e2e-smoke | Engineering ✅ |
| 6 | Soak completion verifier | `verify-soak-window.sh` for declaration day | Engineering ✅ |

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
| 10 | Staging soak 7 days | Daily `e2e-smoke` + `./scripts/launch/soak-daily-check.sh --log` through **2026-06-14** |
| 11 | Manual scenarios | [STAGING_SOAK.md](./STAGING_SOAK.md) — CVI, switch, editor OBF |
| 12 | SLP sign-off | ✅ [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — 2026-06-08 |
| 13 | Declare M3 web GA | [GA_DECLARATION.md](./GA_DECLARATION.md) on/after **2026-06-15** |

## W4 — P1 parity (post-M3)

Full epic breakdown: [PARITY_REMEDIATION_PLAN.md § Epic B–E](./PARITY_REMEDIATION_PLAN.md).

| # | Item | Target |
|---|------|--------|
| 14 | ARASAAC symbol search + media upload | W2 (2026-07) |
| 15 | Recorded speech + GLP media | W2 |
| 16 | Editor motor-plan locks + babble | W2 |
| 17 | Mobile EAS preview | M4 — [MOBILE_GA.md](./MOBILE_GA.md) |
| 18 | Usage logs + SLP reporting | W3 |

## W5 — P2 parity → M6

| # | Item | Target |
|---|------|--------|
| 19 | Grid/TouchChat/Snap import | W5 — AACProcessors |
| 20 | Hardware switch + gaze adapters | W4 |
| 21 | Neural bilingual TTS | W6 — [ai-roadmap.md](../ai-roadmap.md) |
| 22 | M6 scorecard ≥ 75% | 2026-09-30 |

## Platform (non-blocking for M3)

| # | Item | Notes |
|---|------|-------|
| — | PgBouncer RBAC | Platform — direct Postgres OK |
| — | `REDIS_URL` | Multi-replica WebSocket co-edit |
| — | Janua duplicate client | ✅ 3 deactivated 2026-06-08 |

## Verification commands

```bash
# Soak window (declaration day)
./scripts/launch/verify-soak-window.sh --required 7 --start 2026-06-08
./scripts/launch/verify-prod-ga.sh

# Unauthenticated soak
./scripts/launch/soak-scenarios.sh

# Authenticated soak
VOXA_TEST_ACCESS_TOKEN='…' ./scripts/launch/soak-scenarios.sh --with-auth

# Unit + typecheck
pnpm test && pnpm typecheck
```

## Definition of done (full web GA — M3)

- [x] GHCR public; Kyverno bypass removed
- [x] Automated staging soak (unauthenticated + auth when secrets set)
- [x] OBF auth round-trip validated
- [x] SLP sign-off recorded
- [ ] 7 consecutive daily soak log entries green (2026-06-08 → 2026-06-14)
- [ ] [GA_DECLARATION.md](./GA_DECLARATION.md) signed on/after 2026-06-15
- [ ] No open S1/S2 on staging during soak window

## Definition of done (full benchmark parity — M6)

See [PARITY_REMEDIATION_PLAN.md §9](./PARITY_REMEDIATION_PLAN.md#9-definition-of-done--full-benchmark-parity-m6).
