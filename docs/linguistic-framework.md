# Linguistic Framework

Voxa serves **analytic** and **gestalt** language development paradigms simultaneously.

## Motor Planning Consistency

Core vocabulary occupies **fixed grid coordinates** (`row`, `column`) on a communicator's primary board. Once a slot is assigned:

1. The word/symbol at that slot is stable across board versions unless an editor explicitly unlocks the slot.
2. `@voxa/vocabulary` validates that core-grid mutations preserve locked positions.
3. Peripheral/folder vocabulary may reorganize without breaking motor plans.

This mirrors clinical practice for Unity, LAMP, and Fitzgerald Key core boards.

## Gestalt Language Processing (GLP)

GLP buttons store **phrase chunks**, not just lemmas:

```typescript
type GlpButton = {
  kind: 'glp';
  phrase: string;
  audio?: { url: string; recordedBy: string }; // preferred over TTS early stage
  video?: { url: string; thumbnailUrl: string };
  intonationNotes?: string; // clinician metadata
};
```

Early-stage GLPs often reject synthesized speech; custom recordings preserve melodic meaning.

## Modified Fitzgerald Key

| Part of speech | Color | Hex |
|----------------|-------|-----|
| Adjective | Blue | `#2563eb` |
| Verb | Green | `#16a34a` |
| Pronoun | Yellow | `#eab308` |
| Noun | Orange | `#ea580c` |
| Preposition / Social | Pink | `#db2777` |
| Conjunction | White | `#ffffff` |

Color is applied to button borders/labels — never as the sole information carrier (icons + text always present).

## Bilingual Profiles

Communicators may define two active languages. Buttons carry per-locale labels and TTS voice IDs. Mid-utterance code-switching is resolved at speak time by `@voxa/ai` phoneme routing.
