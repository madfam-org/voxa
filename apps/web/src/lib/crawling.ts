/**
 * Crawling policy (robots.txt, sitemap.xml, llms.txt), host-aware.
 *
 * Only the hosts listed in `VOXA_INDEXABLE_HOSTS` (comma-separated, set on the
 * production landing deployment) are crawlable, and only on public paths. Every
 * other host (the app host, staging, local) answers `Disallow: /` and has no
 * sitemap or llms.txt. Unset means nothing is indexable: the policy fails
 * closed.
 *
 * AI crawlers named below are allowed on the public landing pages by policy;
 * the app, auth and API paths are disallowed for every crawler.
 */

import { DEFAULT_UI_LOCALE, UI_LOCALES } from '@voxa/i18n';

export const ALLOWED_AI_CRAWLERS = [
  'ClaudeBot',
  'anthropic-ai',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
] as const;

/** Public pages, without locale prefix. Each exists under `app/[locale]/`. */
export const PUBLIC_PAGES = [
  '/',
  '/demo',
  '/legal/privacy',
  '/legal/terms',
  '/legal/accessibility',
  '/legal/symbols',
] as const;

/** Path prefixes crawlers may read (each also under every non-default locale). */
const ALLOWED_PREFIXES = ['/demo', '/legal/'] as const;

const DISALLOWED_PREFIXES = ['/app', '/auth', '/api'] as const;

/** Lower-cased host without port, or '' when absent. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return '';
  const first = host.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('[')) return first.slice(0, first.indexOf(']') + 1);
  return first.replace(/:\d+$/, '');
}

export function parseIndexableHosts(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((h) => normalizeHost(h))
    .filter(Boolean);
}

export function isIndexableHost(host: string | null | undefined, indexableHosts: string[]): boolean {
  const normalized = normalizeHost(host);
  return normalized !== '' && indexableHosts.includes(normalized);
}

function localizedPath(locale: string, page: string): string {
  if (locale === DEFAULT_UI_LOCALE) return page;
  return page === '/' ? `/${locale}` : `/${locale}${page}`;
}

const NON_DEFAULT_LOCALES = UI_LOCALES.filter((l) => l !== DEFAULT_UI_LOCALE);

function disallowLines(): string[] {
  const lines: string[] = [];
  for (const prefix of DISALLOWED_PREFIXES) {
    lines.push(`Disallow: ${prefix}`);
    for (const locale of NON_DEFAULT_LOCALES) lines.push(`Disallow: /${locale}${prefix}`);
  }
  return lines;
}

function allowLines(): string[] {
  const lines = ['Allow: /$'];
  for (const locale of NON_DEFAULT_LOCALES) lines.push(`Allow: /${locale}$`);
  for (const prefix of ALLOWED_PREFIXES) {
    lines.push(`Allow: ${prefix}`);
    for (const locale of NON_DEFAULT_LOCALES) lines.push(`Allow: /${locale}${prefix}`);
  }
  return lines;
}

export function buildRobotsTxt(origin: string, indexable: boolean): string {
  if (!indexable) {
    return ['# Not a public landing host: nothing here is for crawlers.', 'User-agent: *', 'Disallow: /', ''].join('\n');
  }
  const rules = [...allowLines(), ...disallowLines()];
  const groups: string[] = [];
  for (const agent of ALLOWED_AI_CRAWLERS) {
    groups.push(`User-agent: ${agent}`, ...rules, '');
  }
  // Everything else: same public paths, nothing behind sign-in.
  groups.push('User-agent: *', ...rules, '');
  return [
    '# Voxa public landing. The app, sign-in and API are not for crawlers.',
    '',
    ...groups,
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildSitemapXml(origin: string): string {
  const urls = PUBLIC_PAGES.map((page) => {
    const alternates = UI_LOCALES.map(
      (locale) =>
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(`${origin}${localizedPath(locale, page)}`)}"/>`,
    );
    alternates.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${origin}${page}`)}"/>`,
    );
    return ['  <url>', `    <loc>${escapeXml(`${origin}${page}`)}</loc>`, ...alternates, '  </url>'].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

const REPOSITORY = 'https://github.com/madfam-org/voxa';

/**
 * The canonical one-liner (registry tagline and value proposition), word for
 * word as in README.md, AGENTS.md, the repository llms.txt and the
 * `description` of the root and web package.json; crawling.test.ts fails when
 * they drift apart.
 */
export const PRODUCT_ONE_LINER =
  'Augmentative & alternative communication. A Spanish-first communication board that turns direct touch, switch scanning or pointer dwell into speech with the device voice you choose (es-MX first); core boards in 24, 36 and 60 cells on one stable motor plan, offline use after the first visit, and Open Board Format (OBF/OBZ) exchange — at home, in therapy, and in class.';

/** One-paragraph summary shared by llms.txt and llms-full.txt: the one-liner, then the README's second sentence. */
const SUMMARY = `> ${PRODUCT_ONE_LINER} Voxa is open source (Apache-2.0); its interface is also in English and French. Built by MADFAM.`;

