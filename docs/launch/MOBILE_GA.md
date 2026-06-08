# Mobile commercial GA path

Expo / EAS track for Voxa native communicator apps. **Web GA does not block on mobile**; this doc covers Phase 4 in [GA_ROADMAP.md](./GA_ROADMAP.md).

## Current state

| Item | Status |
|------|--------|
| Expo app (`apps/mobile`) | Scaffold — board UI, local storage, sync hook |
| EAS profiles | `eas.json` — development, preview (staging API), production |
| Store listings | Not started |
| CI build workflow | `.github/workflows/mobile-eas.yml` — preview on push / manual (requires `EXPO_TOKEN`) |

## Prerequisites

- [Expo account](https://expo.dev) linked to MADFAM org
- Apple Developer + App Store Connect app record
- Google Play Console app + service account JSON (never commit)
- Janua mobile redirect URIs registered for `voxa` audience

## Build profiles

| Profile | API | Distribution |
|---------|-----|--------------|
| `development` | Local / dev | Internal dev client |
| `preview` | `voxa-api-staging.madfam.io` | TestFlight / Play internal |
| `production` | `voxa-api.madfam.io` | App Store / Play production |

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

Replace placeholder values in `eas.json` (`appleId`, `ascAppId`, `appleTeamId`) before submit.

## GA checklist (mobile)

- [ ] EAS project linked (`eas init` if not already)
- [ ] Preview builds on TestFlight + Play internal testing
- [ ] Janua OAuth deep link / universal links on iOS and Android
- [ ] Offline board cache + sync conflict handling verified
- [ ] Switch scanning on reference hardware (iOS/Android)
- [ ] Store screenshots, descriptions, privacy nutrition labels
- [ ] SLP sign-off on mobile communicator flows ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — extend for native)
- [ ] `production` submit via `eas submit`

## CI (preview builds)

`.github/workflows/mobile-eas.yml` runs on `workflow_dispatch` and on pushes to `main` that touch `apps/mobile` or shared packages. Requires GitHub secret:

- `EXPO_TOKEN`

Optional submit secrets (production): `GOOGLE_SERVICE_ACCOUNT_KEY`, App Store Connect API key.

Until `EXPO_TOKEN` is configured, trigger preview builds manually:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile preview --platform all
```

## CI (planned — store submit)

## Related

- [GA_ROADMAP.md](./GA_ROADMAP.md) — milestone M4 / M5
- [GA_CHECKLIST.md](./GA_CHECKLIST.md) — mobile EAS checkbox
- [../accessibility.md](../accessibility.md) — touch targets and switch scanning
