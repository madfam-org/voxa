# Voxa commercial general availability declaration

**Product:** Voxa AAC platform  
**Production URL:** https://voxa.madfam.io  
**Target declaration date:** 2026-06-15 (after 7-day staging soak)

## Status

| Gate | Status |
|------|--------|
| Production live (API + web) | ✅ |
| Janua SSO + API auth enforced | ✅ |
| Legal / privacy / accessibility | ✅ |
| SLP accessibility sign-off | ✅ 2026-06-08 ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md)) |
| Commercial landing + visitor demo | ✅ 2026-06-08 |
| Staging soak (7 consecutive green days) | **In progress** → 2026-06-15 ([SOAK_LOG.md](./SOAK_LOG.md)) |
| GHCR public (remove Kyverno PolicyException) | ⏳ Org admin ([GHCR_ORG_ADMIN.md](./GHCR_ORG_ADMIN.md)) |

## Pre-declaration verification (run on declaration day)

```bash
# Staging soak (must be green)
./scripts/launch/soak-daily-check.sh
./scripts/launch/soak-scenarios.sh
JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' \
  ./scripts/launch/bootstrap-authenticated-soak.sh

# Production gate
./scripts/launch/verify-prod-ga.sh

# CI
gh workflow run e2e-smoke.yml --repo madfam-org/voxa
```

## Declaration (sign when soak completes)

We declare **Voxa web commercially generally available** at `voxa.madfam.io` for:

- **Individual parents and caregivers** — free tier with cloud sync, OBF, CVI access modes, and starter AI.
- **Institutional customers** — paid clinic/school plans with team roles and aggregate usage insight.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product owner | | | |
| Engineering lead | | | |
| Operations | | | |

**Notes:**

- Mobile store GA tracked separately: [MOBILE_GA.md](./MOBILE_GA.md)
- Feature parity roadmap continues post-GA: [FEATURE_PARITY.md](./FEATURE_PARITY.md)
