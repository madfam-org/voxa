# Voxa feature parity tracker

Actionable **feature parity match** against the AAC platform benchmark. Each row maps to delivery phases in [GA_ROADMAP.md](./GA_ROADMAP.md). Research basis: [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md).

**Legend:** ✅ done · 🟡 partial/MVP · 🔴 not started · ➖ out of scope

**Last updated:** 2026-06-08

---

## Parity tiers

| Tier | Definition | GA relationship |
|------|------------|-----------------|
| **P0 — Launch blockers** | Required for full **web** commercial GA sign-off | Before M3 |
| **P1 — Robust AAC baseline** | Expected by SLPs comparing to Proloquo2Go / TD Snap Core | M3 → M5 |
| **P2 — Competitive parity** | Match top-tier apps on access + vocab + symbols | Post web GA |
| **P3 — Differentiation** | Voxa-only advantages (GLP-native, LLM, open stack) | Ongoing |

---

## P0 — Web GA blockers

| Feature | Benchmark reference | Voxa status | Notes / issue |
|---------|---------------------|-------------|---------------|
| Production web communicator | All Tier A | ✅ | `voxa.madfam.io` |
| Auth + tenant isolation | Enterprise AAC | ✅ | Janua + `authEnforced` |
| 1 cm touch targets | WCAG 2.2 / OpenAAC 🟢 | ✅ | `@voxa/ui` AacButton |
| ARIA grid structure | WCAG / access | ✅ | BoardGrid row/cell (2026-06-08) |
| CVI themes | OpenAAC ⭐ / TD Snap HC | ✅ | cvi-dark, cvi-high-contrast |
| Switch scanning (configurable) | OpenAAC ⭐ | 🟡 | Web; row/col/linear; no BT switch |
| Eye dwell (configurable) | OpenAAC ⭐ | 🟡 | Pointer sim; not Tobii SDK |
| Message bar + speak utterance | OpenAAC 🟢 | ✅ | Web Speech API |
| OBF export | OpenAAC / Cboard | ✅ | API + editor UI |
| OBF import | OpenAAC / Cboard | ✅ | API + UI; auth soak validated 2026-06-08 |
| SLP editor mode | OpenAAC 🟢 | 🟡 | Basic EditorPanel; not full vocab tools |
| Cloud board persistence | OpenAAC 💡 | ✅ | PostgreSQL + sync client |
| Offline cache + retry | OpenAAC 💡 | 🟡 | IndexedDB pending save |
| Legal / privacy / a11y pages | Commercial GA | ✅ | `/legal/*` |
| Automated a11y CI | WCAG regression | ✅ | axe Playwright |
| Staging soak + SLP sign-off | Clinical gate | 🟡 | Automated soak in CI; SLP pending |

---

## P1 — Robust AAC baseline (post-soak → M5)

| Feature | Leaders | Voxa status | Target phase |
|---------|---------|-------------|--------------|
| Multi-board library (not single demo) | All Tier A | 🟡 | Board picker + create (2026-06-08) |
| Motor-planning slot locks enforced in UI | LAMP, SFY | 🟡 | Model yes; editor UX P1 |
| Fitzgerald POS on all buttons | Proloquo, Grid | 🟡 | Demo + editor; not full library |
| Hide/show buttons (open/close) | SFY, Proloquo | 🟡 | Per-button `hidden` flag in editor |
| Custom grid size (9–144+ cells) | Proloquo2Go | 🟡 | Configurable rows/cols in editor |
| Symbol-only / label-only modes | OpenAAC ✅ | 🟡 | `hideLabels` + `hideSymbols` settings |
| Upload custom symbol / photo | OpenAAC 🟢 | 🟡 | Editor partial |
| Recorded speech on button | OpenAAC ✅ / GLP | 🔴 | Type in `@voxa/core`; UI P1 |
| GLP buttons with audio/video | Voxa differentiator | 🟡 | Type + demo; media upload P1 |
| Symbol library search (ARASAAC) | OpenAAC ⭐ | 🔴 | P1 — integrate OpenSymbols |
| Word forms / inflection | OpenAAC / Proloquo grammar | 🔴 | P1 |
| Whisper / build utterance without speak | SFY | 🟡 | Message bar; no whisper mode |
| Usage history / activation log | TD Snap, Grid | 🔴 | Schema exists; UI + consent P1 |
| Real-time team co-edit | TD Snap, Grid | 🔴 | WebSocket + REDIS_URL phase |
| Remote SLP edit without device handoff | Cloud AAC | 🟡 | Roles in API; UX P1 |
| iOS + Android store apps | All Tier A | 🔴 | [MOBILE_GA.md](./MOBILE_GA.md) M4 |
| Hardware switch (Bluetooth/USB) | Grid, TD Snap | 🔴 | P1 mobile + web |
| Keyguard / touch guard support | Clinical | 🔴 | P2 |

---

## P2 — Competitive parity (Tier A match)

