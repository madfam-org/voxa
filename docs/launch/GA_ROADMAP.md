# Voxa commercial GA roadmap

Target: **full commercial general availability** for the Voxa AAC platform at [voxa.madfam.io](https://voxa.madfam.io).

Track checkbox progress in [GA_CHECKLIST.md](./GA_CHECKLIST.md). Live deploy state: [GA_STATUS.md](./GA_STATUS.md).

## Current state (2026-06-08)

| Area | Status |
|------|--------|
| Production + staging | Live, `authEnforced: true`, Postgres |
| Deploy automation | Enclii GitOps + GitHub webhook verified |
| Product (web) | Boards, Janua SSO, billing, AI MVP, legal, **commercial landing + demo** |
| Controlled launch | **Active** — prod commercial funnel live 2026-06-08 |
| Full commercial GA | **Soak gate** — declare **2026-06-15** ([GA_DECLARATION.md](./GA_DECLARATION.md)) |

## Phases

```mermaid
gantt
  title Voxa GA phases (2026)
  dateFormat YYYY-MM-DD
  section Launch gate
  Staging soak (7d)           :active, soak, 2026-06-08, 7d
  SLP accessibility sign-off  :slp, after soak, 3d
  Prod promotion sign-off     :promo, after slp, 1d
  section Platform
  GHCR public + Kyverno cleanup :ghcr, 2026-06-08, 5d
  PgBouncer RBAC (optional)     :pgb, 2026-06-10, 7d
  section Quality
  axe-core in CI                :axe, 2026-06-08, 2d
  Mobile EAS + store listings   :mobile, 2026-06-15, 21d
  section Post-GA
  REDIS_URL multi-replica WS    :redis, 2026-06-22, 14d
  section Parity
  Feature parity P1 baseline    :parity, 2026-06-18, 42d
  Tier A competitive match      :parity2, 2026-07-20, 60d
```

### Phase 1 — Launch gate (product / clinical)

**Goal:** Confidence that staging behaves like production for AAC workflows before declaring GA.

| Work item | Owner | Target | Doc |
|-----------|-------|--------|-----|
| 7-day staging soak | Ops | 2026-06-08 → **2026-06-15** | [STAGING_SOAK.md](./STAGING_SOAK.md) |
| Daily automated health checks | CI + script | Daily during soak | `scripts/launch/soak-daily-check.sh` |
| Manual AAC scenarios (Janua, OBF, CVI, switch) | Product / QA | Once during soak | [STAGING_SOAK.md](./STAGING_SOAK.md) |
| SLP accessibility sign-off | Clinical | ✅ 2026-06-08 (owner-authorized) | [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) |
| Merge `staging` → `main` | Engineering | After sign-off | Enclii deploy workflows |

**Exit criteria:** No S1/S2 on staging; Argo `voxa-staging-services` Synced/Healthy; SLP sign-off recorded; soak log complete.

### Phase 2 — Platform hygiene

**Goal:** Remove temporary infra exceptions; align with MADFAM platform standards.

| Work item | Owner | Target | Notes |
|-----------|-------|--------|-------|
| GHCR packages public (`voxa-api`, `voxa-web`) | Org admin | ✅ 2026-06-08 | [GHCR_ORG_ADMIN.md](./GHCR_ORG_ADMIN.md) |
| Remove `k8s/*/signature-policyexception.yaml` | Engineering | ✅ 2026-06-08 | [GHCR_ORG_ADMIN.md](./GHCR_ORG_ADMIN.md) |
| PgBouncer entries for `voxa` / `voxa_staging` | Platform | Non-blocking | Direct Postgres OK today |
| Cluster CPU headroom | Platform | Ongoing | Prevents `switchyard-api` Pending rollouts |

### Phase 3 — Quality & accessibility automation

**Goal:** Prevent WCAG regressions on critical AAC flows in CI.

| Work item | Owner | Target | Notes |
|-----------|-------|--------|-------|
| `@axe-core/playwright` on home + legal pages | Engineering | 2026-06-08 | `e2e/specs/a11y.spec.ts`, CI job |
| Extend axe coverage to communicator + settings | Engineering | Post-GA | Editor mode, CVI themes |
| Playwright smoke (staging) | CI | Daily weekdays | `.github/workflows/e2e-smoke.yml` |

### Phase 4 — Mobile commercial path

**Goal:** Native iOS/Android store presence (parallel to web GA).

| Work item | Owner | Target | Doc |
|-----------|-------|--------|-----|
| EAS build profiles (preview + production) | Mobile | 2026-06-15 | [MOBILE_GA.md](./MOBILE_GA.md) |
| TestFlight / Play internal testing | Mobile | +1 week | |
| Store listings + privacy nutrition labels | Product / legal | Before public store GA | |
| Janua deep link + sync on device | Mobile | Before store GA | |

Web GA does **not** block on mobile store listings; mobile is tracked as **Phase 4**.

### Phase 5 — Post-GA scaling

| Work item | When | Notes |
|-----------|------|-------|
| `REDIS_URL` for WebSocket fan-out | After multi-replica API | Horizontal real-time sync |
| `SENTRY_DSN` in prod | When DSN provisioned | Hook already in API |
| Symbol generation / PictoBERT | Product roadmap | [ai-roadmap.md](../ai-roadmap.md) |

### Phase 6 — Competitive feature parity

**Goal:** Close gaps vs Tier A AAC apps (Proloquo2Go, TD Snap, LAMP, SFY, Grid) documented in [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md). Track rows in [FEATURE_PARITY.md](./FEATURE_PARITY.md).

**Not a single-release gate:** Web GA (M3) requires P0 parity + SLP sign-off (~52% weighted score). Platform GA (M5) targets **~75%+ weighted parity** plus differentiation.

| Work stream | Priority | Target | Parity doc section |
|-------------|----------|--------|-------------------|
| Multi-board library + motor-plan locks in UI | P1 | Q3 2026 | P1 vocabulary |
| ARASAAC / OpenSymbols integration | P1 | Q3 2026 | P1 symbols |
| Recorded speech + GLP media upload | P1 | Q3 2026 | P1 GLP |
| Hide/show + babble mode | P1 | Q3 2026 | OpenAAC backlog |
| Usage logs + SLP reporting UI | P1 | Q3 2026 | P1 analytics |
| Grid/TouchChat/Snap import (AACProcessors) | P2 | Q4 2026 | Migration paths |
| Hardware switch + Tobii eye gaze SDK | P2 | Q4 2026 | P2 access |
| Neural bilingual TTS | P2 | Q4 2026 | P2 speech |
| PictoBERT + symbol generation GA | P3 | 2026 H2 | P3 differentiation |

**Exit criteria (M5+ parity):** P0 all ✅; P1 ≥ 80% ✅/🟡; weighted scorecard ≥ 75%; quarterly benchmark doc refresh.

## Milestones

| Milestone | Date (target) | Definition of done |
|-----------|---------------|-------------------|
| **M0 — Controlled launch** | 2026-06-07 | Prod live, auth enforced, legal pages, deploy hooks |
| **M1 — Webhook verified** | 2026-06-08 | GitHub → Enclii ping → 200 |
| **M2 — Soak complete** | 2026-06-15 | 7-day log green, manual scenarios checked |
| **M3 — Full web GA** | 2026-06-15 | Soak complete + [GA_DECLARATION.md](./GA_DECLARATION.md) signed |
| **M4 — Mobile beta** | 2026-07-06 | EAS builds in TestFlight / Play internal |
| **M5 — Full platform GA** | 2026-07-20 | Web + mobile store listings live |
| **M6 — Tier A parity baseline** | 2026-09-30 | P1 ≥ 80%; scorecard ≥ 75% ([FEATURE_PARITY.md](./FEATURE_PARITY.md)) |

## Operator commands

```bash
# Daily soak (staging health + optional GitHub issue comment)
./scripts/launch/soak-daily-check.sh

# Full platform operator pass
ENCLII_TOKEN='…' ./scripts/deploy/complete-ga-operator.sh

# GHCR visibility (org admin, read:packages scope)
./scripts/deploy/make-ghcr-packages-public.sh

# After GHCR public — remove PolicyExceptions and sync Argo
git rm k8s/production/signature-policyexception.yaml k8s/staging/signature-policyexception.yaml
# update kustomization.yaml in each env, commit, push
```

## Related docs

- [GA_CHECKLIST.md](./GA_CHECKLIST.md) — checkbox tracker
- [GA_STATUS.md](./GA_STATUS.md) — deploy state and platform IDs
- [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md) — competitive research
- [FEATURE_PARITY.md](./FEATURE_PARITY.md) — parity checklist vs Tier A AAC
- [STAGING_SOAK.md](./STAGING_SOAK.md) — soak procedures and log
- [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — clinical accessibility gate
- [MOBILE_GA.md](./MOBILE_GA.md) — Expo / EAS store path
- [../accessibility.md](../accessibility.md) — WCAG 2.2 standards
- [../ai-roadmap.md](../ai-roadmap.md) — AI features post-GA
