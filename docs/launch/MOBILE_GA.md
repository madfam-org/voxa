# Mobile commercial GA path

Expo / EAS track for Voxa native communicator apps. **Web GA does not block on mobile**; this doc covers Phase 4 in [GA_ROADMAP.md](./GA_ROADMAP.md).

## Current state

| Item | Status |
|------|--------|
| Expo app (`apps/mobile`) | Expo SDK 57 (React Native 0.86, React 19.2). Board UI, Janua OAuth, offline sync hook |
| Runtime config | `app.config.js` maps `EXPO_PUBLIC_*` → `expo.extra` ✅ 2026-06-09 |
| App icons | `assets/icon.png` + `adaptive-icon.png` ✅ 2026-06-09 |
| EAS profiles | `eas.json` — development, preview (staging API), production |
| EAS project | Not created (owner step) |
| Store listings | Not started |
| CI | `ci.yml` typechecks the app and bundles it (`expo export --platform android`) on every PR, without credentials |
| Preview build workflow | `.github/workflows/mobile-eas.yml` (manual dispatch) — checks, then an EAS preview build when `EXPO_TOKEN` is set |
| EAS config guard | `scripts/mobile/verify-eas-config.sh` in CI + mobile-eas: no committed ids, and `app.config.js` refuses to build without `EAS_PROJECT_ID` |
| TestFlight bootstrap | `scripts/mobile/bootstrap-eas.sh` + `verify-testflight-readiness.sh` ✅ 2026-06-09 |
| Submit workflow | `.github/workflows/mobile-eas-submit.yml` (manual dispatch) ✅ 2026-06-09 |

## Prerequisites

- [Expo account](https://expo.dev) linked to MADFAM org
- Apple Developer + App Store Connect app record
- Google Play Console app + service account JSON (never commit — use `apps/mobile/secrets/`, gitignored)
- Janua mobile redirect URI `voxa://auth/callback` on the Voxa OAuth client (registered by a platform operator)

## Runtime environment

`apps/mobile/app.config.js` reads public build-time vars (set in `eas.json` per profile):

| Variable | Preview | Production | Local dev default |
|----------|---------|------------|-------------------|
| `EXPO_PUBLIC_API_URL` | `https://voxa-api-staging.madfam.io` | `https://voxa-api.madfam.io` | `http://localhost:4000` |
| `EXPO_PUBLIC_OIDC_ISSUER` | `https://auth.madfam.io` | same | same |
| `EXPO_PUBLIC_OIDC_CLIENT_ID` | `voxa` | `voxa` | `voxa` |

## Build profiles

| Profile | API | Distribution |
|---------|-----|--------------|
| `development` | Local / dev | Internal dev client |
| `preview` | `voxa-api-staging.madfam.io` | TestFlight / Play internal |
| `production` | `voxa-api.madfam.io` | App Store / Play production |

```bash
./scripts/mobile/bootstrap-eas.sh          # operator checklist
cd apps/mobile
npx eas-cli login
npx eas-cli init                           # creates the EAS project; do not commit the id it prints
export EAS_PROJECT_ID=<id>
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

## Identifiers and credentials (never committed)

This is a public repository, so no EAS, Apple or Google identifier is
committed. `apps/mobile/app.config.js` reads the EAS project from the
environment, and `eas.json` reads the store keys through `"$VAR"` values that
EAS CLI expands at submit time. The App Store Connect app id and Apple team id
have no such expansion, so `scripts/mobile/eas-submit-env.mjs --apply` writes
them into the submit profile of the CI checkout only.

| Name | Kind (GitHub) | Used by | Purpose |
|------|---------------|---------|---------|
| `EXPO_TOKEN` | secret | both mobile workflows | EAS CLI access token |
| `EAS_PROJECT_ID` | variable | `app.config.js` | EAS project UUID. Required when `VOXA_REQUIRE_EAS_PROJECT=1` (the workflows) and on EAS Build workers, where EAS also sets `EAS_BUILD_PROJECT_ID` |
| `EAS_PROJECT_OWNER` | variable (optional) | `app.config.js` | Expo account that owns the project |
| `ASC_APP_ID` | variable | `eas-submit-env.mjs` | Numeric App Store Connect app id |
| `APPLE_TEAM_ID` | variable (optional) | `eas-submit-env.mjs` | Apple Developer team id |
| `ASC_API_KEY_ID` | secret | `eas.json` (`$ASC_API_KEY_ID`) | App Store Connect API key id |
| `ASC_API_KEY_ISSUER_ID` | secret | `eas.json` (`$ASC_API_KEY_ISSUER_ID`) | App Store Connect API key issuer |
| `ASC_API_KEY_P8` | secret | `write-store-keys.sh` → `$ASC_API_KEY_PATH` | App Store Connect API key (.p8 contents) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | secret | `write-store-keys.sh` → `$GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH` | Google Play service account key (JSON contents) |
| `EAS_AUTO_SUBMIT` | variable (optional) | `mobile-eas.yml` | `true` submits each preview build |

A missing value stops the workflow with a message that names it (never its
value). Locally, `expo start` and `expo export` need none of these.

## GA checklist (mobile)

- [ ] EAS project created and `EAS_PROJECT_ID` set (repository variable)
- [ ] Preview builds on TestFlight + Play internal testing
- [ ] Janua OAuth deep link — `voxa://auth/callback` + refresh token rotation ✅ 2026-06-09
- [ ] Offline board cache + sync conflict handling verified — AsyncStorage + NetInfo retry ✅ 2026-06-09
- [ ] Switch scanning on reference hardware (iOS/Android) — on-screen scan + **Tune** + BT keyboard capture ✅ 2026-06-09; dedicated BT adapter P2
- [ ] Store screenshots, descriptions, privacy nutrition labels
- [ ] SLP sign-off on mobile communicator flows ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — extend for native)
- [ ] `production` submit via `eas submit`

## CI (preview builds)

`.github/workflows/mobile-eas.yml` runs on `workflow_dispatch` only.

1. `verify-eas-config.sh`, readiness summary, `pnpm turbo typecheck --filter=@voxa/mobile`, mobile tests
2. Bundle check: `expo export --platform android` (no credentials)
3. Skip the build gracefully when `EXPO_TOKEN` is unset
4. `eas build --profile preview --platform all --non-interactive` (fails if `EAS_PROJECT_ID` is unset); with `EAS_AUTO_SUBMIT=true` it also checks and applies the store settings and adds `--auto-submit`

## CI (store submit)

Manual `workflow_dispatch` via `.github/workflows/mobile-eas-submit.yml`: writes the store keys from secrets, checks every name in the table above for the chosen platform, then runs `eas submit --latest`.

## Related

- [GA_ROADMAP.md](./GA_ROADMAP.md) — milestone M4 / M5
- [GA_CHECKLIST.md](./GA_CHECKLIST.md) — mobile EAS checkbox
- [../accessibility.md](../accessibility.md) — touch targets and switch scanning
