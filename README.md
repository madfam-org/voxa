# Voxa

> **Repository boundary:** operational detail (platform identifiers, operator procedures, break-glass steps) and commercial research (pricing, competitor benchmarks, outreach) live in MADFAM's private operations repository; this public repo holds only public-safe context.

![License](https://img.shields.io/badge/License-Apache--2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-22.x-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

Voxa is an open **augmentative and alternative communication (AAC)** app: a
communication board that turns taps, switch presses and pointer dwell into
spoken language, at home, in therapy and in class. It is **Spanish first**
(es-MX), also in English and French. Built by [MADFAM](https://madfam.io) under
the [madfam-org](https://github.com/madfam-org) organization; try it at
[voxa.madfam.io/demo](https://voxa.madfam.io/demo) without an account.

## What it does today

Each line below is backed by a merged pull request and its tests; the full
table, with status and evidence per row, is
**[docs/capabilities.md](./docs/capabilities.md)**.

- **Boards.** Core boards in 24, 36 and 60 cells that keep one motor plan (a
  word never moves when the board grows), Core 47 and Core 100, a literacy
  keyboard and visual schedules; a first-run setup that builds the first board
  ([#41](https://github.com/madfam-org/voxa/pull/41)). Motor-plan locks that
  only an organization admin can override, enforced by the server
  ([#36](https://github.com/madfam-org/voxa/pull/36),
  [#37](https://github.com/madfam-org/voxa/pull/37)).
- **Symbols.** The full [Mulberry Symbols](https://mulberrysymbols.org) set
  (CC BY-SA 4.0) with an offline search in Spanish, English and French; only
  commercially licensed symbols ([#18](https://github.com/madfam-org/voxa/pull/18)).
- **Speech.** The device's own voices, chosen per language and tuned for rate,
  pitch and volume, through one speech path that always uses the board's
  language ([#38](https://github.com/madfam-org/voxa/pull/38)). Recorded speech
  and Gestalt (GLP) video per button ([#32](https://github.com/madfam-org/voxa/pull/32)).
- **Spanish.** Full Spanish interface and Spanish agreement as the message is
  built ("yo querer beber" → "yo quiero beber"), with a Base form toggle
  ([#29](https://github.com/madfam-org/voxa/pull/29)).
- **Access.** Touch (press or release), keyguard, switch scanning with one or
  two switches that never traps the user, pointer dwell for any device that
  moves the pointer, and button moves in the editor without dragging
  ([#36](https://github.com/madfam-org/voxa/pull/36)).
- **Offline.** The open board keeps working when the network drops, edits queue
  on the device, and `/app` reopens offline after one online visit
  ([#32](https://github.com/madfam-org/voxa/pull/32)).
- **Open Board Format 0.1** import and export (`.obf`, `.obz`); imports always
  create new boards ([#35](https://github.com/madfam-org/voxa/pull/35)).
- **Privacy.** Consent stored per person and purpose on the server; usage
  logging keeps counts only ([#24](https://github.com/madfam-org/voxa/pull/24),
  [#25](https://github.com/madfam-org/voxa/pull/25)).
- **Suggestions.** Basic word suggestions from a local predictor, with consent;
  no third-party AI calls ([#20](https://github.com/madfam-org/voxa/pull/20),
  [#28](https://github.com/madfam-org/voxa/pull/28)).
- **Accessibility checks.** axe (WCAG 2.2 AA rules) in CI on the public pages,
  `/app` in every theme and the Spanish pages ([#40](https://github.com/madfam-org/voxa/pull/40)).

## Not there yet

- **App store apps.** The Expo app builds in CI, but no store or test build
  exists yet ([MOBILE_GA.md](./docs/launch/MOBILE_GA.md)). Use the web app,
  which runs in current browsers on phones, tablets and computers.
- **Natural child voices**, licensed or cloud voices. Voxa speaks with the
  voices installed on the device.
- **Eye-tracker hardware or vendor SDKs.** Pointer dwell works with eye trackers
  whose own software moves the pointer; Voxa has not been tested on that
  hardware by us.
- **Clinical review.** The Spanish core vocabulary, board order, symbol keywords,
  suggestion table and agreement rules are **pending review by a credentialed
  speech-language pathologist**. Voxa claims no clinical review until one has
  happened.
- **Live updates between devices** while a board is open (changes from another
  device appear on reload), and model-based suggestions (built, switched off).

Engineering gaps and their priority: [AGENTS.md](./AGENTS.md#pending-work-and-known-gaps).

## Quick start for contributors

Requirements: **Node.js 22** (`engines.node >= 22`) and **pnpm 9** through
Corepack.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:api      # API on http://localhost:4000 (file store unless DATABASE_URL is set)
pnpm dev:web      # web app on http://localhost:3000
pnpm dev:mobile   # Expo app (simulator or device)
```

Without `DATABASE_URL` the API keeps boards in `boards.json` under
`VOXA_DATA_DIR` (default `./data`); set `DATABASE_URL` for PostgreSQL. The API
refuses to start in production without it. See [.env.example](./.env.example).

### Checks (what CI runs)

```bash
pnpm guards            # repository guards: test discovery, symbol licence, no direct LLM egress, public-repo hygiene
pnpm test:guards       # the guards' own tests
pnpm turbo typecheck   # every package, the mobile app and the e2e specs
pnpm test              # unit and route tests of every package (not e2e)
pnpm build
```

- **Tests are discovered, never listed.** Every `*.test.*` file under a
  package's `src/` runs as soon as it exists (`scripts/run-unit-tests.mjs`);
  the test-discovery guard fails if one does not. Details:
  [AGENTS.md › Tests](./AGENTS.md#tests).
- The PostgreSQL suites (`*.pg.test.ts`) run when `VOXA_TEST_DATABASE_URL`
  points at a throwaway database, and the cross-replica sync test also needs
  `VOXA_TEST_REDIS_URL`; without them they skip. CI provides both.
- **Browser specs** (Playwright, `e2e/`): `pnpm test:e2e:a11y`,
  `test:e2e:offline`, `test:e2e:access`, `test:e2e:voices`,
  `test:e2e:first-run`, `pnpm --filter @voxa/e2e test:import` run in the CI
  `a11y` job against the built web app (bound to `HOSTNAME=0.0.0.0`, as in
  production). `pnpm test:e2e:smoke` and `test:e2e:staging:signed-in` run in
  the daily smoke.

## Architecture

```
 Browser                                    Expo app (apps/mobile, not in stores yet)
 ├─ /, /demo, /legal/*  (public)                       │
 ├─ /app, /app/edit     (signed in)                    │
 └─ service worker: /app shell, static files,          │
    /symbols (never /api/*, never other origins)       │
            │                                          │
            ▼                                          │
 apps/web  Next.js 15, standalone                      │
 ├─ sign-in with Janua (OIDC)                          │
 ├─ /api/media/:id  same-origin media proxy            │
 ├─ robots.txt, sitemap.xml, llms.txt, llms-full.txt   │
 └─ /symbols/mulberry/**  vendored Mulberry SVGs       │
            │  REST + WebSocket, Janua bearer token    │
            ▼                                          ▼
 apps/api  Hono on Node 22 ── Janua JWKS: verifies tokens, voxa:* roles, voxa_tier claim
 │                         └─ Selva /v1 (optional, off): X-Sensitivity: restricted
 ├─ PostgreSQL: boards, sync events, activation counts, consents, media bytes
 └─ Redis (optional): co-editing fan-out and presence across replicas

 packages/  core · obf · import-adapters · vocabulary · symbols · sync · access · ai · i18n · ui
```

| Path | What it is |
| --- | --- |
| `apps/web` | Board app, editor, settings, landing and demo (Next.js 15) |
| `apps/api` | Boards, sync (REST + WebSocket), media, consents, usage counts, suggestions, plan limits (Hono, Drizzle on PostgreSQL) |
| `apps/mobile` | Expo SDK 57 communicator |
| `packages/core` | Board model, starter templates, core sizes and symbol allow-map |
| `packages/obf` | Open Board Format 0.1 reader and writer, safe unzip, JSON Schemas |
| `packages/import-adapters` | Beta one-page imports from three other AAC file formats |
| `packages/vocabulary` | Motor-plan validation, Fitzgerald Key, Spanish morphology |
| `packages/symbols` | Mulberry index and offline search |
| `packages/access` | Switch-scan state machine, hardware switches, dwell, keyguard |
| `packages/sync` | API client (REST, WebSocket, offline queue) |
| `packages/ai` | Local predictor |
| `packages/i18n`, `packages/ui` | es/en/fr catalogs; accessible board components and themes |
| `e2e/` | Playwright specs |
| `k8s/`, `enclii.yaml` | Digest-pinned production and staging manifests, Enclii declarations |

More: [docs/architecture.md](./docs/architecture.md) ·
[docs/data-model.md](./docs/data-model.md).

## Environments

| Environment | Landing | App | API |
|-------------|---------|-----|-----|
| Production | [voxa.madfam.io](https://voxa.madfam.io) | [voxa-app.madfam.io](https://voxa-app.madfam.io) | [voxa-api.madfam.io](https://voxa-api.madfam.io) |
| Staging | [voxa-staging.madfam.io](https://voxa-staging.madfam.io) | [voxa-app-staging.madfam.io](https://voxa-app-staging.madfam.io) | [voxa-api-staging.madfam.io](https://voxa-api-staging.madfam.io) |

A merge to `main` deploys production and staging side by side; staging never
gates production. How a change ships: [AGENTS.md › How a change ships](./AGENTS.md#how-a-change-ships).
Service status: [status.madfam.io](https://status.madfam.io).

## Documentation

- [Capabilities](./docs/capabilities.md): what ships today, with status and evidence
- [Accessibility](./docs/accessibility.md): standards, access methods, speech, testing
- [Linguistic framework](./docs/linguistic-framework.md): motor planning, GLP, Fitzgerald Key, Spanish morphology
- [Migration guide](./docs/launch/MIGRATION.md): Open Board Format and beta imports
- [Architecture](./docs/architecture.md) · [Data model](./docs/data-model.md) · [AI roadmap](./docs/ai-roadmap.md)
- [Janua authentication](./docs/auth/JANUA.md) · [Enclii deployment](./docs/deploy/ENCLII.md) · [On-call runbook](./docs/ops/RUNBOOK.md)
- [Legal summaries](./docs/legal/) (full pages at `/legal/*`) · [Symbol credits](./NOTICE)
- [AGENTS.md](./AGENTS.md): contributor and agent guide (invariants, guards, deploy) · [llms.txt](./llms.txt)
- [CHANGELOG](./CHANGELOG.md) · [Launch records (June 2026, historical)](./docs/launch/)

## Related repositories and contracts

- **Identity — [Janua](https://github.com/madfam-org/janua).** The API verifies
  Janua access tokens against its JWKS. Roles come only from namespaced
  application roles, per Janua's
  [claims contract](https://github.com/madfam-org/janua/blob/main/docs/architecture/CLAIMS_DE_ORGANIZACION_Y_SERVICE_PRINCIPALS.md);
  integration: [Janua ecosystem integration guide](https://github.com/madfam-org/janua/blob/main/docs/guides/ECOSYSTEM_INTEGRATION.md)
  and the ecosystem's [Janua integration guide](https://github.com/madfam-org/solarpunk-foundry/blob/main/docs/JANUA_INTEGRATION.md).
- **Plans.** The API reads the plan tier from the `voxa_tier` claim of the
  Janua token (`apps/api/src/lib/entitlement.ts`); billing writes it through
  Janua.
- **Model gateway — [Selva](https://github.com/madfam-org/selva-office).**
  Optional, off by default; `apps/api/src/lib/selva.ts`.
- **Deploy — [Enclii](https://github.com/madfam-org/enclii).**
  [Zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md).
- **Open Board Format.** [Specification](https://www.openboardformat.org/docs);
  what Voxa writes is in `packages/obf/schema/`.
- **Mulberry Symbols.** [Source](https://github.com/mulberrysymbols/mulberry-symbols),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); attribution in
  [NOTICE](./NOTICE).

## License

The code is Apache License 2.0 ([LICENSE](./LICENSE)). The vendored Mulberry
Symbols and the symbol keyword index are CC BY-SA 4.0 ([NOTICE](./NOTICE)).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Accessibility and clinical accuracy
are first-class review criteria. Security reports: [SECURITY.md](./SECURITY.md).
