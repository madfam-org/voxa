/**
 * Spanish (es-MX) present-tense conjugation for core AAC verbs.
 *
 * LINGUISTIC REVIEW: pending review by a credentialed SLP (ruling R89).
 * The tables below were written from standard Mexican Spanish grammar and
 * have not yet been reviewed by a speech-language pathologist. Do not
 * describe them as clinically validated until that review is recorded.
 *
 * Scope: indicative present only, for the persons used in Mexico
 * (yo, tú, él/ella/usted, nosotros/nosotras, ellos/ellas/ustedes).
 * `vosotros` is not produced: es-MX uses `ustedes` (third-person plural).
 */

/** Grammatical person: 1s yo · 2s tú · 3s él/ella/usted · 1p nosotros · 3p ellos/ustedes. */
export type SpanishPerson = '1s' | '2s' | '3s' | '1p' | '3p';

export const SPANISH_PERSONS: readonly SpanishPerson[] = ['1s', '2s', '3s', '1p', '3p'];

type PresentTable = Readonly<Record<SpanishPerson, string>>;

function table(forms: [string, string, string, string, string]): PresentTable {
  const [s1, s2, s3, p1, p3] = forms;
  return { '1s': s1, '2s': s2, '3s': s3, '1p': p1, '3p': p3 };
}

/** Fully irregular (or irregular-enough) verbs that appear on Core 47/100 boards. */
const IRREGULAR_PRESENT: Readonly<Record<string, PresentTable>> = {
  ser: table(['soy', 'eres', 'es', 'somos', 'son']),
  estar: table(['estoy', 'estás', 'está', 'estamos', 'están']),
  ir: table(['voy', 'vas', 'va', 'vamos', 'van']),
  tener: table(['tengo', 'tienes', 'tiene', 'tenemos', 'tienen']),
  obtener: table(['obtengo', 'obtienes', 'obtiene', 'obtenemos', 'obtienen']),
  venir: table(['vengo', 'vienes', 'viene', 'venimos', 'vienen']),
  querer: table(['quiero', 'quieres', 'quiere', 'queremos', 'quieren']),
  poder: table(['puedo', 'puedes', 'puede', 'podemos', 'pueden']),
  hacer: table(['hago', 'haces', 'hace', 'hacemos', 'hacen']),
  decir: table(['digo', 'dices', 'dice', 'decimos', 'dicen']),
  ver: table(['veo', 'ves', 've', 'vemos', 'ven']),
  dar: table(['doy', 'das', 'da', 'damos', 'dan']),
  poner: table(['pongo', 'pones', 'pone', 'ponemos', 'ponen']),
  salir: table(['salgo', 'sales', 'sale', 'salimos', 'salen']),
  saber: table(['sé', 'sabes', 'sabe', 'sabemos', 'saben']),
  jugar: table(['juego', 'juegas', 'juega', 'jugamos', 'juegan']),
  oír: table(['oigo', 'oyes', 'oye', 'oímos', 'oyen']),
  traer: table(['traigo', 'traes', 'trae', 'traemos', 'traen']),
  caer: table(['caigo', 'caes', 'cae', 'caemos', 'caen']),
  oler: table(['huelo', 'hueles', 'huele', 'olemos', 'huelen']),
  seguir: table(['sigo', 'sigues', 'sigue', 'seguimos', 'siguen']),
  elegir: table(['elijo', 'eliges', 'elige', 'elegimos', 'eligen']),
  conocer: table(['conozco', 'conoces', 'conoce', 'conocemos', 'conocen']),
  parecer: table(['parezco', 'pareces', 'parece', 'parecemos', 'parecen']),
  construir: table(['construyo', 'construyes', 'construye', 'construimos', 'construyen']),
  enviar: table(['envío', 'envías', 'envía', 'enviamos', 'envían']),
};

type StemChange = 'e>ie' | 'o>ue' | 'e>i';

