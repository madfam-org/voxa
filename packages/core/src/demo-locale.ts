import type { Board, BoardButton } from './index.js';

export type DemoUiLocale = 'es' | 'en' | 'fr';

/** Content locales Voxa produces boards in (labels, speech text, TTS voice). */
export type StarterContentLocale = 'es-MX' | 'en-US' | 'fr-FR';

export const STARTER_CONTENT_LOCALES: readonly StarterContentLocale[] = ['es-MX', 'en-US', 'fr-FR'];

export function isStarterContentLocale(value: unknown): value is StarterContentLocale {
  return typeof value === 'string' && (STARTER_CONTENT_LOCALES as readonly string[]).includes(value);
}

const CONTENT_LOCALE: Record<DemoUiLocale, StarterContentLocale> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
};

const UI_FOR_CONTENT: Record<StarterContentLocale, DemoUiLocale> = {
  'es-MX': 'es',
  'en-US': 'en',
  'fr-FR': 'fr',
};

/**
 * Core 100 words beyond Core 47. Translations await review by a credentialed
 * speech-language pathologist, like the rest of this table.
 */
const CORE_100_EXTRA_LABELS: Record<Exclude<DemoUiLocale, 'en'>, Record<string, string>> = {
  es: {'play': 'jugar', 'read': 'leer', 'write': 'escribir', 'walk': 'caminar', 'run': 'correr', 'sit': 'sentarse', 'stand': 'pararse', 'open': 'abrir', 'close': 'cerrar', 'sleep': 'dormir', 'wash': 'lavar', 'bathroom': 'baño', 'food': 'comida', 'water': 'agua', 'milk': 'leche', 'snack': 'botana', 'mom': 'mamá', 'dad': 'papá', 'friend': 'amigo', 'teacher': 'maestro', 'happy': 'feliz', 'sad': 'triste', 'mad': 'enojado', 'scared': 'asustado', 'sick': 'enfermo', 'hurt': 'lastimado', 'big': 'grande', 'little': 'pequeño', 'hot': 'caliente', 'cold': 'frío', 'love': 'amar', 'hug': 'abrazar', 'share': 'compartir', 'ask': 'preguntar', 'tell': 'decir', 'show': 'mostrar', 'give': 'dar', 'take': 'tomar', 'find': 'encontrar', 'fix': 'arreglar', 'clean': 'limpiar', 'car': 'carro', 'work': 'trabajo', 'outside': 'afuera', 'inside': 'adentro', 'who': 'quién', 'what': 'qué', 'where': 'dónde', 'when': 'cuándo', 'why': 'por qué', 'how': 'cómo', 'because': 'porque', 'and': 'y'},
  fr: {'play': 'jouer', 'read': 'lire', 'write': 'écrire', 'walk': 'marcher', 'run': 'courir', 'sit': "s'asseoir", 'stand': 'se lever', 'open': 'ouvrir', 'close': 'fermer', 'sleep': 'dormir', 'wash': 'laver', 'bathroom': 'toilettes', 'food': 'nourriture', 'water': 'eau', 'milk': 'lait', 'snack': 'goûter', 'mom': 'maman', 'dad': 'papa', 'friend': 'ami', 'teacher': 'maître', 'happy': 'content', 'sad': 'triste', 'mad': 'fâché', 'scared': 'effrayé', 'sick': 'malade', 'hurt': 'blessé', 'big': 'grand', 'little': 'petit', 'hot': 'chaud', 'cold': 'froid', 'love': 'adorer', 'hug': 'câliner', 'share': 'partager', 'ask': 'demander', 'tell': 'dire', 'show': 'montrer', 'give': 'donner', 'take': 'prendre', 'find': 'trouver', 'fix': 'réparer', 'clean': 'nettoyer', 'car': 'voiture', 'work': 'travail', 'outside': "à l'extérieur", 'inside': "à l'intérieur", 'who': 'qui', 'what': 'quoi', 'where': 'où', 'when': 'quand', 'why': 'pourquoi', 'how': 'comment', 'because': 'parce que', 'and': 'et'},
};

