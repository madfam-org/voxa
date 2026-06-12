# AAC platform benchmark (2026)

Deep competitive research for **Voxa** against commercial and open-source AAC solutions. Use with [FEATURE_PARITY.md](./FEATURE_PARITY.md) for GA gap tracking and [GA_ROADMAP.md](./GA_ROADMAP.md) for delivery phases.

**Research date:** 2026-06-08  
**Scope:** Symbol-based and text-based AAC apps, cloud platforms, and major open-source alternatives in the alternative communication space.

---

## 1. Executive summary

### Market structure

The AAC software market is a **mature oligopoly** on iOS: Proloquo2Go (AssistiveWare), TouchChat / LAMP (PRC-Saltillo), TD Snap (Tobii Dynavox), Grid (Smartbox), and Speak for Yourself dominate SLP feature-matching workflows. Most charge **$150–$300 one-time** (iOS) or **subscription** (TD Snap, Proloquo+, CoughDrop legacy). Hardware vendors bundle AAC with **eye-tracking SGDs** (Tobii I-Series, TD Pilot).

**Gaps Voxa targets:**

| Gap | Incumbent weakness | Voxa response |
|-----|-------------------|---------------|
| Android / web parity | Most “robust” apps are iOS-only | Web GA live; mobile EAS in progress |
| Data portability | Proprietary `.gridset`, `.spb`, `.touchChat` | Native **OBF/OBZ** + import adapters (roadmap) |
| GLP-native design | Analytic/core-word bias; GLP as add-on | First-class `GlpButton` model (partial UI) |
| Modern AI | N-gram / static word lists | Consent-gated LLM + symbol prediction MVP |
| Subscription fatigue | TD Snap / Proloquo+ subscriptions | Commercial model TBD; open core Apache 2.0 repo |
| WCAG-native web | Legacy native apps; web as afterthought | WCAG 2.2 AA + axe CI |

### Benchmark conclusion (high level)

| Tier | Voxa web today (v1.0) | Full commercial GA target |
|------|------------------------|---------------------------|
| **Platform** | Web prod; mobile scaffold | Web + iOS + Android store GA |
| **Robust AAC core** | Demo board + editor MVP | Multi-board, robust vocab, motor-plan locks |
| **Access** | Touch, switch scan, dwell sim | + hardware switch + Tobii/IrisBond |
| **Interoperability** | OBF import/export API | + Grid/TouchChat/Snap adapters |
| **Clinical parity** | Fitzgerald, CVI themes | + PODD/Gateway page sets, usage reports |
| **AI differentiation** | LLM MVP | PictoBERT, symbol gen, bilingual neural TTS |

**Voxa is GA-ready for controlled web launch** but **not yet at feature parity** with top-tier symbol AAC apps (Proloquo2Go, TD Snap, SFY). Parity is a **multi-quarter product track**, not a single release gate — see [FEATURE_PARITY.md](./FEATURE_PARITY.md) and [PARITY_REMEDIATION_PLAN.md](./PARITY_REMEDIATION_PLAN.md).

---

## 2. Methodology

### Scoring legend

| Symbol | Meaning |
|--------|---------|
| **✅** | Production-ready / industry-standard on that platform |
| **🟡** | Partial, MVP, simulated, or limited coverage |
| **🔴** | Planned or roadmap-only |
| **❌** | Not offered / out of product scope |
| **—** | Unknown or varies by configuration |

### Feature taxonomy

