# Staging soak checklist

Run on **staging** (`voxa-staging.madfam.io`) for at least **7 days** before declaring full commercial GA.

**Soak window:** 2026-06-08 → **2026-06-15** (see [GA_ROADMAP.md](./GA_ROADMAP.md))

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
# Sign in at staging → copy accessToken from /api/auth/session
VOXA_TEST_ACCESS_TOKEN='…' ./scripts/launch/soak-scenarios.sh --with-auth
```

Manual one-liners:

```bash
curl -sS https://voxa-api-staging.madfam.io/health/ready
# expect: store=postgres, authEnforced=true

curl -sS -o /dev/null -w '%{http_code}\n' https://voxa-api-staging.madfam.io/v1/boards
# expect: 401 without Bearer token
```

# GitHub Actions deploy workflows include post-deploy smoke steps on push to `staging`.
# Authenticated soak + CI: `JANUA_ADMIN_EMAIL=… JANUA_ADMIN_PASSWORD=… ./scripts/launch/bootstrap-authenticated-soak.sh`
# then `gh workflow run e2e-smoke.yml --repo madfam-org/voxa`

## Soak log

Record daily results in [SOAK_LOG.md](./SOAK_LOG.md) (auto-appended with `--log`).

## Manual scenarios (once per soak week)

- [x] Janua sign-in → session → authenticated board list/create (automated via `soak-scenarios.sh --with-auth`)
- [x] Sign out and confirm protected routes return 401 (GET `/auth/signout` fixed; manual Playwright `staging-auth-ux` on staging)
- [x] Dhanam billing test mode: entitlement API returns expected tier/limit (automated auth soak)
- [x] AI consent banner: predictions blocked without `X-Voxa-AI-Consent` (automated auth soak)
- [x] Legal pages load (`/legal/privacy`, `/legal/terms`, `/legal/accessibility`)
- [x] OBF import/export smoke — automated auth soak (`soak-scenarios.sh --with-auth`)
- [x] CVI theme + switch scanning modes — settings panel + `use-switch-scan` (manual UX spec on staging)
- [x] SLP sign-off recorded — [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) (owner-authorized 2026-06-08)

## Exit criteria

- [ ] No S1/S2 incidents on staging during soak window
- [ ] Argo app `voxa-staging-services` stays Synced / Healthy
- [ ] Daily soak log green for 7 consecutive days
- [ ] SLP accessibility sign-off recorded ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md))
- [ ] Prod promotion: merge `staging` → `main` only after soak + sign-off

Track overall GA items in [GA_CHECKLIST.md](./GA_CHECKLIST.md) and [GA_ROADMAP.md](./GA_ROADMAP.md).