| Feature | Leaders | Voxa status | Target |
|---------|---------|-------------|--------|
| Eye gaze (Tobii/IrisBond SDK) | TD Snap, Grid | 🔴 | P2 |
| Auditory scanning prompts | TD Snap Scanning | 🔴 | P2 |
| Group / region scanning | Grid | 🔴 | P2 |
| Core word page sets (Crescendo-class) | Proloquo2Go | 🔴 | P2 content |
| PODD / Gateway page set option | TD Snap IAP | 🔴 | P2 or partner content |
| `.gridset` import | Grid 3 | 🔴 | P2 via AACProcessors |
| TouchChat / Snap import | PRC, Tobii | 🔴 | P2 via AACProcessors |
| Visual schedules / timers | TD Snap tools | 🔴 | P2 |
| Diversity / skin tone on symbols | Proloquo, TD Snap | 🔴 | P2 |
| High-quality neural TTS voices | Proloquo, Acapela | 🟡 | Browser TTS today |
| Bilingual mid-sentence TTS | Proloquo | 🔴 | [ai-roadmap.md](../ai-roadmap.md) P2 |
| Literacy / keyboard page set | TD Snap Text | 🔴 | P2 |
| Apple Watch / secondary display | Proloquo2Go | ➖ | Low priority |
| Google Assistant integration | TD Snap | ➖ | Optional / post-GA |

---

## P3 — Differentiation (Voxa wins)

| Feature | Incumbent gap | Voxa status | Target |
|---------|---------------|-------------|--------|
| LLM contextual phrase prediction | Weak in Tier A | 🟡 | MVP live; tune P1 |
| PictoBERT symbol prediction strip | None in Tier A | 🟡 | Stub + API; model P1 |
| AI symbol generation (guardrailed) | None in Tier A | 🔴 | [ai-roadmap.md](../ai-roadmap.md) |
| Native GLP phrase + intonation media | Add-on elsewhere | 🟡 | Core model; UX P1 |
| Open Board Format as primary interchange | Proprietary elsewhere | ✅ | Marketing + migration tools |
| Apache 2.0 auditable codebase | Closed source Tier A | ✅ | Community / school IT |
| WCAG 2.2 web-native + axe CI | Rare in AAC | ✅ | Extend coverage P1 |
| Janua SSO + madfam.io trust stack | N/A | ✅ | Enterprise story |
| Consent-gated AI telemetry | Privacy leadership | ✅ | Expand analytics P1 |
| Cross-platform single account | Fragmented | 🟡 | Full at M5 |

---

## Parity scorecard (approximate)

Scores are **weighted capability coverage** vs Tier A median (Proloquo2Go, TD Snap Core First, LAMP, SFY, Grid) — not quality of implementation.

| Category | Weight | Voxa Now | Voxa M3 (web GA) | Voxa M5 (platform GA) |
|----------|--------|----------|------------------|------------------------|
| Platform & distribution | 15% | 35% | 45% | 75% |
| Access methods | 15% | 40% | 55% | 80% |
| Vocabulary & linguistics | 15% | 30% | 50% | 70% |
| Symbols & media | 10% | 20% | 45% | 65% |
| Editing & customization | 10% | 35% | 55% | 75% |
| Speech output | 10% | 45% | 60% | 85% |
| Prediction & AI | 10% | 35% | 50% | 90% |
| Cloud & teams | 10% | 55% | 65% | 85% |
| Interoperability | 5% | 60% | 70% | 85% |
| **Weighted total** | 100% | **~38%** | **~52%** | **~78%** |

**Interpretation:** Full **web commercial GA (M3)** does not require 100% Tier A parity — it requires **P0 complete + clinical sign-off**. **M5** targets **~75%+ weighted parity** with clear differentiation on AI + openness.

---

## OpenAAC alignment (priority backlog)

Mapped from [OpenAAC considerations](https://www.openaac.org/considerations). 🟢 = table stakes for robust AAC.

| OpenAAC feature | Priority | Voxa status |
|-----------------|----------|-------------|
| 🟢 Grid layout | — | ✅ |
| 🟢 Links to other boards | — | 🔴 |
| 🟢 Custom speech text vs label | — | 🟡 `speechText` field |
| ✅ Hide/show buttons | P1 | 🔴 |
| ✅ Custom grid size | P1 | 🟡 |
| ✅ Upload sounds | P1 | 🔴 |
| ⭐ Row/column scanning | P1 | 🟡 |
| ⭐ Hold to select / dwell duration | P1 | 🟡 |
| ⭐ Symbol library search | P1 | 🔴 |
| ⭐ Fitzgerald color by POS | P1 | ✅ |
| 💡 Babble (show all hidden) | P2 | 🔴 |
| 💡 Lock editing behind PIN | P1 | 🔴 |
| 💡 Cloud backup | P0 | ✅ |
| 💡 Share vocabulary sets | P2 | 🔴 |

---

## Migration paths (for parity marketing)

| From | Path to Voxa | Effort |
|------|--------------|--------|
| CoughDrop / OBF | Direct `.obf` / `.obz` import | Low |
| Cboard | OBF export → Voxa import | Low |
| Grid 3 | `.gridset` → AACProcessors → OBF → Voxa | Medium |
| TouchChat | `.touchChat` → AACProcessors → OBF | Medium |
| Snap Core First | `.spb` → AACProcessors → OBF | Medium |
| Proloquo2Go | No native export; manual rebuild + ARASAAC | High |
| LAMP / SFY | Proprietary; motor plan mapping project | High |

---

## Review cadence

| When | Action |
|------|--------|
| Each major release | Update status column; recalculate scorecard |
| Quarterly | Refresh [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md) pricing/features |
| Before M3 sign-off | SLP review of P0 rows |
| Before M5 | P1 ≥ 80% ✅/🟡 combined |

---

## Related

- [AAC_PLATFORM_BENCHMARK.md](./AAC_PLATFORM_BENCHMARK.md) — full competitive research
- [GA_ROADMAP.md](./GA_ROADMAP.md) — Phase 6 parity delivery
- [SLP_SIGNOFF.md](./SLP_SIGNOFF.md) — clinical gate
- [ai-roadmap.md](../ai-roadmap.md) — AI parity detail
