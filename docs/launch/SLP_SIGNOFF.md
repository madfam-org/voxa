# SLP accessibility sign-off

Clinical gate before **full commercial GA** for Voxa. Web controlled launch may proceed earlier; this sign-off confirms AAC-specific accessibility for communicators and caregivers.

Reference: [accessibility.md](../accessibility.md) (WCAG 2.2 AA + AAC extensions).

## Sign-off record

| Field | Value |
|-------|-------|
| Reviewer (SLP / clinical lead) | _Name_ |
| Date | _YYYY-MM-DD_ |
| Environment reviewed | Staging: `https://voxa-staging.madfam.io` |
| Voxa version / deploy | _e.g. v1.0.0 / git SHA_ |
| Outcome | ☐ Approved ☐ Approved with notes ☐ Blocked |

## Communicator mode

- [ ] Home grid loads; symbols readable at default and enlarged target scale
- [ ] Touch targets ≥ 1 cm; spacing allows error-free selection
- [ ] Message bar speaks selected symbols (TTS audible, rate acceptable)
- [ ] No workflow requires multi-finger or path-only gestures
- [ ] CVI themes (`cvi-dark`, `cvi-high-contrast`) reduce visual clutter as documented

## Alternative access

- [ ] Switch scanning: row/column/linear order configurable; interval adjustable (300 ms – 5 s)
- [ ] Scan highlight visible and/or audible per settings
- [ ] Eye dwell settings present (dwell time range documented in UI or settings)

## Editor (SLP / caregiver)

- [ ] Editor mode reachable without blocking communicator from primary device workflow
- [ ] OBF import smoke: sample board imports without data loss
- [ ] OBF export smoke: exported file re-imports or opens in reference tool
- [ ] Board limits / entitlement messaging clear when at plan cap

## Auth & trust

- [ ] Janua sign-in → session → authenticated board access
- [ ] Sign-out clears session; protected API returns 401
- [ ] Legal pages: `/legal/privacy`, `/legal/terms`, `/legal/accessibility`
- [ ] AI consent banner: predictions blocked until consent; revoke blocks AI routes

## Automated evidence (attach or link)

- [ ] Latest CI `@axe-core/playwright` run green on critical pages
- [ ] Staging soak log complete ([STAGING_SOAK.md](./STAGING_SOAK.md))
- [ ] No open S1/S2 accessibility defects on staging

## Notes / exceptions

_Document any approved exceptions (e.g. known third-party component limitation) with mitigation and follow-up issue._

## Approval

```
Reviewer: _________________________  Date: __________
Signature (optional): _________________________
```

After approval, check **SLP accessibility sign-off** in [GA_CHECKLIST.md](./GA_CHECKLIST.md) and proceed with prod promotion per [GA_ROADMAP.md](./GA_ROADMAP.md) Phase 1.
