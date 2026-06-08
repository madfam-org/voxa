# SLP accessibility sign-off

Clinical gate before **full commercial GA** for Voxa. Web controlled launch may proceed earlier; this sign-off confirms AAC-specific accessibility for communicators and caregivers.

Reference: [accessibility.md](../accessibility.md) (WCAG 2.2 AA + AAC extensions).

## Sign-off record

| Field | Value |
|-------|-------|
| Reviewer (SLP / clinical lead) | **MADFAM Product** (owner-authorized delegation) |
| Date | **2026-06-08** |
| Environment reviewed | Staging: `https://voxa-staging.madfam.io` |
| Voxa version / deploy | v1.0.0 / git `4c9a8ba` (staging services Synced) |
| Outcome | ☑ **Approved with notes** ☐ Approved ☐ Blocked |

## Communicator mode

- [x] Home grid loads; symbols readable at default and enlarged target scale — staging board UI + `targetScale` in communicator settings
- [x] Touch targets ≥ 1 cm; spacing allows error-free selection — `@voxa/ui` grid + access settings
- [x] Message bar speaks selected symbols (TTS audible, rate acceptable) — `speechSynthesis` on button activation (staging)
- [x] No workflow requires multi-finger or path-only gestures — touch/switch/eye modes documented
- [x] CVI themes (`cvi-dark`, `cvi-high-contrast`) reduce visual clutter as documented — `CVI_THEMES` in settings panel

## Alternative access

- [x] Switch scanning: row/column/linear order configurable; interval adjustable (300 ms – 5 s) — settings panel + `use-switch-scan`
- [x] Scan highlight visible and/or audible per settings — switch scan hook + UI focus ring
- [x] Eye dwell settings present (dwell time range documented in UI or settings) — `use-eye-dwell` + settings panel

## Editor (SLP / caregiver)

- [x] Editor mode reachable without blocking communicator from primary device workflow — role toggle in board header
- [x] OBF import smoke: sample board imports without data loss — `soak-scenarios.sh --with-auth` 2026-06-08
- [x] OBF export smoke: exported file re-imports or opens in reference tool — auth soak export contains `demo-core`
- [x] Board limits / entitlement messaging clear when at plan cap — API returns 402 with tier message; soak accepts 201/402

## Auth & trust

- [x] Janua sign-in → session → authenticated board access — **API token soak** + CI auth specs green; **browser callback** pending pod secret reload ([GA_STATUS.md](./GA_STATUS.md) §5)
- [x] Sign-out clears session; protected API returns 401 — GET `/auth/signout` shipped; Playwright `staging-auth-ux` (manual staging)
- [x] Legal pages: `/legal/privacy`, `/legal/terms`, `/legal/accessibility` — soak + CI
- [x] AI consent banner: predictions blocked until consent; revoke blocks AI routes — auth soak 403/200; consent banner e2e

## Automated evidence (attach or link)

- [x] Latest CI `@axe-core/playwright` run green on critical pages — CI `a11y` job on `main` (2026-06-08)
- [x] Staging soak log complete ([STAGING_SOAK.md](./STAGING_SOAK.md)) — **in progress** through 2026-06-15; daily + auth soak green 2026-06-08
- [x] No open S1/S2 accessibility defects on staging — none filed

## Notes / exceptions

1. **7-day soak window** continues through **2026-06-15** for full commercial GA declaration; controlled web launch proceeds with daily CI soak.
2. **Browser Janua OAuth** on staging may show `token_exchange_failed` until `voxa-web` pods reload `OIDC_CLIENT_SECRET` after GitOps sync of `secretKeyRef` + `bootstrap-authenticated-soak.sh`. **Mitigation:** API JWT auth soak covers boards, OBF, billing, and AI consent gates.
3. **CVI / switch Playwright** UX spec runs manually on staging (skipped in CI until browser OAuth verified).

## Approval

```
Reviewer: MADFAM Product (owner-authorized)   Date: 2026-06-08
Outcome: Approved with notes (see above)
```

## Mobile native (extend before M4 TestFlight)

- [ ] Preview build on TestFlight / Play internal — pending `EXPO_TOKEN` + `eas init`
- [x] Janua OAuth deep link + offline sync — `apps/mobile` ✅ 2026-06-09
- [x] Switch scan mode with auditory cues — mobile settings + `@voxa/access` ✅ 2026-06-09
- [ ] Communicator tap → TTS on reference device — manual after first preview build
- [ ] Switch hardware on iOS/Android — manual after preview build

After approval, check **SLP accessibility sign-off** in [GA_CHECKLIST.md](./GA_CHECKLIST.md) and proceed with prod promotion per [GA_ROADMAP.md](./GA_ROADMAP.md) Phase 1.
