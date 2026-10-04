# Staging soak log

> **Historical record (June 2026).** This file records the June 2026 launch plan and is kept for history; it is not the current status. What ships today: [capabilities.md](../capabilities.md). Pending engineering work: [AGENTS.md](../../AGENTS.md#pending-work-and-known-gaps). The June "SLP sign-off" is **withdrawn**: no credentialed speech-language pathologist has reviewed Voxa yet ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md), ruling R89).

Entries were appended by `./scripts/launch/soak-daily-check.sh --log docs/launch/SOAK_LOG.md` during June 2026. The daily smoke no longer writes here (since 2026-10-04).

| Date (UTC) | API ready | Boards 401 | Web health | Notes |
|------------|-----------|------------|------------|-------|
| 2026-06-08 | pass | 401 | 200 | Soak opened; daily check @ 2026-06-08T01:00:51Z |
| 2026-06-08 | pass | 401 | 200 | soak-scenarios + OBF auth round-trip @ 2026-06-08T02:33:21Z |
| 2026-06-08 | pass | 401 | 200 | W3: Janua duplicate cleanup + staging UX soak specs |
| 2026-06-08 | pass | 401 | 200 | M3: bootstrap authenticated soak (OIDC sync + OBF + AI consent) @ 2026-06-08T03:24:36Z |
| 2026-06-08 | pass | 401 | 200 | CI e2e-smoke green + VOXA_STAGING secrets; daily check @ 2026-06-08T04:19:38Z |
| 2026-06-08 | pass | 401 | 200 | Product checklist (recorded then as an "SLP sign-off"; withdrawn, R89) + auth soak @ 2026-06-08T04:48:37Z |
| 2026-06-08 | pass | 401 | 200 | Web OAuth green: PolicyException restored, `oidcClientSecretSet: true`, verify-staging-web-oidc @ 2026-06-08T05:22Z |
| 2026-06-08 | pass | 401 | 200 | Full bootstrap + e2e-smoke green (browser Janua OAuth) @ 2026-06-08T05:29Z |
| 2026-06-08 | pass | 401 | 200 | Prod GA gate + post-a11y e2e-smoke green (27119976839); soak day 1/7 @ 2026-06-08T06:27Z |
| 2026-06-12 | pass | 401 | 200 | **Soak window restarted** (2026-06-12→2026-06-19) after prod i18n 502 fix; day 1/7 @ 2026-06-12T23:17:22Z |
