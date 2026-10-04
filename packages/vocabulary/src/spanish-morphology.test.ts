/**
 * Spanish morphology tests. Expected forms are standard Mexican Spanish;
 * pending review by a credentialed SLP (ruling R89).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  conjugateSpanishPresent,
  conjugateSpanishVerbPhrase,
  isKnownSpanishInfinitive,
  SPANISH_PERSONS,
  type SpanishPerson,
} from './spanish-conjugation.js';
import { applySpanishAgreement, inflectSpanishDescriptor } from './spanish-agreement.js';

type Row = [string, [string, string, string, string, string]];

/** Full present-tense paradigms: yo, tú, él/ella/usted, nosotros, ellos/ustedes. */
const PARADIGMS: Row[] = [
  // regular -ar / -er / -ir
  ['hablar', ['hablo', 'hablas', 'habla', 'hablamos', 'hablan']],
  ['beber', ['bebo', 'bebes', 'bebe', 'bebemos', 'beben']],
  ['comer', ['como', 'comes', 'come', 'comemos', 'comen']],
  ['escribir', ['escribo', 'escribes', 'escribe', 'escribimos', 'escriben']],
  ['abrir', ['abro', 'abres', 'abre', 'abrimos', 'abren']],
  ['ayudar', ['ayudo', 'ayudas', 'ayuda', 'ayudamos', 'ayudan']],
  ['mirar', ['miro', 'miras', 'mira', 'miramos', 'miran']],
  ['escuchar', ['escucho', 'escuchas', 'escucha', 'escuchamos', 'escuchan']],
  ['esperar', ['espero', 'esperas', 'espera', 'esperamos', 'esperan']],
  ['parar', ['paro', 'paras', 'para', 'paramos', 'paran']],
  ['leer', ['leo', 'lees', 'lee', 'leemos', 'leen']],
  ['correr', ['corro', 'corres', 'corre', 'corremos', 'corren']],
  ['compartir', ['comparto', 'compartes', 'comparte', 'compartimos', 'comparten']],
  ['limpiar', ['limpio', 'limpias', 'limpia', 'limpiamos', 'limpian']],
  ['escoger', ['escojo', 'escoges', 'escoge', 'escogemos', 'escogen']],
  // irregulars on Core 47/100
  ['querer', ['quiero', 'quieres', 'quiere', 'queremos', 'quieren']],
  ['ir', ['voy', 'vas', 'va', 'vamos', 'van']],
  ['tener', ['tengo', 'tienes', 'tiene', 'tenemos', 'tienen']],
  ['poder', ['puedo', 'puedes', 'puede', 'podemos', 'pueden']],
  ['hacer', ['hago', 'haces', 'hace', 'hacemos', 'hacen']],
  ['ser', ['soy', 'eres', 'es', 'somos', 'son']],
  ['estar', ['estoy', 'estás', 'está', 'estamos', 'están']],
  ['decir', ['digo', 'dices', 'dice', 'decimos', 'dicen']],
  ['venir', ['vengo', 'vienes', 'viene', 'venimos', 'vienen']],
  ['ver', ['veo', 'ves', 've', 'vemos', 'ven']],
  ['dar', ['doy', 'das', 'da', 'damos', 'dan']],
  ['poner', ['pongo', 'pones', 'pone', 'ponemos', 'ponen']],
  ['salir', ['salgo', 'sales', 'sale', 'salimos', 'salen']],
  ['saber', ['sé', 'sabes', 'sabe', 'sabemos', 'saben']],
  ['jugar', ['juego', 'juegas', 'juega', 'jugamos', 'juegan']],
  ['obtener', ['obtengo', 'obtienes', 'obtiene', 'obtenemos', 'obtienen']],
  ['oír', ['oigo', 'oyes', 'oye', 'oímos', 'oyen']],
  ['traer', ['traigo', 'traes', 'trae', 'traemos', 'traen']],
  ['conocer', ['conozco', 'conoces', 'conoce', 'conocemos', 'conocen']],
  // stem-changing
  ['dormir', ['duermo', 'duermes', 'duerme', 'dormimos', 'duermen']],
  ['sentir', ['siento', 'sientes', 'siente', 'sentimos', 'sienten']],
  ['cerrar', ['cierro', 'cierras', 'cierra', 'cerramos', 'cierran']],
  ['despertar', ['despierto', 'despiertas', 'despierta', 'despertamos', 'despiertan']],
  ['encontrar', ['encuentro', 'encuentras', 'encuentra', 'encontramos', 'encuentran']],
  ['mostrar', ['muestro', 'muestras', 'muestra', 'mostramos', 'muestran']],
  ['pedir', ['pido', 'pides', 'pide', 'pedimos', 'piden']],
  ['vestir', ['visto', 'vistes', 'viste', 'vestimos', 'visten']],
  ['entender', ['entiendo', 'entiendes', 'entiende', 'entendemos', 'entienden']],
  ['volver', ['vuelvo', 'vuelves', 'vuelve', 'volvemos', 'vuelven']],
];

