# Staging soak checklist

> **Historical record (June 2026).** This file records the June 2026 launch plan and is kept for history; it is not the current status. What ships today: [capabilities.md](../capabilities.md). Pending engineering work: [AGENTS.md](../../AGENTS.md#pending-work-and-known-gaps). The June "SLP sign-off" is **withdrawn**: no credentialed speech-language pathologist has reviewed Voxa yet ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md), ruling R89).

Run on **staging** (`voxa-staging.madfam.io`) for at least **7 days** before declaring full commercial GA.

**Soak window:** 2026-06-12 → **2026-06-19** (restarted after prod i18n rollout + missed daily logs 2026-06-09–11; see [GA_ROADMAP.md](./GA_ROADMAP.md))

## Environment

| URL | Role |
|-----|------|
| https://voxa-staging.madfam.io | Web |
| https://voxa-app-staging.madfam.io | Web (alt) |
| https://voxa-api-staging.madfam.io | API |

## Daily automated checks

Run locally or via scheduled CI (`e2e-smoke` workflow, weekdays 14:00 UTC):

```bash
./scripts/launch/soak-daily-check.sh
# optional: append result to soak log
./scripts/launch/soak-daily-check.sh --log docs/launch/SOAK_LOG.md

# Extended automated scenarios (legal, auth gates):
./scripts/launch/soak-scenarios.sh

# With Janua voxa session + OBF import/export on staging:
# Get a token with ./scripts/launch/fetch-staging-access-token.sh
# (the web session never exposes one to the page)
VOXA_TEST_ACCESS_TOKEN='…' ./scripts/launch/soak-scenarios.sh --with-auth
```

Manual one-liners:

```bash
curl -sS https://voxa-api-staging.madfam.io/health/ready
# expect: store=postgres, authEnforced=true

curl -sS -o /dev/null -w '%{http_code}\n' https://voxa-api-staging.madfam.io/v1/boards
# expect: 401 without Bearer token
```

Since 2026-10-04 staging rebuilds from `main` on every merge, beside production, and the daily smoke runs the signed-in specs against it (`pnpm test:e2e:staging:signed-in`); they skip without the `VOXA_STAGING_*` repository secrets. There is no `staging` branch any more.

## Soak log

Record daily results in [SOAK_LOG.md](./SOAK_LOG.md) (auto-appended with `--log`).

## Manual scenarios (once per soak week)

- [x] Janua sign-in → session → authenticated board list/create (automated via `soak-scenarios.sh --with-auth`)
- [x] Sign out and confirm protected routes return 401 (GET `/auth/signout` fixed; manual Playwright `staging-auth-ux` on staging)
- [x] Entitlement API returns the expected tier/limit (automated auth soak; since 2026-10-04 the tier comes from the Janua `voxa_tier` claim)
- [x] AI consent: predictions blocked without the user's server-side `ai_processing` record (`PUT /v1/consents`; automated auth soak)
- [x] Legal pages load (`/legal/privacy`, `/legal/terms`, `/legal/accessibility`)
- [x] OBF import/export smoke — automated auth soak (`soak-scenarios.sh --with-auth`)
- [x] CVI theme + switch scanning modes — settings panel + `use-switch-scan` (manual UX spec on staging)
- [ ] Clinical review — the June record is withdrawn (R89); pending ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md))

## Exit criteria

- [ ] No S1/S2 incidents on staging during soak window
- [ ] Argo app `voxa-staging-services` stays Synced / Healthy
- [ ] Daily soak log green for 7 consecutive days
- [ ] Clinical review recorded ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md), pending)
- [ ] ~~Prod promotion: merge `staging` → `main`~~ (superseded: production and staging both deploy from `main`)

Track overall GA items in [GA_CHECKLIST.md](./GA_CHECKLIST.md) and [GA_ROADMAP.md](./GA_ROADMAP.md).