const LABELS: Record<DemoUiLocale, Record<string, string>> = {
  es: {'i': 'yo', 'you': 'tú', 'want': 'querer', 'more': 'más', 'go': 'ir', 'stop': 'parar', 'help': 'ayuda', 'eat': 'comer', 'drink': 'beber', 'yes': 'sí', 'no': 'no', 'please': 'por favor', 'like': 'gustar', 'dont': 'no', 'different': 'diferente', 'again': 'otra vez', 'all-done': 'terminé', 'wait': 'esperar', 'look': 'mirar', 'listen': 'escuchar', 'come': 'venir', 'turn': 'girar', 'put': 'poner', 'get': 'obtener', 'make': 'hacer', 'do': 'hacer', 'see': 'ver', 'feel': 'sentir', 'good': 'bien', 'bad': 'mal', 'sorry': 'perdón', 'thank-you': 'gracias', 'me': 'yo', 'my': 'mi', 'it': 'eso', 'that': 'eso', 'this': 'esto', 'here': 'aquí', 'there': 'allí', 'up': 'arriba', 'down': 'abajo', 'in': 'dentro', 'out': 'fuera', 'on': 'encendido', 'off': 'apagado', 'home': 'casa', 'school': 'escuela', 'wake-up': 'despertar', 'get-dressed': 'vestirme', 'eat-breakfast': 'desayunar', 'brush-teeth': 'cepillar dientes', 'pack-backpack': 'empacar mochila', 'go-to-school': 'ir a la escuela'},
  en: {'i': 'I', 'you': 'you', 'want': 'want', 'more': 'more', 'go': 'go', 'stop': 'stop', 'help': 'help', 'eat': 'eat', 'drink': 'drink', 'yes': 'yes', 'no': 'no', 'please': 'please', 'like': 'like', 'dont': "don't", 'different': 'different', 'again': 'again', 'all-done': 'all done', 'wait': 'wait', 'look': 'look', 'listen': 'listen', 'come': 'come', 'turn': 'turn', 'put': 'put', 'get': 'get', 'make': 'make', 'do': 'do', 'see': 'see', 'feel': 'feel', 'good': 'good', 'bad': 'bad', 'sorry': 'sorry', 'thank-you': 'thank you', 'me': 'me', 'my': 'my', 'it': 'it', 'that': 'that', 'this': 'this', 'here': 'here', 'there': 'there', 'up': 'up', 'down': 'down', 'in': 'in', 'out': 'out', 'on': 'on', 'off': 'off', 'home': 'home', 'school': 'school', 'wake-up': 'wake up', 'get-dressed': 'get dressed', 'eat-breakfast': 'eat breakfast', 'brush-teeth': 'brush teeth', 'pack-backpack': 'pack backpack', 'go-to-school': 'go to school'},
  fr: {'i': 'je', 'you': 'tu', 'want': 'vouloir', 'more': 'plus', 'go': 'aller', 'stop': 'stop', 'help': 'aide', 'eat': 'manger', 'drink': 'boire', 'yes': 'oui', 'no': 'non', 'please': "s'il vous plaît", 'like': 'aimer', 'dont': 'ne pas', 'different': 'différent', 'again': 'encore', 'all-done': 'terminé', 'wait': 'attendre', 'look': 'regarder', 'listen': 'écouter', 'come': 'venir', 'turn': 'tourner', 'put': 'mettre', 'get': 'prendre', 'make': 'faire', 'do': 'faire', 'see': 'voir', 'feel': 'sentir', 'good': 'bien', 'bad': 'mal', 'sorry': 'pardon', 'thank-you': 'merci', 'me': 'moi', 'my': 'mon', 'it': 'ça', 'that': 'ça', 'this': 'ceci', 'here': 'ici', 'there': 'là', 'up': 'haut', 'down': 'bas', 'in': 'dedans', 'out': 'dehors', 'on': 'allumé', 'off': 'éteint', 'home': 'maison', 'school': 'école', 'wake-up': 'se réveiller', 'get-dressed': "s'habiller", 'eat-breakfast': 'petit-déjeuner', 'brush-teeth': 'brosser dents', 'pack-backpack': 'préparer sac', 'go-to-school': "aller à l'école"},
};

export function demoContentLocale(locale: DemoUiLocale): StarterContentLocale {
  return CONTENT_LOCALE[locale];
}

function labelsFor(locale: DemoUiLocale): Record<string, string> {
  if (locale === 'en') return LABELS.en;
  const base = LABELS[locale];
  const extra = CORE_100_EXTRA_LABELS[locale];
  if (!base || !extra) return labelsFor('es');
  return { ...base, ...extra };
}

/**
 * Produce a Voxa-built board (starter template or demo) in `locale`: labels
 * and speech text from the translation table, `locale` on every button.
 * `en-US` is the source vocabulary and is returned unchanged.
 */
export function localizeBoardContent(board: Board, locale: StarterContentLocale): Board {
  if (locale === 'en-US') return board;
  return localizeDemoBoard(board, UI_FOR_CONTENT[locale]);
}

export function localizeDemoBoard(board: Board, locale: DemoUiLocale): Board {
  const map = labelsFor(locale);
  return {
    ...board,
    grid: {
      ...board.grid,
      buttons: board.grid.buttons.map((button) => localizeButton(button, map, locale)),
    },
  };
}

function localizeButton(button: BoardButton, map: Record<string, string>, locale: DemoUiLocale): BoardButton {
  if (button.kind !== 'analytic') return button;
  const slug = String(button.id);
  const label = map[slug];
  if (!label) {
    return { ...button, locale: demoContentLocale(locale) };
  }
  return {
    ...button,
    label,
    speechText: label,
    locale: demoContentLocale(locale),
  };
}


/**
 * The content locale a board speaks in: the most common `locale` among its
 * buttons (ties go to the first seen). `undefined` for a board with no buttons.
 */
export function boardContentLocale(board: Pick<Board, 'grid'>): string | undefined {
  const counts = new Map<string, number>();
  for (const button of board.grid.buttons) {
    if (!button.locale) continue;
    counts.set(button.locale, (counts.get(button.locale) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [locale, count] of counts) {
    if (count > bestCount) {
      best = locale;
      bestCount = count;
    }
  }
  return best;
}
