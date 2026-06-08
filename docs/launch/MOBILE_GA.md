# Mobile commercial GA path

Expo / EAS track for Voxa native communicator apps. **Web GA does not block on mobile**; this doc covers Phase 4 in [GA_ROADMAP.md](./GA_ROADMAP.md).

## Current state

| Item | Status |
|------|--------|
| Expo app (`apps/mobile`) | Board UI, Janua OAuth, offline sync hook |
| Runtime config | `app.config.js` maps `EXPO_PUBLIC_*` → `expo.extra` ✅ 2026-06-09 |
| App icons | `assets/icon.png` + `adaptive-icon.png` ✅ 2026-06-09 |
| EAS profiles | `eas.json` — development, preview (staging API), production |
| Store listings | Not started |
| CI build workflow | `.github/workflows/mobile-eas.yml` — typecheck + preview (requires `EXPO_TOKEN`) |
| EAS config guard | `scripts/mobile/verify-eas-config.sh` in CI + mobile-eas ✅ 2026-06-09 |

## Prerequisites

- [Expo account](https://expo.dev) linked to MADFAM org
- Apple Developer + App Store Connect app record
- Google Play Console app + service account JSON (never commit — use `apps/mobile/secrets/`, gitignored)
- Janua mobile redirect URI `voxa://auth/callback` on the Voxa OAuth client ([register-janua-oauth-client.sh](../../scripts/deploy/register-janua-oauth-client.sh))

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
cd apps/mobile
npx eas-cli login
npx eas init   # links projectId — replaces REPLACE_WITH_EAS_PROJECT_ID in app.json
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

Replace placeholder values in `eas.json` submit block (`appleId`, `ascAppId`, `appleTeamId`) before store submit.

## GA checklist (mobile)

- [ ] EAS project linked (`eas init` → real `extra.eas.projectId`)
- [ ] Preview builds on TestFlight + Play internal testing
- [ ] Janua OAuth deep link — `voxa://auth/callback` + refresh token rotation ✅ 2026-06-09
- [ ] Offline board cache + sync conflict handling verified — AsyncStorage + NetInfo retry ✅ 2026-06-09
- [ ] Switch scanning on reference hardware (iOS/Android)
- [ ] Store screenshots, descriptions, privacy nutrition labels
- [ ] SLP sign-off on mobile communicator flows ([SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — extend for native)
- [ ] `production` submit via `eas submit`

## CI (preview builds)

`.github/workflows/mobile-eas.yml` runs on `workflow_dispatch` and on pushes to `main` that touch `apps/mobile` or shared packages.

1. `pnpm --filter @voxa/mobile typecheck`
2. Skip gracefully when `EXPO_TOKEN` is unset
3. `eas build --profile preview --platform all --non-interactive`

Required GitHub secret: `EXPO_TOKEN`

Until `EXPO_TOKEN` is configured, trigger preview builds manually:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile preview --platform all
```

## CI (store submit — planned)

Manual `workflow_dispatch` job (add when App Store Connect + Play credentials are ready):

```yaml
# .github/workflows/mobile-eas-submit.yml (future)
jobs:
  submit:
    steps:
      - uses: expo/expo-github-action@v8
        with:
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas submit --profile production --platform all --non-interactive
        working-directory: apps/mobile
```

Secrets: `EXPO_TOKEN`, optional `GOOGLE_SERVICE_ACCOUNT_KEY` (or file at `apps/mobile/secrets/google-play-service-account.json`), App Store Connect API key env vars for non-interactive iOS submit.

## Related

- [GA_ROADMAP.md](./GA_ROADMAP.md) — milestone M4 / M5
- [GA_CHECKLIST.md](./GA_CHECKLIST.md) — mobile EAS checkbox
- [../accessibility.md](../accessibility.md) — touch targets and switch scanning
