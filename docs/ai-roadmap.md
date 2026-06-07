# AI Roadmap

AI features are **assistive, not autonomous** — the communicator always confirms output before speech.

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
