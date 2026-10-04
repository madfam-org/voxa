import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import en from '@voxa/i18n/messages/en';
import es from '@voxa/i18n/messages/es';
import fr from '@voxa/i18n/messages/fr';

// Stop-list for the public copy: claims with nothing behind them in code and
// a retired mailbox. Each entry was removed on purpose; if one comes back,
// ship the capability first (and then drop the entry here).
// The retired mailbox is assembled at runtime so that a repo-wide
// `git grep` for it stays at zero hits.
const RETIRED_MAILBOX = ['hello', 'madfam.io'].join('@');

const STOP_LIST: Array<{ label: string; pattern: RegExp }> = [
  { label: 'SLA (no service-level agreement exists)', pattern: /\bSLA\b/ },
  { label: 'priority sync', pattern: /Sincronizaci[oó]n prioritaria|Priority sync|Synchronisation prioritaire/i },
  { label: 'full AI tier', pattern: /IA completa|Full AI|IA compl[eè]te/i },
  {
    label: 'per-end-user usage dashboards',
    pattern: /Paneles de uso por usuario final|Usage dashboards by final user|Tableaux de bord d'usage par utilisateur/i,
  },
  { label: 'care-team / team-role invites', pattern: /Equipo de cuidado|care team|[ée]quipe de soins|roles de equipo|team roles|r[ôo]les d'[ée]quipe/i },
  { label: 'offline-ready', pattern: /Listo sin conexi[oó]n|Offline-ready|Pr[êe]t hors ligne/i },
  { label: 'centrally enforced AI policy', pattern: /de forma centralizada|enforced centrally|s'appliquer centralement/i },
  { label: 'speech therapists review releases', pattern: /revisi[oó]n manual de logopedas|SLP review|revue orthophoniste/i },
  {
    label: 'eye-tracker hardware integration (none exists; dwell works through the pointer or the gaze event bridge)',
    pattern: /Tobii|IrisBond|eye-dwell|permanencia ocular|fixation oculaire/i,
  },
  {
    // Gaze as an input of its own ("taps, switches, or gaze"; "dwell (eye
    // gaze, head pointer)"). What ships: pointer dwell, which an eye tracker
    // can drive when its own software moves the pointer, and the voxa:gaze
    // event bridge for integrators. Qualified mentions of both stay allowed.
    label: 'gaze as an input of its own (say pointer dwell, or the gaze event bridge for integrators)',
    pattern:
      /(?:switch(?:es)?|interruptor(?:es)?|interrupteurs?),?\s+(?:or|o|ou)\s+(?:(?:le|la|eye)\s+)?(?:gaze|mirada|regard)\b|\(\s*(?:eye\s+gaze|mirada|regard)\s*,/i,
  },
  {
    label: 'competitor product names in descriptive copy (describe the behaviour instead)',
    pattern: /Proloquo|Acapela|CoughDrop|Cboard/i,
  },
  { label: "Spain's term for speech therapists (es-MX copy says terapeutas de lenguaje)", pattern: /logoped/i },
  { label: 'retired mailbox', pattern: new RegExp(RETIRED_MAILBOX.replace('.', '\\.'), 'i') },
  { label: 'upgrade dead end', pattern: new RegExp(['upgrade', 'family'].join('='), 'i') },
];

function collectStrings(node: unknown, path: string, out: Array<{ path: string; value: string }>): void {
  if (typeof node === 'string') {
    out.push({ path, value: node });
  } else if (Array.isArray(node)) {
    node.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectStrings(value, path ? `${path}.${key}` : key, out);
    }
  }
}

const CATALOGS: Record<string, unknown> = { es, en, fr };

describe('i18n claims stop-list', () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale} catalog contains no stop-listed claim`, () => {
      const strings: Array<{ path: string; value: string }> = [];
      collectStrings(catalog, '', strings);
      // Read-proof: an empty catalog must not pass as "nothing found".
      assert.ok(strings.length > 300, `${locale}: expected >300 strings, read ${strings.length}`);

      const hits = strings.flatMap(({ path, value }) =>
        STOP_LIST.filter(({ pattern }) => pattern.test(value)).map(
          ({ label }) => `${locale}.${path}: ${label} -> ${JSON.stringify(value)}`,
        ),
      );
      assert.deepEqual(hits, []);
    });
  }

  it('the stop-list itself catches the removed strings', () => {
    for (const sample of [
      'Onboarding dedicado y SLA',
      'Sincronización prioritaria',
      'IA completa y flujos GLP',
      'Paneles de uso por usuario final',
      'Clásico claro (estilo Proloquo)',
      'editor para logopedas',
      'AAC apps turn taps, switches, or gaze into spoken language',
      'convierten toques, interruptores o mirada en lenguaje hablado',
      'transforment les touches, interrupteurs ou le regard en langage parlé',
      'Dwell selection (eye gaze, head pointer)',
      'Selección por permanencia (mirada, puntero de cabeza)',
      'Sélection par maintien (regard, pointeur de tête)',
      `mailto:${RETIRED_MAILBOX}`,
      '/app?' + ['upgrade', 'family'].join('='),
    ]) {
      assert.ok(
        STOP_LIST.some(({ pattern }) => pattern.test(sample)),
        `stop-list misses ${JSON.stringify(sample)}`,
      );
    }
  });
});
