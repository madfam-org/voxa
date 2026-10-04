/**
 * Spanish (es-MX) agreement for a message built from AAC buttons.
 *
 * LINGUISTIC REVIEW: pending review by a credentialed SLP (ruling R89).
 *
 * The rule (documented in docs/linguistic-framework.md, "Spanish morphology"):
 *
 * 1. A subject pronoun (yo, tú, usted, él, ella, nosotros, nosotras, ustedes,
 *    ellos, ellas) opens a clause and sets person, gender and number.
 * 2. The first infinitive after it is conjugated in the present indicative
 *    for that person ("yo querer beber" → "yo quiero beber"). Only negation
 *    and frequency adverbs may stand between the pronoun and the verb
 *    (no, también, ya, nunca, siempre, todavía); any other word ends the clause
 *    without changes. Later infinitives stay infinitive ("quiero beber").
 * 3. A clitic-suffixed infinitive is reflexive and takes the clitic agreeing
 *    with the subject before the verb ("ella sentarse" → "ella se sienta").
 *    "sentir" followed by a descriptor becomes "sentirse"
 *    ("yo sentir feliz" → "yo me siento feliz").
 * 4. "gustar"/"encantar" agree with the thing liked, not the speaker:
 *    "yo gustar" → "me gusta", "ella gustar" → "a ella le gusta".
 * 5. After a copula (ser, estar, sentirse, parecer, quedar, poner), a known
 *    descriptor agrees in gender and number with the subject when the
 *    pronoun states them ("ella estar cansado" → "ella está cansada",
 *    "nosotros estar feliz" → "nosotros estamos felices"). yo/tú/usted carry
 *    no gender, so their descriptors keep the board form.
 * 6. Without a subject pronoun nothing changes: Spanish drops subjects, and
 *    guessing "querer agua" as "quiero agua" would put words in the
 *    communicator's mouth.
 *
 * The transform is a suggestion: the message bar shows it and offers the
 * base form with one tap, and the setting can turn it off entirely.
 */
import {
  conjugateSpanishPresent,
  isKnownSpanishInfinitive,
  looksLikeSpanishInfinitive,
  matchCase,
  splitClitic,
  type SpanishPerson,
  conjugateSpanishVerbPhrase,
} from './spanish-conjugation.js';

type Gender = 'm' | 'f';

interface Subject {
  person: SpanishPerson;
  gender?: Gender;
  plural: boolean;
}

const SUBJECT_PRONOUNS: Readonly<Record<string, Subject>> = {
  yo: { person: '1s', plural: false },
  'tú': { person: '2s', plural: false },
  usted: { person: '3s', plural: false },
  'él': { person: '3s', gender: 'm', plural: false },
  ella: { person: '3s', gender: 'f', plural: false },
  nosotros: { person: '1p', gender: 'm', plural: true },
  nosotras: { person: '1p', gender: 'f', plural: true },
  ustedes: { person: '3p', plural: true },
  ellos: { person: '3p', gender: 'm', plural: true },
  ellas: { person: '3p', gender: 'f', plural: true },
};

/** Words allowed between the subject pronoun and its verb. */
const PRE_VERB_ADVERBS: ReadonlySet<string> = new Set(['no', 'también', 'ya', 'nunca', 'siempre', 'todavía']);

/** Words allowed between a copula and its descriptor. */
const INTENSIFIERS: ReadonlySet<string> = new Set(['muy', 'más', 'tan', 'bastante', 'un poco', 'poco', 'no']);

const COPULAS: ReadonlySet<string> = new Set(['ser', 'estar', 'sentir', 'parecer', 'quedar', 'poner']);

/** Verbs whose grammatical subject is the thing liked: "me gusta", "le encanta". */
const GUSTAR_CLASS: ReadonlySet<string> = new Set(['gustar', 'encantar']);

const INDIRECT_OBJECT: Readonly<Record<SpanishPerson, string>> = {
  '1s': 'me',
  '2s': 'te',
  '3s': 'le',
  '1p': 'nos',
  '3p': 'les',
};

/**
 * Descriptors on (or likely to be added to) the starter boards, in their
 * masculine singular board form. Words ending in -o inflect for gender;
 * the rest only for number.
 */
const KNOWN_DESCRIPTORS: ReadonlySet<string> = new Set([
  'aburrido', 'alto', 'amarillo', 'asustado', 'avergonzado', 'azul', 'bajo', 'blanco', 'bonito', 'bueno',
  'calmado', 'cansado', 'caliente', 'celoso', 'confundido', 'contento', 'diferente', 'emocionado',
  'enfermo', 'enojado', 'feliz', 'feo', 'frío', 'frustrado', 'grande', 'hambriento', 'lastimado',
  'limpio', 'listo', 'lleno', 'malo', 'mojado', 'morado', 'negro', 'nervioso', 'nuevo', 'ocupado',
  'orgulloso', 'pequeño', 'preocupado', 'rojo', 'sediento', 'sorprendido', 'sucio', 'tranquilo',
  'triste', 'verde', 'viejo',
]);

export interface SpanishAgreementOptions {
  /** True when the board marks this message word as a verb (part of speech). */
  isVerb?: (word: string) => boolean;
  /** True when the board marks this message word as an adjective (part of speech). */
  isAdjective?: (word: string) => boolean;
}