Dimensions align with [OpenAAC Developer Considerations](https://www.openaac.org/considerations) (🟢 standard, ✅ common, ⭐ top apps, 💡 requested) plus commercial/platform factors:

1. **Platform & distribution**
2. **Access methods** (touch, switch, eye gaze, scanning)
3. **Vocabulary & linguistics** (core, motor plan, GLP, Fitzgerald)
4. **Symbols & media**
5. **Editing & customization**
6. **Speech output (TTS / recorded)**
7. **Prediction & AI**
8. **Cloud, sync & teams**
9. **Interoperability & backup**
10. **Analytics & reporting**
11. **Visual accessibility**
12. **Hardware & integrations**
13. **Commercial & licensing**

### Sources

- Vendor product pages: AssistiveWare, PRC-Saltillo, Tobii Dynavox, Smartbox, Speak for Yourself, Attainment
- Open-source: [Cboard](https://www.cboard.io), [FreeAAC](https://github.com/sonicbaume/FreeAAC), [AsTeRICS Grid](https://grid.asterics.eu), [Ability Foundry](https://abilityfoundry.org/xogo-aac/)
- Standards: [Open Board Format](https://www.openboardformat.org/), OpenAAC, Fitzgerald Key
- AT practitioner materials: California Voice Options Program comparisons, OCALI AAC app selection PDFs, SLP feature-matching charts (2024–2025)
- Voxa codebase: `PRD.md`, `packages/*`, `docs/launch/GA_CHECKLIST.md`

Pricing and feature lists change; verify before contracts or marketing claims.

---

## 3. Platform catalog

### 3.1 Tier A — Robust symbol AAC (clinical default set)

| Platform | Vendor | Primary OS | Model | Symbol set | Language philosophy |
|----------|--------|------------|-------|------------|---------------------|
| **Proloquo2Go** | AssistiveWare | iOS, Mac, Watch | ~$250 one-time | SymbolStix (~27k) | Crescendo core + categories |
| **Proloquo / Coach** | AssistiveWare | iOS | Subscription | SymbolStix | Newer UX; coaching tools |
| **Proloquo4Text** | AssistiveWare | iOS | One-time | Text-first | Literate users |
| **TouchChat HD + WordPower** | PRC-Saltillo | iOS | ~$150–250 | SymbolStix + WP layouts | WordPower core/fringe |
| **LAMP Words for Life** | PRC-Saltillo | iOS | ~$300 | LAMP / Unity | Motor planning + Unity |
| **TD Snap** | Tobii Dynavox | iOS, Windows, Android | Subscription | PCS (75k+) | Multiple page sets (Core First, Motor Plan, Scanning, …) |
| **Snap Core First** | Tobii Dynavox | Bundled / Snap | Subscription | PCS | Core word + literacy path |
| **Grid 3 / Grid for iPad** | Smartbox | Windows, iOS | License | Widgit + others | Grid + Super Core |
| **Speak for Yourself** | SFY LLC / AbleNet | iOS | ~$300 | Smarty Symbols | Fixed motor plan, 14k words ≤2 touches |
| **Flexspeak** | Flexspeak | iOS | VPP / sub | Multilingual sets | AI-assisted customization |

### 3.2 Tier B — Flexible / emergent / text AAC

| Platform | Vendor | OS | Notes |
|----------|--------|-----|-------|
| **GoTalk NOW** | Attainment | iOS | Highly customizable; up to 36 buttons/page; media-rich |
| **TalkTablet PRO** | Gus Comm Devices | iOS, Android | Lower price; cross-platform |
| **Predictable** | Therapy Box | iOS | Text + prediction for literate users |
| **Avaz AAC** | Avaz | iOS, Android | Popular internationally; picture + keyboard |
| **Niki Talk 2 Pro** | — | iOS | Photo-based |
| **Weave Chat AAC** | — | iOS | Smaller market share |

### 3.3 Tier C — Open source & standards-first

| Platform | License | OS | OBF | Notes |
|----------|---------|-----|-----|-------|
| **Cboard** | GPL-3 | Web, iOS, Android, Windows | ✅ | UNICEF-backed; global reach |
| **AsTeRICS Grid** | AGPL-3 | Web | ✅ | EU accessibility focus |
| **FreeAAC** | AGPL-3 | iOS, Android, Web | ✅ | On-device neural TTS; multi-format import |
| **FreeVoice** | MIT | Web PWA | 🟡 | Offline PWA; ARASAAC; no account |
| **Ability Foundry AAC** | AGPL + Commons | Flutter all platforms | ✅ | AI suggestions; non-commercial clause |
| **CoughDrop** | Former OSS | Web | ✅ | **Not recommended** — stagnant since ~2024 |

### 3.4 Tier D — Hardware-centric ecosystems

| Ecosystem | AAC software | Differentiator |
|-----------|--------------|----------------|
| **Tobii Dynavox** | TD Snap, Gaze Point | Eye tracking + PCS + myTobiiDynavox cloud |
| **PRC-Saltillo** | TouchChat, LAMP, Accent devices | Unity / WordPower on dedicated hardware |
| **Smartbox** | Grid 3 | Grid Pad + Grid Eye |
| **Apple** | Proloquo ecosystem | Deep iOS integration |

---

## 4. Cross-platform summary matrix

**Columns:** ✅ full · 🟡 partial · ❌ none · — n/a  
**Voxa columns:** **Now** = production web v1.0 · **Target** = full commercial GA + parity phase

| Dimension | Voxa Now | Voxa Target | Proloquo2Go | TD Snap | LAMP | SFY | Grid 3 | Cboard | FreeAAC |
|-----------|----------|-------------|-------------|---------|------|-----|--------|--------|---------|
| **Web app** | ✅ | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Android** | 🔴 | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **iOS native** | 🔴 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Windows** | 🟡 | 🟡 | 🟡 | ✅ | ❌ | ❌ | ✅ | ✅ | 🟡 |
| **Chromebook** | ✅ | ✅ | ❌ | 🟡 | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Offline use** | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| **Cloud sync** | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ | ✅ | 🟡 |
| **Team / remote edit** | 🟡 | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ | 🟡 | ❌ |
| **OBF import/export** | ✅ | ✅ | ❌ | 🟡 | ❌ | ❌ | 🟡 | ✅ | ✅ |
| **Grid/TouchChat import** | ❌ | 🟡 | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Switch scanning** | 🟡 | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 |
| **Eye gaze native** | ❌ | 🟡 | 🟡 | ✅ | 🟡 | ❌ | ✅ | ❌ | ❌ |
| **Core vocabulary** | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 |
| **Motor planning locks** | 🟡 | ✅ | 🟡 | ✅ | ✅ | ✅ | 🟡 | ❌ | ❌ |
| **GLP phrase + video/audio** | 🟡 | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ❌ | 🟡 |
| **Fitzgerald / POS colors** | ✅ | ✅ | ✅ | ✅ | 🟡 | ❌ | ✅ | 🟡 | 🟡 |
| **Symbol library (large)** | ❌ | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 |
| **Custom photos / upload** | 🟡 | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ |
| **Recorded speech buttons** | 🔴 | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 |
| **Neural TTS / bilingual** | 🟡 | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 | ✅ |
| **LLM / context prediction** | 🟡 | ✅ | 🟡 | 🟡 | ❌ | ❌ | 🟡 | ❌ | 🟡 |
| **Symbol AI prediction** | 🟡 | ✅ | 🟡 | 🟡 | ❌ | ❌ | 🟡 | ❌ | ❌ |
| **AI symbol generation** | 🔴 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Usage / activation logs** | 🔴 | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ | ❌ | 🟡 |
| **Visual schedules / scripts** | ❌ | 🟡 | 🟡 | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Google Assistant / IoT** | ❌ | 🔴 | ❌ | ✅ | ❌ | ❌ | 🟡 | ❌ | ❌ |
| **WCAG-native web** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | 🟡 |
| **CVI / high contrast themes** | ✅ | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ | 🟡 | 🟡 |
| **HIPAA-ready enterprise** | 🟡 | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ | ❌ | ❌ |
| **One-time purchase option** | TBD | TBD | ✅ | ❌ | ✅ | ✅ | 🟡 | ✅ | ✅ |

---

## 5. Detailed dimension notes

### 5.1 Platform & distribution

| Platform | Web | iOS | Android | Windows | Offline | Pricing (indicative) |
|----------|-----|-----|---------|---------|---------|----------------------|
| Proloquo2Go | ❌ | ✅ | ❌ | Mac only | ✅ | ~$249.99 |
| TD Snap | ❌ | ✅ | ✅ | ✅ | ✅ | Subscription (~$50/mo class) |
| TouchChat / LAMP | ❌ | ✅ | ❌ | ❌ | ✅ | $149–299 |
| Grid 3 | ❌ | ✅ (Grid iPad) | ❌ | ✅ | ✅ | License + device |
| Speak for Yourself | ❌ | ✅ | ❌ | ❌ | ✅ | ~$299.99 |
| GoTalk NOW | ❌ | ✅ | ❌ | ❌ | ✅ | Freemium / Plus |
| Cboard | ✅ | ✅ | ✅ | ✅ | 🟡 | Free |
| FreeAAC | ✅ | ✅ | ✅ | 🟡 | ✅ | Free (AGPL) |
| **Voxa** | ✅ prod | 🔴 EAS | 🔴 EAS | 🟡 browser | 🟡 cache | TBD commercial |

**Voxa advantage:** Only Tier-A-class *intent* with **web-first GA**, Apache 2.0 codebase, and Enclii-managed madfam.io deploy. **Voxa gap:** No App Store / Play presence until Phase 4 ([MOBILE_GA.md](./MOBILE_GA.md)).

### 5.2 Access methods

| Feature | OpenAAC priority | Leaders | Voxa Now | Voxa Target |
|---------|------------------|---------|----------|-------------|
| Touch (1 cm targets) | 🟢 | All Tier A | ✅ `@voxa/ui` | ✅ |
| Touch-release vs touch-start | 🟢 | Proloquo, Grid | ❌ | 🟡 |
| Hold-to-select dwell | ⭐ | Grid, TD Snap | 🟡 web sim | ✅ + hardware |
| Row/column/linear scan | ⭐ | TD Snap Scanning, Grid | 🟡 web | ✅ + BT switch |
| Auditory scan | ⭐ | TD Snap, Grid | ❌ | 🟡 |
| Eye gaze (Tobii) | ⭐ | TD Snap, Grid | ❌ | 🟡 adapter |
| Head tracking | 💜 | Grid, TouchChat | ❌ | 🔴 |
| Keyguard / touch guard | 💡 | Hardware add-ons | ❌ | 🟡 |

Voxa implements switch scan and dwell in `@voxa/access` + web settings; **hardware integration is the primary parity gap** vs TD Snap / Grid.

### 5.3 Vocabulary & linguistics

| System | Motor planning | Core words | GLP / gestalt | Fitzgerald | Max words / depth |
|--------|----------------|------------|---------------|------------|-------------------|
| LAMP WFL | ✅ Unity fixed | ✅ | 🟡 | 🟡 | Large Unity |
| Speak for Yourself | ✅ strict | ✅ | 🟡 | ❌ Smarty | ~14k, ≤2 taps |
| Proloquo2Go | 🟡 Crescendo | ✅ | 🟡 | ✅ | 27k+ symbols |
| TD Snap Core First | 🟡 | ✅ | 🟡 | ✅ | PCS + page sets |
| WordPower (TouchChat) | 🟡 | ✅ | 🟡 | ✅ | Phrase + category |
| **Voxa** | 🟡 locked slots in model | 🟡 demo | 🟡 type in core | ✅ | Editor MVP |

**Voxa differentiation (when complete):** Native **GLP button type** with recorded audio/video — rare as first-class citizens in Tier A apps.

### 5.4 Interoperability

| Format | Proloquo | TD Snap | Grid | TouchChat | CoughDrop/OBF | Voxa |
|--------|----------|---------|------|-----------|---------------|------|
| OBF / OBZ | ❌ | 🟡 export paths | 🟡 | ❌ | ✅ | ✅ |
| `.gridset` | ❌ | ❌ | ✅ | ❌ | via tools | 🔴 adapter |
| `.spb` Snap | ❌ | ✅ | ❌ | ❌ | via AACProcessors | 🔴 adapter |
| `.touchChat` | ❌ | ❌ | ❌ | ✅ | via AACProcessors | 🔴 adapter |

Reference tooling: [willwade/AACProcessors](https://github.com/willwade/AACProcessors) (Python/Node) for migration pipelines.

### 5.5 AI & prediction

| Capability | TD Snap | Proloquo2Go | FreeAAC | **Voxa Now** | **Voxa Target** |
|------------|---------|-------------|---------|--------------|-----------------|
| N-gram / static prediction | 🟡 | 🟡 | 🟡 | stub + LLM MVP | ✅ |
| Contextual LLM phrases | ❌ | ❌ | 🟡 | ✅ consent-gated | ✅ |
| Symbol sequence ML | ❌ | ❌ | ❌ | 🔴 PictoBERT | ✅ |
| Generative symbols | ❌ | ❌ | ❌ | 🔴 | ✅ guarded |
| On-device AI | ❌ | ❌ | ✅ TTS | ❌ | v2 roadmap |
| Bilingual mid-utterance TTS | 🟡 | ✅ | 🟡 | 🟡 browser TTS | ✅ neural |

### 5.6 Cloud, teams, and clinical workflow

| Feature | TD Snap (myTobiiDynavox) | Grid | Proloquo | **Voxa Now** |
|---------|--------------------------|------|----------|--------------|
| Cloud backup | ✅ | ✅ | 🟡 iCloud | ✅ Postgres |
| Remote editor role | ✅ | ✅ | 🟡 | 🟡 roles in API |
| Real-time co-edit | 🟡 | 🟡 | ❌ | 🔴 WebSocket |
| Usage analytics | ✅ | ✅ | 🟡 | 🟡 consent-gated API + SLP Usage panel |
| SSO / org auth | 🟡 enterprise | 🟡 | ❌ | ✅ Janua |
| Billing / entitlements | ✅ devices | ✅ | ❌ | ✅ Dhanam |

---

## 6. Competitive positioning map

```mermaid
quadrantChart
  title AAC platform positioning (conceptual)
  x-axis Low openness --> High openness
  y-axis Legacy stack --> Modern AI + cloud
  quadrant-1 Voxa target
  quadrant-2 Open source (Cboard, FreeAAC)
  quadrant-3 Legacy iOS oligopoly
  quadrant-4 Enterprise SGD (TD Snap, Grid)
  Voxa today: [0.72, 0.68]
  Voxa GA target: [0.85, 0.82]
  Proloquo2Go: [0.25, 0.45]
  TD Snap: [0.35, 0.55]
  Cboard: [0.88, 0.35]
  FreeAAC: [0.90, 0.62]
  Speak for Yourself: [0.20, 0.40]
  Grid 3: [0.30, 0.50]
```

**Strategic wedge:** Voxa competes on **open interchange + modern web stack + AI**, not on **PCS symbol count day one** or **bundled eye-tracking hardware**.

---

## 7. Risk register (competitive)

| Risk | Impact | Mitigation |
|------|--------|------------|
| SLPs default to Proloquo2Go / TD Snap feature-matching charts | Slow adoption | Publish [FEATURE_PARITY.md](./FEATURE_PARITY.md); OBF migration guides |
| Symbol library gap vs PCS/SymbolStix | Clinical rejection | Integrate ARASAAC/OpenSymbols; AI symbol gen |
| No iOS app at web GA | “Not real AAC” perception | Accelerate EAS Phase 4; web PWA install |
| TD Snap adds LLM features | Reduced differentiation | Double down on GLP + open data + madfam.io trust |
| AGPL competitors (FreeAAC) | Price pressure | Apache 2.0 + hosted commercial tier |

---

## 8. References

- [AssistiveWare Proloquo2Go](https://www.assistiveware.com/products/proloquo2go)
- [Tobii Dynavox TD Snap](https://www.tobiidynavox.com/products/td-snap)
- [PRC-Saltillo LAMP / TouchChat](https://www.prc-saltillo.com/)
- [Smartbox Grid](https://thinksmartbox.com/products/grid/)
- [Speak for Yourself features](https://speakforyourself.org/features/)
- [Cboard](https://www.cboard.io) · [FreeAAC](https://github.com/sonicbaume/FreeAAC)
- [Open Board Format](https://www.openboardformat.org/)
- [OpenAAC considerations](https://www.openaac.org/considerations)
- [AACProcessors format conversion](https://github.com/willwade/AACProcessors)
- Voxa: [PRD.md](../../PRD.md) · [linguistic-framework.md](../linguistic-framework.md) · [ai-roadmap.md](../ai-roadmap.md)

---

## Related internal docs

- [PRICING_STRATEGY.md](./PRICING_STRATEGY.md) — Tulana-anchored tiers, competitor normalization, Dhanam handoff
- [FEATURE_PARITY.md](./FEATURE_PARITY.md) — GA parity checklist vs this benchmark
- [PARITY_REMEDIATION_PLAN.md](./PARITY_REMEDIATION_PLAN.md) — remediation waves, epics, M6 gates
- [GA_ROADMAP.md](./GA_ROADMAP.md) — phased delivery including parity phase
- [GA_CHECKLIST.md](./GA_CHECKLIST.md) — launch gates
