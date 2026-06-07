# Voxa

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
│   └── api/          # Cloud sync & team collaboration API
├── packages/
│   ├── core/         # Domain models — boards, buttons, profiles
│   ├── ui/           # WCAG 2.2 accessible UI primitives
│   ├── obf/          # Open Board Format parser & exporter
│   ├── vocabulary/   # GLP, Fitzgerald Key, motor planning
│   ├── access/       # Switch scanning & eye-tracking adapters
│   ├── sync/         # Cloud sync REST + WebSocket client
│   └── ai/           # LLM, PictoBERT, symbol gen interfaces
└── docs/             # Architecture, accessibility, AI roadmap
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
```

Visit [http://localhost:3000](http://localhost:3000). Switch role to **Editor (SLP)** to import/export OBF, edit buttons, and save to the cloud API.

## Documentation

- [Product Requirements Document](./PRD.md) — full product specification
- [Architecture](./docs/architecture.md) — system design and platform targets
- [Accessibility Standards](./docs/accessibility.md) — WCAG 2.2 compliance details
- [Linguistic Framework](./docs/linguistic-framework.md) — GLP, motor planning, Fitzgerald Key
- [AI Roadmap](./docs/ai-roadmap.md) — LLM, PictoBERT, symbol generation, TTS

## License

Apache License 2.0 — see [LICENSE](./LICENSE).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Accessibility and clinical accuracy are first-class review criteria.
