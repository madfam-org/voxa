# Voxa

> **Repository boundary:** operational detail (platform identifiers, operator procedures, break-glass steps) and commercial research (pricing, competitor benchmarks, outreach) live in MADFAM's private operations repository; this public repo holds only public-safe context.

![License](https://img.shields.io/badge/License-Apache--2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

> **Next-generation Augmentative and Alternative Communication (AAC)** — a cross-platform ecosystem that eliminates clinical and technological friction for non-speaking and minimally speaking individuals.

Built by [MADFAM](https://madfam.io) under the [madfam-org](https://github.com/madfam-org) organization.

## Vision

Current market-leading AAC apps are siloed on iOS, have steep learning curves, lack native Gestalt Language Processing (GLP) support, and rely on outdated predictive text. Voxa closes the Android gap, supports open board portability, and combines rigorously researched linguistic frameworks with modern AI — without locking users into a walled garden.

## Key Capabilities

| Area | What Voxa delivers |
|------|-------------------|
| **Platform** | Web, iOS, Android, Windows, Chromebook — one cloud-synced ecosystem |
| **Interoperability** | Native Open Board Format (`.obf` / `.obz`) import and export |
| **Accessibility** | WCAG 2.2 Level AA — 1 cm minimum touch targets, switch scanning, eye tracking |
| **Linguistics** | Motor-planning grids, GLP phrase chunks, Modified Fitzgerald Key color coding |
| **AI** | LLM predictive text, PictoBERT symbol prediction, guarded symbol generation, bilingual neural TTS |

## Monorepo Structure

```
voxa/
├── apps/
│   ├── web/          # Primary AAC board interface (Next.js)
│   ├── mobile/       # Expo communicator app (iOS / Android)
│   └── api/          # Cloud sync & team collaboration API
├── packages/
│   ├── core/         # Domain models — boards, buttons, profiles
│   ├── ui/           # WCAG 2.2 accessible UI primitives
│   ├── obf/          # Open Board Format parser & exporter
│   ├── import-adapters/ # Imports from other AAC formats (Gridset, Snap, TouchChat)
│   ├── vocabulary/   # GLP, Fitzgerald Key, motor planning
│   ├── symbols/      # Symbol sources and search
│   ├── access/       # Switch scanning & eye-tracking adapters
│   ├── sync/         # Cloud sync REST + WebSocket client
│   ├── i18n/         # Shared translations
│   └── ai/           # LLM, PictoBERT, symbol gen interfaces
├── e2e/              # Playwright smoke, accessibility and staging specs
├── k8s/              # Enclii production & staging manifests (Kustomize)
├── enclii.yaml       # Enclii domain, network, and status declarations
└── docs/             # Architecture, accessibility, deployment
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+ (via Corepack)

```bash
corepack enable
pnpm install
pnpm dev:api      # sync API on http://localhost:4000
pnpm dev:web      # board UI on http://localhost:3000
pnpm dev:mobile   # Expo app (iOS / Android / simulator)
```

Without `DATABASE_URL` the API keeps boards in `apps/api/data/boards.json` (override with `VOXA_DATA_DIR`); set `DATABASE_URL` for PostgreSQL. See [.env.example](./.env.example).

On web, tap **I** → **want** to see AI prediction chips. Switch to **Editor (SLP)** for OBF editing, or **Settings** for CVI themes and switch scanning.

### Tests

```bash
pnpm turbo typecheck --filter='!@voxa/mobile'
pnpm test              # unit and route tests for every package (not e2e)
pnpm test:e2e:smoke    # Playwright, needs a running web app
```

Each package lists its test files explicitly in its `test` script. The API suite gives every test process its own data directory, and its PostgreSQL test runs only when `VOXA_TEST_DATABASE_URL` points at a throwaway database (CI provides one). Details: [AGENTS.md](./AGENTS.md#tests).

### Status & monitoring

- **Service status:** [status.madfam.io](https://status.madfam.io) (Voxa entries under AAC Platform)
- **GA progress:** [docs/launch/GA_ROADMAP.md](./docs/launch/GA_ROADMAP.md) · [REMEDIATION_PLAN.md](./docs/launch/REMEDIATION_PLAN.md) · [GA_CHECKLIST.md](./docs/launch/GA_CHECKLIST.md)

### Deployed environments (Enclii / madfam.io)

| Environment | Platform | App | API |
|-------------|----------|-----|-----|
| Production | [voxa.madfam.io](https://voxa.madfam.io) | [voxa-app.madfam.io](https://voxa-app.madfam.io) | [voxa-api.madfam.io](https://voxa-api.madfam.io) |
| Staging | [voxa-staging.madfam.io](https://voxa-staging.madfam.io) | [voxa-app-staging.madfam.io](https://voxa-app-staging.madfam.io) | [voxa-api-staging.madfam.io](https://voxa-api-staging.madfam.io) |

See [docs/deploy/ENCLII.md](./docs/deploy/ENCLII.md) for CI, onboarding and the deploy model.

## Documentation

- [AGENTS.md](./AGENTS.md) — contributor and agent guide: layout, tests, invariants, deploy workflows
- [llms.txt](./llms.txt) — compact index for LLM tools
- [Product Requirements Document](./PRD.md) — full product specification
- [Architecture](./docs/architecture.md) — system design and platform targets
- [Data model](./docs/data-model.md) — PostgreSQL schema and migrations
- [Janua authentication](./docs/auth/JANUA.md) — SSO for web and API
- [Remediation plan](./docs/launch/REMEDIATION_PLAN.md) — W1–W4 execution tracker for full web GA
- [Migration guide](./docs/launch/MIGRATION.md) — OBF import from other AAC platforms
- [GA checklist](./docs/launch/GA_CHECKLIST.md) — commercial launch criteria
- [Staging soak](./docs/launch/STAGING_SOAK.md) — pre-GA validation checklist
- [SLP sign-off](./docs/launch/SLP_SIGNOFF.md) — clinical accessibility gate
- [Mobile GA](./docs/launch/MOBILE_GA.md) — Expo / EAS store path
- [Enclii Deployment](./docs/deploy/ENCLII.md) — staging/production on madfam.io via Enclii
- [Accessibility Standards](./docs/accessibility.md) — WCAG 2.2 compliance details
- [Legal summaries](./docs/legal/) — privacy, terms, data handling (live pages at `/legal/*`)
- [Linguistic Framework](./docs/linguistic-framework.md) — GLP, motor planning, Fitzgerald Key
- [AI Roadmap](./docs/ai-roadmap.md) — LLM, PictoBERT, symbol generation, TTS

## Related repositories

- [Janua](https://github.com/madfam-org/janua) — identity. The API verifies Janua access tokens against its JWKS; contract: [ecosystem integration guide](https://github.com/madfam-org/janua/blob/main/docs/guides/ECOSYSTEM_INTEGRATION.md).
- [Enclii](https://github.com/madfam-org/enclii) — deployment platform; contract: [zero-touch contract](https://github.com/madfam-org/enclii/blob/main/docs/guides/ZERO_TOUCH_CONTRACT.md).
- Plan entitlements — the API reads the `voxa_tier` claim of the Janua access token (`apps/api/src/lib/entitlement.ts`); billing writes it through Janua. See [AGENTS.md](./AGENTS.md#related-repositories-and-contracts).

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Accessibility and clinical accuracy are first-class review criteria.
