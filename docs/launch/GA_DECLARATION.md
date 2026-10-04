# Voxa commercial general availability declaration

> **Historical record (June 2026).** This file records the June 2026 launch plan and is kept for history; it is not the current status. What ships today: [capabilities.md](../capabilities.md). Pending engineering work: [AGENTS.md](../../AGENTS.md#pending-work-and-known-gaps). The June "SLP sign-off" is **withdrawn**: no credentialed speech-language pathologist has reviewed Voxa yet ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md), ruling R89).

**Product:** Voxa AAC platform  
**Production URL:** https://voxa.madfam.io  
**Target declaration date:** 2026-06-19 (after 7-day staging soak from 2026-06-12)

## Status

| Gate | Status |
|------|--------|
| Production live (API + web) | ✅ |
| Janua SSO + API auth enforced | ✅ |
| Legal / privacy / accessibility | ✅ |
| Clinical review | Withdrawn (R89); pending a credentialed reviewer ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md)) |
| Commercial landing + visitor demo | ✅ 2026-06-08 |
| Staging soak (7 consecutive green days) | Never completed ([SOAK_LOG.md](./SOAK_LOG.md); window restarted 2026-06-12, soak tooling retired 2026-10-03) |
| GHCR public | ✅ 2026-06-08 — anonymous pull verified (the Kyverno PolicyException was restored the same day and is still in `k8s/*/`) |

## Pre-declaration verification (run on declaration day)

```bash
# Staging soak (must be green)
./scripts/launch/soak-daily-check.sh
./scripts/launch/soak-scenarios.sh
# (authenticated soak: operator bootstrap with admin credentials, private procedure)

# Production gate
./scripts/launch/verify-prod-ga.sh

# Soak window only (7 consecutive days): operator script, moved to MADFAM's
# private operations repository on 2026-10-03 with the other soak-window tools.

# CI (daily read-only production smoke)
gh workflow run e2e-smoke.yml --repo madfam-org/voxa
```

## Declaration (sign when soak completes)

We declare **Voxa web commercially generally available** at `voxa.madfam.io` for:

- **Individual parents and caregivers** — free tier with cloud sync, OBF, CVI access modes, and starter AI.
- **Institutional customers** — paid clinic/school plans with team roles and aggregate usage insight. (Not grantable yet: paid tiers wait on the plan claim being written; see AGENTS.md.)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product owner | | | |
| Engineering lead | | | |
| Operations | | | |

**Notes:**

- Mobile store GA tracked separately: [MOBILE_GA.md](./MOBILE_GA.md)
- Feature roadmap continues post-GA: [GA_ROADMAP.md](./GA_ROADMAP.md) (Phase 6)