function pageLines(origin: string): string[] {
  return [
    `- [Home](${origin}/): what Voxa is, plans and how to book a call.`,
    `- [Demo](${origin}/demo): try a board without an account.`,
    `- [Privacy](${origin}/legal/privacy)`,
    `- [Terms](${origin}/legal/terms)`,
    `- [Accessibility](${origin}/legal/accessibility)`,
    `- [Symbol credits](${origin}/legal/symbols)`,
    `- English: ${origin}/en · French: ${origin}/fr`,
  ];
}

/**
 * llms.txt for the landing host. Describes only what the product does today
 * (docs/capabilities.md is the source of truth); keep it in step with the
 * landing copy (packages/i18n/messages/*.json). Never links the app or API.
 */
export function buildLlmsTxt(origin: string): string {
  return [
    '# Voxa',
    '',
    SUMMARY,
    '',
    '## What it does today',
    '',
    '- Web communication board with symbol and text buttons, a message bar and speech through the voices installed on the device: choose the voice per language and adjust rate, pitch and volume.',
    '- Core boards in 24, 36 and 60 cells that keep one motor plan (a word keeps its place when the board grows), Core 47 and Core 100, a literacy keyboard and visual schedules. A short first-run setup builds the first board.',
    '- Spanish agreement as the message is built ("yo querer beber" becomes "yo quiero beber"), with a base-form toggle.',
    '- Access methods: touch (on press or on release), keyguard, switch scanning with one or two switches (linear, row, column and quadrant, with a way back out of every group), pointer dwell for head pointers and other devices that move the pointer, and moving buttons in the editor without dragging.',
    '- Symbols from Mulberry Symbols (CC BY-SA 4.0) with a symbol search in Spanish, English and French; a button without a matching symbol shows its label.',
    '- Keeps working through network drops: edits are saved when the connection returns, and the app opens offline on a device where it was opened before.',
    '- Open Board Format 0.1 import and export (.obf and .obz); imports always create new boards.',
    '- Basic word suggestions computed by Voxa itself (no third-party AI service), only for people who turn them on. Usage logging keeps counts only.',
    '',
    '## Not available yet',
    '',
    '- App store apps (the web app runs on phones, tablets and computers), natural child voices, and integration with eye-tracker hardware.',
    '- Clinical review: the Spanish vocabulary and language rules are pending review by a credentialed speech-language pathologist.',
    '',
    '## Pages',
    '',
    ...pageLines(origin),
    `- [Full description](${origin}/llms-full.txt): every capability with its status.`,
    '',
    '## Source',
    '',
    `- [Repository](${REPOSITORY})`,
    `- [Capabilities with status and evidence](${REPOSITORY}/blob/main/docs/capabilities.md)`,
    '',
  ].join('\n');
}

/**
 * llms-full.txt for the landing host: the capability list in more detail, with
 * a status per line. Same rules as llms.txt: only what ships, no app or API
 * host, no prices; keep it in step with docs/capabilities.md.
 */
