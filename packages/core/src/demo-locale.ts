import type { Board, BoardButton } from './index.js';

export type DemoUiLocale = 'es' | 'en' | 'fr';

const CONTENT_LOCALE: Record<DemoUiLocale, string> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
};

const LABELS: Record<DemoUiLocale, Record<string, string>> = {
  es: {'i': 'yo', 'you': 'tú', 'want': 'querer', 'more': 'más', 'go': 'ir', 'stop': 'parar', 'help': 'ayuda', 'eat': 'comer', 'drink': 'beber', 'yes': 'sí', 'no': 'no', 'please': 'por favor', 'like': 'gustar', 'dont': 'no', 'different': 'diferente', 'again': 'otra vez', 'all-done': 'terminé', 'wait': 'esperar', 'look': 'mirar', 'listen': 'escuchar', 'come': 'venir', 'turn': 'girar', 'put': 'poner', 'get': 'obtener', 'make': 'hacer', 'do': 'hacer', 'see': 'ver', 'feel': 'sentir', 'good': 'bien', 'bad': 'mal', 'sorry': 'perdón', 'thank-you': 'gracias', 'me': 'yo', 'my': 'mi', 'it': 'eso', 'that': 'eso', 'this': 'esto', 'here': 'aquí', 'there': 'allí', 'up': 'arriba', 'down': 'abajo', 'in': 'dentro', 'out': 'fuera', 'on': 'encendido', 'off': 'apagado', 'home': 'casa', 'school': 'escuela', 'wake-up': 'despertar', 'get-dressed': 'vestirme', 'eat-breakfast': 'desayunar', 'brush-teeth': 'cepillar dientes', 'pack-backpack': 'empacar mochila', 'go-to-school': 'ir a la escuela'},
  en: {'i': 'i', 'you': 'you', 'want': 'want', 'more': 'more', 'go': 'go', 'stop': 'stop', 'help': 'help', 'eat': 'eat', 'drink': 'drink', 'yes': 'yes', 'no': 'no', 'please': 'please', 'like': 'like', 'dont': 'dont', 'different': 'different', 'again': 'again', 'all-done': 'all done', 'wait': 'wait', 'look': 'look', 'listen': 'listen', 'come': 'come', 'turn': 'turn', 'put': 'put', 'get': 'get', 'make': 'make', 'do': 'do', 'see': 'see', 'feel': 'feel', 'good': 'good', 'bad': 'bad', 'sorry': 'sorry', 'thank-you': 'thank you', 'me': 'me', 'my': 'my', 'it': 'it', 'that': 'that', 'this': 'this', 'here': 'here', 'there': 'there', 'up': 'up', 'down': 'down', 'in': 'in', 'out': 'out', 'on': 'on', 'off': 'off', 'home': 'home', 'school': 'school', 'wake-up': 'wake up', 'get-dressed': 'get dressed', 'eat-breakfast': 'eat breakfast', 'brush-teeth': 'brush teeth', 'pack-backpack': 'pack backpack', 'go-to-school': 'go to school'},
  fr: {'i': 'je', 'you': 'tu', 'want': 'vouloir', 'more': 'plus', 'go': 'aller', 'stop': 'stop', 'help': 'aide', 'eat': 'manger', 'drink': 'boire', 'yes': 'oui', 'no': 'non', 'please': "s'il vous plaît", 'like': 'aimer', 'dont': 'ne pas', 'different': 'différent', 'again': 'encore', 'all-done': 'terminé', 'wait': 'attendre', 'look': 'regarder', 'listen': 'écouter', 'come': 'venir', 'turn': 'tourner', 'put': 'mettre', 'get': 'prendre', 'make': 'faire', 'do': 'faire', 'see': 'voir', 'feel': 'sentir', 'good': 'bien', 'bad': 'mal', 'sorry': 'pardon', 'thank-you': 'merci', 'me': 'moi', 'my': 'mon', 'it': 'ça', 'that': 'ça', 'this': 'ceci', 'here': 'ici', 'there': 'là', 'up': 'haut', 'down': 'bas', 'in': 'dedans', 'out': 'dehors', 'on': 'allumé', 'off': 'éteint', 'home': 'maison', 'school': 'école', 'wake-up': 'se réveiller', 'get-dressed': "s'habiller", 'eat-breakfast': 'petit-déjeuner', 'brush-teeth': 'brosser dents', 'pack-backpack': 'préparer sac', 'go-to-school': "aller à l'école"},
};

export function demoContentLocale(locale: DemoUiLocale): string {
  return CONTENT_LOCALE[locale];
}

export function localizeDemoBoard(board: Board, locale: DemoUiLocale): Board {
  const map = LABELS[locale] ?? LABELS.es;
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

