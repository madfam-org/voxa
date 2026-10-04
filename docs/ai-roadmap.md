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

## LLM-Powered Predictive Text

**Goal:** Replace n-gram suggestions with context-aware phrase completion tuned to the user's history.

| Stage | Scope |
|-------|-------|
| MVP | Cloud LLM proxy with redacted context window (last N utterances + board topic) |
| v1 | Per-user fine-tune / adapter on consented transcript corpus |
| v2 | On-device small model for offline prediction |

Guardrails: no medical/legal advice generation, content filters for age-appropriate communicators, SLP override list.

## PictoBERT Symbol Prediction

Transformer model predicts the next pictogram given recent symbol sequence + situational tags (time, location if shared).

- Base model: public pictogram embedding checkpoint (TBD)
- Personalization: lightweight fine-tune on activation logs
- Surfaces top-3 symbols in a **prediction strip** above the grid

## Generative Symbol Creation

Caregiver workflow:

1. Text prompt and/or reference photo upload
2. Model generates **up to 4** style-matched symbols (consistent line weight, background)
3. SLP/caregiver picks one; others discarded
4. Safety: blocked categories (violence, adult content), no photorealistic faces of real minors

## Bilingual Neural TTS

> **Status (2026-10):** not built. Voxa speaks with the voices installed on the device, with voice choice and rate/pitch/volume tuning ([accessibility.md](./accessibility.md#speech-output-device-voices)). Licensed or neural voices, including natural child voices, are pending an owner decision. The plan below is the target, not the current state.

- Primary engines: cloud neural TTS with regional variants (en-US, es-MX, es-US, etc.)
- Mid-sentence language detection per word → route to correct voice
- User-recorded GLP audio always takes precedence when configured

## Privacy & Consent

| Data | Default |
|------|---------|
| Utterance logs for prediction | Opt-in |
| Symbol activation analytics | Opt-in (SLP reporting) |
| Symbol generation uploads | Ephemeral — not used for training unless consented |

Implementation contracts live in `@voxa/ai`.