export function buildLlmsFullTxt(origin: string): string {
  return [
    '# Voxa — full description',
    '',
    SUMMARY,
    '',
    'Status words: "shipped" is live and tested; "partial" works with the stated limit or is built but switched off; "not yet" is not available.',
    '',
    '## Clinical review',
    '',
    'The Spanish core vocabulary, the core board order, the Spanish symbol keywords, the Spanish suggestion table and the Spanish agreement rules were written by the project from standard Mexican Spanish usage. No credentialed speech-language pathologist has reviewed them yet; the app says "pending clinical review" where it applies.',
    '',
    '## Communication board',
    '',
    '- Shipped: board app for signed-in users and a public demo without an account; symbol and text buttons, a message bar and a Speak button.',
    '- Shipped: templates Core 47 (6×8, locked core slots), Core 100 (10×10), a literacy keyboard (with á é í ó ú ü ñ ¿ ¡ on Spanish boards) and visual schedules.',
    '- Shipped: core boards in 24 (4×6), 36 (6×6) and 60 (6×10) cells built from one ordered word list; each size is the top-left block of the next, so growing a board never moves a learned word.',
    '- Shipped: a first-run setup, once per person and device: board language, access method, grid size with a live preview, and voice. Every step can be skipped.',
    '- Shipped: motor-plan locks; only an organization admin can override one.',
    '- Shipped: several boards per account, hidden buttons and babble mode, hide labels or symbols, and building a message without speaking.',
    '- Shipped: Gestalt language (GLP) phrase buttons, recorded speech per button and GLP video in a visible, closable dialog.',
    '- Shipped: usage report per board (counts only, with consent) and a board audit log.',
    '',
    '## Speech and voices',
    '',
    '- Shipped (web): speaks with the voices installed on the device, always in the board language (es-MX first); choose the voice per language, adjust rate, pitch and volume, preview it, and get install steps when the device has no voice for the language.',
    '- Not yet: natural child voices, licensed or cloud voices, voice choice in the mobile app.',
    '',
    '## Spanish',
    '',
    '- Shipped: Spanish is the default interface language; English and French are complete.',
    '- Shipped (present tense): Spanish agreement as the message is built, including reflexive verbs, gustar, and gender and number after ser and estar; a base-form toggle and a setting keep the words as tapped.',
    '- Not yet: past tense and subjunctive; mixing two languages in one message.',
    '',
    '## Access methods',
    '',
    '- Shipped: touch on press or on release, scalable targets, and a keyguard that blocks touches between or around buttons.',
    '- Shipped: switch scanning with one switch (auto scan) or two (step scan); linear, row, column and quadrant scans; a Back position and an automatic return so a group never traps the user; first-item hold, acceptance time, pause after selection, spoken and beep cues; switches that act as a keyboard and gamepad buttons.',
    '- Shipped: pointer dwell from 0.5 to 3 seconds, for head pointers and other devices that move the pointer.',
    '- Partial (experimental): a gaze event bridge for integrators who already have gaze coordinates.',
    '- Not yet: integration with eye-tracker hardware or vendor kits.',
    '- Shipped: moving buttons in the editor without dragging (Move, then tap the destination; or arrow keys).',
    '',
    '## Symbols',
    '',
    '- Shipped: the full Mulberry Symbols set (3,436 symbols, CC BY-SA 4.0) served by Voxa, with a search in Spanish, English and French that needs no third-party service; Spanish keywords cover 450 symbols.',
    '- Shipped: core words show a symbol only where the picture matches the word in all three languages, otherwise their label; your own photos on buttons.',
    '- Not yet: generated symbols.',
    '',
    '## Network drops and offline',
    '',
    '- Shipped: the open board keeps working when the network drops; edits are queued on the device and saved when the connection returns.',
    '- Shipped: after one visit with a connection, the app opens offline on that device with the boards already loaded. A recording that cannot load is spoken with the device voice instead.',
    '',
    '## Open Board Format',
    '',
    '- Shipped: Open Board Format 0.1 export and import (.obf boards and .obz packages with linked boards, pictures and sounds); a Voxa to OBF to Voxa round trip is exact; exported symbols carry their licence.',
    '- Shipped: imports always create new boards and never change the open board; unsafe archives are refused; pictures at other web addresses are not downloaded.',
    '- Partial (beta): imports the words of one page from three other AAC apps\' files.',
    '',
    '## Team sync',
    '',
    '- Shipped: boards saved to the cloud and opened on any signed-in device; when two people save the same version, one save wins and the other is told, so nothing is overwritten silently.',
    '- Shipped: roles (communicator, editor, admin) come from the person\'s MADFAM account and are limited to their organization.',
    '- Shipped: live updates between devices while a board is open.',
    '- Shipped: sign-in with the MADFAM account, with "switch account" and "sign in as someone else" for shared tablets; signing out or switching clears the previous account\'s boards and pending changes from the device.',
    '- Not yet: inviting a care team from inside Voxa.',
    '',
    '## Privacy and consent',
    '',
    '- Shipped: two separate choices, word suggestions and usage counts, stored per person; nothing is sent while undecided.',
    '- Shipped: usage logging keeps counts only, never what was said; a board owner can delete a board\'s usage history.',
    '- Shipped (off): spoken text could be kept only for an organization with a data-processing agreement and a separate opt-in, for 90 days; no organization is enabled.',
    '',
    '## Word suggestions',
    '',
    '- Shipped: basic word suggestions in Spanish and English from Voxa\'s own rule-based predictor, only with consent; no third-party AI service is called.',
    '- Partial (switched off): model suggestions through MADFAM\'s own gateway, sending only the current partial message, to local models only.',
    '- Not yet: suggestions learned from a person\'s history, next-symbol prediction.',
    '',
    '## Accessibility',
    '',
    '- Shipped: automated accessibility checks (axe) on every change, on the public pages, the editor, the board app in all four themes, the Spanish pages, the voice settings and every first-run step; serious findings block the change.',
    '- Not yet: an external accessibility audit.',
    '',
    '## Where it runs',
    '',
    '- Shipped: the web app in current browsers on phones, tablets and computers, installable to the home screen.',
    '- Partial: a native app for iOS and Android that builds in CI; not in the app stores yet.',
    '',
    '## Pages',
    '',
    ...pageLines(origin),
    '',
    '## Source and documentation',
    '',
    `- [Repository](${REPOSITORY}) (Apache-2.0; symbols CC BY-SA 4.0)`,
    `- [Capabilities with status and evidence](${REPOSITORY}/blob/main/docs/capabilities.md)`,
    `- [Accessibility standards](${REPOSITORY}/blob/main/docs/accessibility.md)`,
    `- [Linguistic framework](${REPOSITORY}/blob/main/docs/linguistic-framework.md)`,
    `- [Open Board Format migration guide](${REPOSITORY}/blob/main/docs/launch/MIGRATION.md)`,
    '- [Open Board Format specification](https://www.openboardformat.org/docs)',
    '- [Mulberry Symbols](https://mulberrysymbols.org)',
    '',
  ].join('\n');
}
