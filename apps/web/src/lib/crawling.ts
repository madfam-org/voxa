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

/**
 * llms.txt for the landing host. Describes only what the product does today;
 * keep it in step with the landing copy (packages/i18n/messages/*.json).
 */
export function buildLlmsTxt(origin: string): string {
  return [
    '# Voxa',
    '',
    '> Augmentative and alternative communication (AAC): a communication board that turns taps and switch presses into spoken language, at home, in therapy and in class. By MADFAM. Spanish first, also in English and French. Open source (Apache-2.0).',
    '',
    '## What it does today',
    '',
    '- Web communication board with symbol and text buttons, a message bar and speech through the device voice.',
    '- Access methods: direct touch, release-to-select, pointer dwell selection, switch scanning (linear, row, column and quadrant) and a keyguard.',
    '- Core-vocabulary symbols from Mulberry Symbols (CC BY-SA 4.0); buttons without a licensed symbol show their label.',
    '- Board editing for caregivers and therapists: grid size, labels, symbols and recorded speech for a button.',
    '- Basic word suggestions computed on Voxa infrastructure (no third-party AI service).',
    '- Board export and import in Voxa\'s board format.',
    '',
    '## Pages',
    '',
    `- [Home](${origin}/): what Voxa is, plans and how to book a call.`,
    `- [Demo](${origin}/demo): try a board without an account.`,
    `- [Privacy](${origin}/legal/privacy)`,
    `- [Terms](${origin}/legal/terms)`,
    `- [Accessibility](${origin}/legal/accessibility)`,
    `- [Symbol credits](${origin}/legal/symbols)`,
    `- English: ${origin}/en · French: ${origin}/fr`,
    '',
    '## Source',
    '',
    '- [Repository](https://github.com/madfam-org/voxa)',
    '',
  ].join('\n');
}