describe('conjugateSpanishPresent', () => {
  for (const [infinitive, forms] of PARADIGMS) {
    it(`conjugates ${infinitive} in every person`, () => {
      SPANISH_PERSONS.forEach((person, index) => {
        assert.equal(conjugateSpanishPresent(infinitive, person), forms[index], `${infinitive} ${person}`);
      });
    });
  }

  it('returns null for words that are not infinitives', () => {
    assert.equal(conjugateSpanishPresent('agua', '1s'), null);
    assert.equal(conjugateSpanishPresent('sí', '1s'), null);
    assert.equal(conjugateSpanishPresent('', '1s'), null);
  });

  it('is case-insensitive on input', () => {
    assert.equal(conjugateSpanishPresent('Querer', '1s'), 'quiero');
  });
});

describe('conjugateSpanishVerbPhrase', () => {
  it('conjugates only the head of a multi-word button', () => {
    assert.equal(conjugateSpanishVerbPhrase('ir a la escuela', '1s'), 'voy a la escuela');
    assert.equal(conjugateSpanishVerbPhrase('cepillar dientes', '3s'), 'cepilla dientes');
  });

  it('treats clitic-suffixed infinitives as reflexive', () => {
    assert.equal(conjugateSpanishVerbPhrase('sentarse', '1s'), 'me siento');
    assert.equal(conjugateSpanishVerbPhrase('pararse', '2s'), 'te paras');
    assert.equal(conjugateSpanishVerbPhrase('vestirme', '3s'), 'se viste');
    assert.equal(conjugateSpanishVerbPhrase('despertarse', '1p'), 'nos despertamos');
    assert.equal(conjugateSpanishVerbPhrase('irse', '3p'), 'se van');
  });

  it('keeps a leading capital', () => {
    assert.equal(conjugateSpanishVerbPhrase('Querer', '1s'), 'Quiero');
  });

  it('returns null when the head is not a verb', () => {
    assert.equal(conjugateSpanishVerbPhrase('otra vez', '1s'), null);
  });
});

describe('isKnownSpanishInfinitive', () => {
  it('knows board verbs without a part-of-speech hint', () => {
    for (const word of ['querer', 'beber', 'jugar', 'sentarse', 'vestirme', 'ir']) {
      assert.equal(isKnownSpanishInfinitive(word), true, word);
    }
  });

  it('does not mistake -ar/-er nouns for verbs', () => {
    for (const word of ['mujer', 'lugar', 'hogar', 'ayer', 'collar']) {
      assert.equal(isKnownSpanishInfinitive(word), false, word);
    }
  });
});

function agree(words: string[], options = {}): string {
  return applySpanishAgreement(words, options).words.join(' ');
}

describe('applySpanishAgreement — subject–verb', () => {
  it('yo + querer → quiero', () => {
    assert.equal(agree(['yo', 'querer']), 'yo quiero');
  });

  it('tú + ir → vas', () => {
    assert.equal(agree(['tú', 'ir']), 'tú vas');
  });

  it('nosotros + jugar → jugamos', () => {
    assert.equal(agree(['nosotros', 'jugar']), 'nosotros jugamos');
  });

  it('yo querer beber → yo quiero beber (second verb stays infinitive)', () => {
    const result = applySpanishAgreement(['yo', 'querer', 'beber']);
    assert.deepEqual(result.words, ['yo', 'quiero', 'beber']);
    assert.equal(result.changed, true);
  });

  const persons: Array<[string, string]> = [
    ['yo', 'tengo'],
    ['tú', 'tienes'],
    ['usted', 'tiene'],
    ['él', 'tiene'],
    ['ella', 'tiene'],
    ['nosotros', 'tenemos'],
    ['nosotras', 'tenemos'],
    ['ustedes', 'tienen'],
    ['ellos', 'tienen'],
    ['ellas', 'tienen'],
  ];
  for (const [pronoun, form] of persons) {
    it(`${pronoun} + tener → ${form}`, () => {
      assert.equal(agree([pronoun, 'tener']), `${pronoun} ${form}`);
    });
  }

  it('lets negation and frequency adverbs sit between subject and verb', () => {
    assert.equal(agree(['yo', 'no', 'querer']), 'yo no quiero');
    assert.equal(agree(['ella', 'también', 'ir']), 'ella también va');
    assert.equal(agree(['nosotros', 'ya', 'terminar']), 'nosotros ya terminamos');
  });

  it('conjugates the head of a multi-word verb button', () => {
    assert.equal(agree(['yo', 'ir a la escuela']), 'yo voy a la escuela');
  });

  it('places the reflexive clitic before the verb, after negation', () => {
    assert.equal(agree(['ella', 'sentarse']), 'ella se sienta');
    assert.equal(agree(['yo', 'no', 'vestirme']), 'yo no me visto');
  });

  it('turns sentir + descriptor into sentirse', () => {
    assert.equal(agree(['yo', 'sentir', 'feliz']), 'yo me siento feliz');
    assert.equal(agree(['yo', 'sentir', 'frío']), 'yo me siento frío');
  });

  it('a new pronoun starts a new clause', () => {
    assert.equal(agree(['yo', 'querer', 'tú', 'venir']), 'yo quiero tú vienes');
  });

  it('leaves the message unchanged without a subject pronoun (pro-drop is not guessed)', () => {
    const result = applySpanishAgreement(['querer', 'agua']);
    assert.deepEqual(result.words, ['querer', 'agua']);
    assert.equal(result.changed, false);
  });

  it('leaves unknown verbs unchanged', () => {
    const result = applySpanishAgreement(['yo', 'zorglar']);
    assert.deepEqual(result.words, ['yo', 'zorglar']);
    assert.equal(result.changed, false);
  });

  it('conjugates an unknown regular verb only when the board marks it as a verb', () => {
    const isVerb = (word: string) => word === 'patinar';
    assert.equal(agree(['yo', 'patinar'], { isVerb }), 'yo patino');
    assert.equal(agree(['yo', 'patinar']), 'yo patinar');
  });

  it('never conjugates a noun that looks like an infinitive', () => {
    assert.equal(agree(['yo', 'mujer']), 'yo mujer');
    assert.equal(agree(['yo', 'mujer'], { isVerb: () => false }), 'yo mujer');
  });

  it('does not touch words after a non-verb breaks the clause', () => {
    assert.equal(agree(['yo', 'agua', 'beber']), 'yo agua beber');
  });

  it('leaves already-conjugated words alone', () => {
    const result = applySpanishAgreement(['yo', 'quiero', 'beber']);
    assert.deepEqual(result.words, ['yo', 'quiero', 'beber']);
    assert.equal(result.changed, false);
  });

  it('does not mutate its input', () => {
    const input = ['yo', 'querer'];
    applySpanishAgreement(input);
    assert.deepEqual(input, ['yo', 'querer']);
  });

  it('handles empty messages', () => {
    assert.deepEqual(applySpanishAgreement([]), { words: [], changed: false });
  });
});