export interface SpanishAgreementResult {
  /** Message words after agreement (may differ in count: "yo gustar" → "me gusta"). */
  words: string[];
  /** True when any word changed. */
  changed: boolean;
}

function norm(word: string): string {
  return word.trim().toLowerCase();
}

function headWord(token: string): string {
  return norm(token).split(/\s+/)[0] ?? '';
}

function isVerbToken(token: string, options: SpanishAgreementOptions): boolean {
  const head = headWord(token);
  if (!head) return false;
  if (isKnownSpanishInfinitive(head)) return true;
  return Boolean(options.isVerb?.(token)) && looksLikeSpanishInfinitive(head);
}

function isDescriptorToken(token: string, options: SpanishAgreementOptions): boolean {
  const word = norm(token);
  if (!word || /\s/.test(word)) return false;
  if (KNOWN_DESCRIPTORS.has(word)) return true;
  return Boolean(options.isAdjective?.(token)) && word.endsWith('o');
}

/**
 * Inflect a masculine-singular descriptor for gender and number:
 * cansado → cansada/cansados/cansadas, feliz → felices, triste → tristes.
 */
export function inflectSpanishDescriptor(word: string, gender: Gender | undefined, plural: boolean): string {
  let out = norm(word);
  if (gender === 'f' && out.endsWith('o')) out = `${out.slice(0, -1)}a`;
  if (plural) {
    if (/[aeiouáéó]$/.test(out)) out = `${out}s`;
    else if (out.endsWith('z')) out = `${out.slice(0, -1)}ces`;
    else if (out.endsWith('ón')) out = `${out.slice(0, -2)}ones`;
    else if (out.endsWith('és')) out = `${out.slice(0, -2)}eses`;
    else out = `${out}es`;
  }
  return matchCase(word.trim(), out);
}

/** Index of the next word after `from` that is not an intensifier, or -1. */
function nextContentIndex(words: readonly string[], from: number): number {
  for (let i = from; i < words.length; i += 1) {
    if (!INTENSIFIERS.has(norm(words[i]!))) return i;
  }
  return -1;
}

/** Pronoun phrase that precedes a gustar-class verb ("a ella", or nothing for yo/tú/nosotros). */
function gustarPronounPhrase(pronounToken: string, subject: Subject): string | null {
  if (subject.person === '1s' || subject.person === '2s' || subject.person === '1p') return null;
  return `a ${pronounToken.trim()}`;
}

/**
 * Apply subject–verb (and copula–descriptor) agreement to an es-MX message.
 * Pure: never mutates `words`. Unknown words pass through unchanged.
 */
export function applySpanishAgreement(
  words: readonly string[],
  options: SpanishAgreementOptions = {},
): SpanishAgreementResult {
  // Each slot may be replaced by zero or more output words.
  const out: Array<string | null> = [...words];
  let changed = false;

  let subject: Subject | null = null;
  let pronounIndex = -1;
  let awaitingVerb = false;
  let afterCopula = false;

  for (let i = 0; i < words.length; i += 1) {
    const token = words[i]!;
    const lower = norm(token);

    const pronoun = SUBJECT_PRONOUNS[lower];
    if (pronoun) {
      subject = pronoun;
      pronounIndex = i;
      awaitingVerb = true;
      afterCopula = false;
      continue;
    }
    if (!subject) continue;

    if (awaitingVerb) {
      if (PRE_VERB_ADVERBS.has(lower)) continue;
      if (!isVerbToken(token, options)) {
        subject = null;
        awaitingVerb = false;
        continue;
      }
      const head = headWord(token);
      const { infinitive, clitic } = splitClitic(head);
      awaitingVerb = false;

      if (GUSTAR_CLASS.has(infinitive)) {
        const verb = conjugateSpanishPresent(infinitive, '3s');
        const rest = norm(token).split(/\s+/).slice(1);
        out[i] = [INDIRECT_OBJECT[subject.person], verb, ...rest].join(' ');
        out[pronounIndex] = gustarPronounPhrase(words[pronounIndex]!, subject);
        changed = true;
        afterCopula = false;
        continue;
      }

      const nextIndex = nextContentIndex(words, i + 1);
      const reflexive =
        clitic !== null ||
        (infinitive === 'sentir' && nextIndex >= 0 && isDescriptorToken(words[nextIndex]!, options));
      const conjugated = conjugateSpanishVerbPhrase(token, subject.person, { reflexive });
      if (conjugated && conjugated !== token) {
        out[i] = conjugated;
        changed = true;
      }
      afterCopula = COPULAS.has(infinitive);
      continue;
    }

    if (afterCopula) {
      if (INTENSIFIERS.has(lower)) continue;
      if (lower === 'y') continue;
      if (isDescriptorToken(token, options)) {
        const inflected = inflectSpanishDescriptor(token, subject.gender, subject.plural);
        if (inflected !== token) {
          out[i] = inflected;
          changed = true;
        }
        continue;
      }
      afterCopula = false;
    }
  }

  return { words: out.filter((word): word is string => word !== null && word !== ''), changed };
}
