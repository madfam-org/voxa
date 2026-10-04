# Linguistic Framework

Voxa serves **analytic** and **gestalt** language development paradigms simultaneously.

## Motor Planning Consistency

Core vocabulary occupies **fixed grid coordinates** (`row`, `column`) on a communicator's primary board. Once a slot is assigned:

1. The word/symbol at that slot is stable across board versions unless an editor explicitly unlocks the slot.
2. `@voxa/vocabulary` validates that core-grid mutations preserve locked positions.
3. Peripheral/folder vocabulary may reorganize without breaking motor plans.

This follows the motor-planning principle used by core-vocabulary AAC systems: a word keeps its place so selection becomes automatic.

### Core boards in three sizes

The `core-24` (4×6), `core-36` (6×6) and `core-60` (6×10) templates come from one ordered core word list per locale (`packages/core/src/core-grid-sizes.ts`). The sizes are nested: each grid is the top-left block of the next, and cells are filled along a fixed growth order (the 4×6 block row by row, then the two rows 6×6 adds, then the four columns 6×10 adds). A smaller board is exactly the part of a larger one inside its block, so moving a communicator to a bigger board never moves a word they learned: same row, same column, same label. The three locales share one order today, so a word also keeps its cell across es-MX, en-US and fr-FR. Only word-bank words with distinct labels in all three locales are used; each keeps its Fitzgerald part of speech and gets a Mulberry symbol from the allow-map or stays label-only. `packages/core/src/core-grid-sizes.test.ts` checks the rule for every locale and size.

> **Clinical review:** the word selection and order are pending review by a credentialed speech-language pathologist (ruling R89). The templates carry `vocabularyReview: "pending-clinical-review"` and the app says so where a template is chosen.

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

## Bilingual profiles (not built)

Today a board has one content language (es-MX, en-US or fr-FR), every utterance is spoken in that language, and the voice is chosen per language on the device. Two active languages per communicator and mid-utterance code-switching with per-word pronunciation are planned, not built; `segmentBilingualUtterance` in `@voxa/ai` is an unused contract.

## Spanish morphology (es-MX)

> **Linguistic review:** pending review by a credentialed SLP (ruling R89). The
> conjugation tables, the agreement rule and the Spanish interface strings were
> written from standard Mexican Spanish grammar and have not been reviewed by a
> speech-language pathologist yet.

Spanish boards hold infinitives ("querer", "beber"), so a message built by
tapping reads "yo querer beber". When the message bar is built on a board whose
content locale is Spanish, `@voxa/vocabulary` suggests the agreed form and the
bar shows and speaks it: "yo quiero beber".

The rule (`applySpanishAgreement`, `packages/vocabulary/src/spanish-agreement.ts`):

1. A subject pronoun (yo, tú, usted, él, ella, nosotros, nosotras, ustedes,
   ellos, ellas) opens a clause and sets person, gender and number. es-MX uses
   *ustedes* for the second person plural; *vosotros* is not produced.
2. The first infinitive after it is conjugated in the present indicative.
   Only negation and frequency adverbs may stand between them (no, también, ya,
   nunca, siempre, todavía); any other word ends the clause unchanged. Later
   infinitives stay infinitive ("yo quiero beber").
3. An infinitive with an attached clitic is reflexive, and the clitic moves in
   front of the verb and agrees with the subject: "ella sentarse" → "ella se
   sienta", "yo no vestirme" → "yo no me visto". "sentir" followed by a
   descriptor becomes "sentirse" ("yo sentir feliz" → "yo me siento feliz").
4. *gustar* and *encantar* agree with what is liked: "yo gustar jugar" → "me
   gusta jugar", "ella gustar" → "a ella le gusta".
5. After a copula (ser, estar, sentirse, parecer, quedar, ponerse) a known
   descriptor agrees in gender and number with the subject when the pronoun
   states them: "ella estar cansado" → "ella está cansada", "nosotros estar
   feliz" → "nosotros estamos felices". yo/tú/usted carry no gender, so their
   descriptors keep the board form.
6. With no subject pronoun nothing changes. Spanish drops subjects, and turning
   "querer agua" into "quiero agua" would put words in the communicator's mouth.
7. A word is a verb when the tables know it (regular board verbs, irregulars
   such as ser, estar, ir, tener, querer, poder, hacer, decir, venir, ver, dar,
   poner, salir, saber, jugar, and stem-changing verbs), or when the board tags
   the button as a verb and it ends in -ar/-er/-ir. Unknown words pass through.

**The communicator keeps control.** The agreed form is a suggestion applied when
the message is built. The message bar shows a **Base form** toggle whenever the
suggestion changed a word; pressing it shows and speaks the words exactly as
tapped. **Settings → Spanish agreement** turns the suggestion off. A tapped word suggestion becomes the message's words and gets the same
agreement, in its chip and when spoken. Single button
taps still speak the button's own text, and English and French boards keep
their existing word forms (`speechForms`).

Scope today: present indicative only, no past tense, subjunctive or object
agreement ("me gustan los carros" stays "me gusta"). Tests:
`packages/vocabulary/src/spanish-morphology.test.ts` and
`apps/web/src/lib/utterance-speech.test.ts`.