/** Stem-changing verbs ("boot" verbs): the change applies to every person except nosotros. */
const STEM_CHANGING: Readonly<Record<string, StemChange>> = {
  pensar: 'e>ie',
  cerrar: 'e>ie',
  empezar: 'e>ie',
  comenzar: 'e>ie',
  despertar: 'e>ie',
  sentar: 'e>ie',
  sentir: 'e>ie',
  preferir: 'e>ie',
  entender: 'e>ie',
  perder: 'e>ie',
  encender: 'e>ie',
  mentir: 'e>ie',
  dormir: 'o>ue',
  volver: 'o>ue',
  encontrar: 'o>ue',
  mostrar: 'o>ue',
  contar: 'o>ue',
  costar: 'o>ue',
  acostar: 'o>ue',
  almorzar: 'o>ue',
  mover: 'o>ue',
  morder: 'o>ue',
  probar: 'o>ue',
  recordar: 'o>ue',
  soñar: 'o>ue',
  pedir: 'e>i',
  repetir: 'e>i',
  servir: 'e>i',
  vestir: 'e>i',
  medir: 'e>i',
};

/**
 * Regular infinitives the starter boards use. A word outside this list (and
 * outside the irregular/stem tables) is only conjugated when the board marks
 * it as a verb, so nouns such as "mujer" or "lugar" are never conjugated.
 */
const KNOWN_REGULAR_INFINITIVES: ReadonlySet<string> = new Set([
  'abrazar', 'abrir', 'amar', 'arreglar', 'aprender', 'ayudar', 'bailar', 'bajar', 'bañar', 'beber',
  'buscar', 'caminar', 'cantar', 'cepillar', 'cocinar', 'comer', 'compartir', 'comprar', 'correr',
  'cortar', 'cuidar', 'desayunar', 'descansar', 'dibujar', 'empacar', 'empujar', 'enseñar', 'entrar',
  'escribir', 'escuchar', 'esperar', 'estudiar', 'gritar', 'girar', 'gustar', 'hablar', 'jalar',
  'lavar', 'leer', 'limpiar', 'llamar', 'llegar', 'llevar', 'llorar', 'mandar', 'mirar', 'nadar',
  'necesitar', 'parar', 'pasar', 'pegar', 'pintar', 'preguntar', 'quitar', 'regresar', 'romper',
  'saltar', 'sacar', 'subir', 'terminar', 'tirar', 'tocar', 'tomar', 'trabajar', 'usar', 'vivir',
  'cenar', 'comprender', 'meter', 'responder', 'vender', 'escoger', 'recoger', 'proteger',
]);

/** Verbs whose first person singular takes -jo (escoger → escojo). */
const GER_GIR_TO_JO: ReadonlySet<string> = new Set(['escoger', 'recoger', 'proteger']);

const REGULAR_ENDINGS: Readonly<Record<'ar' | 'er' | 'ir', PresentTable>> = {
  ar: table(['o', 'as', 'a', 'amos', 'an']),
  er: table(['o', 'es', 'e', 'emos', 'en']),
  ir: table(['o', 'es', 'e', 'imos', 'en']),
};

/** Object/reflexive clitics an infinitive may carry: vestirme, sentarse, pararnos. */
const CLITIC_SUFFIX = /^(.*?(?:ar|er|ir|ír))(me|te|se|nos)$/;

export const SPANISH_REFLEXIVE_PRONOUN: Readonly<Record<SpanishPerson, string>> = {
  '1s': 'me',
  '2s': 'te',
  '3s': 'se',
  '1p': 'nos',
  '3p': 'se',
};

function infinitiveClass(infinitive: string): 'ar' | 'er' | 'ir' | null {
  if (infinitive.endsWith('ar')) return 'ar';
  if (infinitive.endsWith('er')) return 'er';
  if (infinitive.endsWith('ir') || infinitive.endsWith('ír')) return 'ir';
  return null;
}