describe('applySpanishAgreement — gustar class', () => {
  it('yo gustar → me gusta', () => {
    assert.equal(agree(['yo', 'gustar', 'jugar']), 'me gusta jugar');
  });

  it('third persons keep who it is with "a …"', () => {
    assert.equal(agree(['ella', 'gustar']), 'a ella le gusta');
    assert.equal(agree(['ellos', 'no', 'gustar']), 'a ellos no les gusta');
  });

  it('negation stays before the clitic', () => {
    assert.equal(agree(['yo', 'no', 'gustar']), 'no me gusta');
    assert.equal(agree(['nosotros', 'gustar']), 'nos gusta');
    assert.equal(agree(['tú', 'gustar']), 'te gusta');
  });
});

describe('applySpanishAgreement — descriptors after a copula', () => {
  it('feminine subject', () => {
    assert.equal(agree(['ella', 'estar', 'cansado']), 'ella está cansada');
    assert.equal(agree(['ella', 'estar', 'muy', 'enojado']), 'ella está muy enojada');
  });

  it('plural subject', () => {
    assert.equal(agree(['nosotros', 'estar', 'feliz']), 'nosotros estamos felices');
    assert.equal(agree(['ellas', 'ser', 'pequeño']), 'ellas son pequeñas');
    assert.equal(agree(['ustedes', 'estar', 'triste']), 'ustedes están tristes');
  });

  it('yo/tú carry no gender, so the board form stays', () => {
    assert.equal(agree(['yo', 'estar', 'cansado']), 'yo estoy cansado');
  });

  it('does not inflect a descriptor that follows a non-copular verb', () => {
    assert.equal(agree(['ella', 'querer', 'pequeño']), 'ella quiere pequeño');
  });

  it('inflects descriptors the board marks as adjectives when they end in -o', () => {
    const isAdjective = (word: string) => word === 'peludo';
    assert.equal(agree(['ella', 'estar', 'peludo'], { isAdjective }), 'ella está peluda');
  });
});

describe('inflectSpanishDescriptor', () => {
  const cases: Array<[string, 'm' | 'f' | undefined, boolean, string]> = [
    ['cansado', 'f', false, 'cansada'],
    ['cansado', 'm', true, 'cansados'],
    ['cansado', 'f', true, 'cansadas'],
    ['feliz', 'f', true, 'felices'],
    ['triste', 'f', false, 'triste'],
    ['grande', undefined, true, 'grandes'],
    ['azul', 'm', true, 'azules'],
    ['frío', 'f', true, 'frías'],
    ['pequeño', undefined, false, 'pequeño'],
  ];
  for (const [word, gender, plural, expected] of cases) {
    it(`${word} (${gender ?? '-'}, ${plural ? 'pl' : 'sg'}) → ${expected}`, () => {
      assert.equal(inflectSpanishDescriptor(word, gender, plural), expected);
    });
  }
});

// Guard: every person key is covered by every paradigm row above.
describe('paradigm coverage', () => {
  it('lists five persons', () => {
    const persons: SpanishPerson[] = ['1s', '2s', '3s', '1p', '3p'];
    assert.deepEqual([...SPANISH_PERSONS], persons);
  });
});
