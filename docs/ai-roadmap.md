# AI Roadmap

AI features are **assistive, not autonomous** — the communicator always confirms output before speech.

## Current state (2026-10)

- Text suggestions come from the local rule-based predictor in `@voxa/ai`
  (English and Spanish continuation tables, chosen by the board locale; the
  Spanish table awaits review by a credentialed speech-language pathologist).
- With `SELVA_ENABLED=true` the API asks Selva, the ecosystem model gateway,
  first. It sends only the current partial utterance, always as
  `X-Sensitivity: restricted` (local models only), and falls back to the local
  predictor on any failure. See `apps/api/src/lib/selva.ts`.
- Symbol suggestions are local only.
- No request goes to a third-party AI service; the CI guard
  `scripts/guards/llm-egress.mjs` fails on model-vendor hosts, SDKs or API-key
  variables (ruling R88).
- Everything below this section is a plan, not a shipped feature. Status per
  capability: [capabilities.md](./capabilities.md#word-suggestions-and-ai).

## Model-based predictive text (not built beyond the switched-off Selva path)

**Goal:** Replace rule-based suggestions with context-aware phrase completion.

| Stage | Scope |
|-------|-------|
| Built, off | Selva gateway, `restricted` sensitivity (local models only), current partial utterance only (last 200 characters) |
| Next | Turn it on once Selva serves a local model for `restricted` requests and this service has its own Janua client |
| Later | Personalisation only from consented data, inside MADFAM infrastructure; an on-device model for offline prediction |

Guardrails: no medical/legal advice generation, content filters for age-appropriate communicators, SLP override list.

## Next-symbol prediction (not built)

A transformer model (PictoBERT-style) predicts the next pictogram given recent symbol sequence + situational tags (time, location if shared).

- Base model: public pictogram embedding checkpoint (TBD)
- Personalization: lightweight fine-tune on activation logs
- Surfaces top-3 symbols in a **prediction strip** above the grid

## Generative symbol creation (not built)

Image generation in the MADFAM ecosystem belongs to its media service, not to Voxa. Caregiver workflow, if built:

1. Text prompt and/or reference photo upload
2. Model generates **up to 4** style-matched symbols (consistent line weight, background)
3. SLP/caregiver picks one; others discarded
4. Safety: blocked categories (violence, adult content), no photorealistic faces of real minors

## Natural, licensed and bilingual voices (not built)

> **Status (2026-10):** not built. Voxa speaks with the voices installed on the device, with voice choice and rate/pitch/volume tuning ([accessibility.md](./accessibility.md#speech-output-device-voices)). Licensed or neural voices, including natural child voices, are pending an owner decision. The plan below is the target, not the current state.

- Primary engines: cloud neural TTS with regional variants (en-US, es-MX, es-US, etc.)
- Mid-sentence language detection per word → route to correct voice
- User-recorded GLP audio always takes precedence when configured

## Privacy & Consent

What ships today (server-side consent per person and purpose; see
[data-model.md](./data-model.md#consents-and-consent_events)):

| Data | Default |
|------|---------|
| Word suggestions (`ai_processing`) | Off until the person turns them on; nothing is sent while undecided |
| Usage counts (`usage_analytics`) | Off until the person turns them on; board and button ids only |
| Spoken text (`utterance_text`) | Not stored. Only for an organization with a data-processing agreement and a separate opt-in, cleared after 90 days; no organization is enabled |
| Symbol generation uploads | Not applicable (not built) |

Implementation contracts live in `@voxa/ai`.