function applyStemChange(stem: string, change: StemChange): string {
  const [from, to] = change.split('>') as [string, string];
  // The change hits the last stem vowel `from` (despert- → despiert-, encontr- → encuentr-).
  const index = stem.lastIndexOf(from);
  if (index < 0) return stem;
  return stem.slice(0, index) + to + stem.slice(index + 1);
}

/** True when `word` is an infinitive these tables know without a part-of-speech hint. */
export function isKnownSpanishInfinitive(word: string): boolean {
  const lemma = splitClitic(word.toLowerCase()).infinitive;
  return (
    lemma in IRREGULAR_PRESENT ||
    lemma in STEM_CHANGING ||
    KNOWN_REGULAR_INFINITIVES.has(lemma)
  );
}

/** Looks like an infinitive (optionally with a clitic): ends in -ar/-er/-ir. */
export function looksLikeSpanishInfinitive(word: string): boolean {
  const lemma = splitClitic(word.toLowerCase()).infinitive;
  return lemma.length > 2 && infinitiveClass(lemma) !== null;
}

/** Split a clitic-suffixed infinitive: "sentarse" → { infinitive: "sentar", clitic: "se" }. */
export function splitClitic(word: string): { infinitive: string; clitic: string | null } {
  const lower = word.toLowerCase();
  if (lower in IRREGULAR_PRESENT || lower in STEM_CHANGING || KNOWN_REGULAR_INFINITIVES.has(lower)) {
    return { infinitive: lower, clitic: null };
  }
  const match = CLITIC_SUFFIX.exec(lower);
  if (!match) return { infinitive: lower, clitic: null };
  return { infinitive: match[1]!, clitic: match[2]! };
}

/**
 * Present indicative of `infinitive` for `person`, or null when the word is
 * not a Spanish infinitive. Clitics are not handled here (see
 * `conjugateSpanishVerbPhrase`).
 */
export function conjugateSpanishPresent(infinitive: string, person: SpanishPerson): string | null {
  const lemma = infinitive.trim().toLowerCase();
  const irregular = IRREGULAR_PRESENT[lemma];
  if (irregular) return irregular[person];

  const cls = infinitiveClass(lemma);
  if (!cls || lemma.length <= 2) return null;
  let stem = lemma.slice(0, -2);
  const endings = REGULAR_ENDINGS[cls];

  const change = STEM_CHANGING[lemma];
  if (change && person !== '1p') stem = applyStemChange(stem, change);

  if (person === '1s' && GER_GIR_TO_JO.has(lemma)) {
    return `${stem.slice(0, -1)}jo`;
  }
  return `${stem}${endings[person]}`;
}

/**
 * Conjugate the verb at the start of a (possibly multi-word) button text:
 * "ir a la escuela" + 1s → "voy a la escuela"; "sentarse" + 1s → "me siento".
 * A clitic-suffixed infinitive is treated as reflexive and its clitic is
 * replaced by the one agreeing with `person` ("vestirme" + 3s → "se viste").
 * Returns null when the first word is not an infinitive.
 */
export function conjugateSpanishVerbPhrase(
  text: string,
  person: SpanishPerson,
  options: { reflexive?: boolean } = {},
): string | null {
  const words = text.trim().split(/\s+/);
  const head = words[0];
  if (!head) return null;
  const { infinitive, clitic } = splitClitic(head);
  const conjugated = conjugateSpanishPresent(infinitive, person);
  if (!conjugated) return null;
  const reflexive = options.reflexive || clitic !== null;
  const verb = reflexive ? `${SPANISH_REFLEXIVE_PRONOUN[person]} ${conjugated}` : conjugated;
  return [matchCase(head, verb), ...words.slice(1)].join(' ');
}

/** Keep a leading capital when the source word had one. */
export function matchCase(source: string, output: string): string {
  const first = source.charAt(0);
  if (first && first !== first.toLowerCase()) {
    return output.charAt(0).toUpperCase() + output.slice(1);
  }
  return output;
}
