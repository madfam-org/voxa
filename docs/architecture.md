# Architecture

## Overview

Voxa is a TypeScript monorepo targeting five client surfaces (Web, iOS, Android, Windows, Chromebook) backed by a cloud sync API. Shared domain logic lives in `packages/*`; each client consumes the same board model, vocabulary rules, and OBF interchange layer.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Surfaces                          │
│  Web (Next.js) │ iOS │ Android │ Windows │ Chromebook (future)  │
└────────────┬────────────────────────────────────────────────────┘
             │ shared packages
┌────────────▼────────────────────────────────────────────────────┐
│  @voxa/core  @voxa/ui  @voxa/obf  @voxa/vocabulary  @voxa/access │
│  @voxa/ai                                                       │
└────────────┬────────────────────────────────────────────────────┘
             │ REST + WebSocket
┌────────────▼────────────────────────────────────────────────────┐
│  @voxa/api — sync, team editing, usage analytics, AI proxy     │
└────────────┬────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────────┐
│  PostgreSQL (boards, profiles) │ Object storage (media, OBF)    │
│  Redis (real-time presence)    │ AI inference (external/proxy)  │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Offline-first boards** — AAC devices must work without connectivity; sync reconciles on reconnect.
2. **Immutable core grid slots** — Motor-planning positions are versioned, not silently moved.
3. **Open interchange** — OBF is the canonical import/export path; proprietary formats are adapters only.
4. **Accessibility by default** — UI components enforce WCAG 2.2 AA before feature work ships.
5. **Privacy-preserving AI** — User utterance data for personalization stays tenant-scoped with explicit consent.

## Package Responsibilities

| Package | Role |
|---------|------|
| `@voxa/core` | Board, button, profile, sync event types |
| `@voxa/ui` | Touch targets ≥ 1 cm, CVI themes, dwell/snap primitives |
| `@voxa/obf` | Parse/serialize `.obf` / `.obz` per Open Board Format spec |
| `@voxa/vocabulary` | Fitzgerald Key, GLP chunks, motor-planning validators |
| `@voxa/access` | Switch scan groups, eye-tracker dwell adapters |
| `@voxa/sync` | REST + WebSocket client for board sync and OBF endpoints |
| `@voxa/ai` | LLM prediction, PictoBERT, symbol gen, bilingual TTS contracts |

## Sync Model

- **Boards** are CRDT-friendly documents keyed by `boardId`.
- **Team roles:** communicator (read/use), editor (SLP/caregiver), admin (org).
- **Real-time editing** uses WebSocket patches; conflict resolution favors immutable slot locks on core grids.
- **Usage telemetry** (optional, consent-gated) records button activations for SLP reporting — never sold to third parties.

## Platform Roadmap

| Phase | Deliverable |
|-------|-------------|
| **0.1** (current) | Web prototype, core types, OBF skeleton, API scaffold |
| **0.3** (current) | Switch scanning, CVI themes, eye dwell, offline board cache |
| **0.4** | Mobile (Expo) + service worker sync |
| **0.5** | LLM prediction + PictoBERT integration |
| **1.0** | Clinical pilot, bilingual TTS, desktop shells |

## Technology Choices

- **Monorepo:** pnpm workspaces + Turborepo
- **Web:** Next.js 15, React 19
- **API:** Hono on Node 20 (edge-deployable later)
- **Database:** PostgreSQL + Drizzle ORM (planned)
- **Mobile (future):** Expo + React Native sharing `@voxa/ui` tokens
