# Clinical review — pending

**Status: pending clinical review.** No credentialed speech-language pathologist
(SLP) has reviewed Voxa. Voxa makes no claim of clinical review, in the app, on
the landing, in this repository or elsewhere, until a credentialed reviewer of
record has done one (ruling R89, 2026-10-03).

## What happened to the June 2026 sign-off

This file used to hold an "SLP accessibility sign-off" dated 2026-06-08. The
reviewer named there was MADFAM's product team acting on an owner delegation,
not a credentialed SLP, and the review was a product and accessibility checklist
on staging. That record is **withdrawn**: it was not a clinical review and must
not be cited as one. The launch records in this folder that pointed to it now
say so.

## What a reviewer of record will review

The items below were written by the project from standard Mexican Spanish usage
and AAC practice. Each carries a "pending clinical review" marker where it lives.

| Item | Where |
| --- | --- |
| es-MX core vocabulary and translations of Core 47 and Core 100 | `packages/core/src/` (starter boards, demo board) |
| Word selection and order of the 24/36/60 core sizes | `packages/core/src/core-grid-sizes.ts`, `core-word-bank.ts` |
| Mulberry symbol allow-map for core words (picture matches the word, else label-only) | `packages/core/src/core-symbols.ts` |
| Spanish symbol keywords (450 symbols) | `packages/symbols/data/mulberry-es.tsv` |
| Spanish agreement and conjugation rules | `packages/vocabulary/src/spanish-*.ts`, [linguistic-framework.md](../linguistic-framework.md#spanish-morphology-es-mx) |
| Spanish word-suggestion table | `packages/ai/src/` |
| Spanish interface strings | `packages/i18n/messages/es.json` (`_review` note) |

## Checklist for the review (unchecked until it happens)

### Communicator

- [ ] Core boards: word choice, order and part-of-speech colours suit early communicators in es-MX
- [ ] Symbols on core words match the meaning in es-MX; label-only cells are acceptable where they are
- [ ] Spanish agreement suggestions read naturally, and the Base form toggle keeps control with the communicator
- [ ] Word suggestions do not put words in the communicator's mouth
- [ ] Speech: device voices, rate and pitch ranges and the "higher voice (approximation)" preset are appropriate

### Access

- [ ] Switch scanning (auto and step scan, group scan with Back, acceptance time, first-item hold, cues)
- [ ] Pointer dwell times and the keyguard
- [ ] Target sizes and spacing at default and enlarged scale

### Editor and caregivers

- [ ] Motor-plan locks and the admin-only override match clinical practice
- [ ] First-run setup choices and wording
- [ ] Gestalt (GLP) phrase buttons, recorded speech and video

## Record (fill in when the review happens)

| Field | Value |
|-------|-------|
| Reviewer (credentialed SLP) | — |
| Credential | — |
| Date | — |
| Environment and version reviewed | — |
| Outcome | — |

Automated accessibility evidence (axe in CI) is described in
[accessibility.md](../accessibility.md#testing); it is not a clinical review.
