import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALLOWED_AI_CRAWLERS,
  PUBLIC_PAGES,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
  isIndexableHost,
  normalizeHost,
  parseIndexableHosts,
} from './crawling';

const LANDING = 'https://landing.example.test';

describe('indexable host logic', () => {
  const hosts = parseIndexableHosts(' Landing.Example.Test , ,');

  it('parses a comma list, lower-cased, ignoring blanks', () => {
    assert.deepEqual(hosts, ['landing.example.test']);
  });

  it('matches the landing host with or without a port', () => {
    assert.equal(isIndexableHost('landing.example.test', hosts), true);
    assert.equal(isIndexableHost('LANDING.example.test:443', hosts), true);
  });

  it('treats every other host, a missing host and an unset list as not indexable', () => {
    assert.equal(isIndexableHost('app.example.test', hosts), false);
    assert.equal(isIndexableHost('staging-landing.example.test', hosts), false);
    assert.equal(isIndexableHost(null, hosts), false);
    assert.equal(isIndexableHost('landing.example.test', parseIndexableHosts(undefined)), false);
  });

  it('normalizes ipv6 and comma-joined host values', () => {
    assert.equal(normalizeHost('[::1]:3000'), '[::1]');
    assert.equal(normalizeHost('a.example.test, b.example.test'), 'a.example.test');
  });
});

describe('robots.txt', () => {
  it('disallows everything on a non-landing host, with no sitemap', () => {
    const body = buildRobotsTxt('', false);
    assert.match(body, /^User-agent: \*$/m);
    assert.match(body, /^Disallow: \/$/m);
    assert.doesNotMatch(body, /Allow: |Sitemap:/);
  });

  it('names each allowed AI crawler on the landing host', () => {
    const body = buildRobotsTxt(LANDING, true);
    assert.equal(ALLOWED_AI_CRAWLERS.length, 9);
    for (const bot of ALLOWED_AI_CRAWLERS) {
      assert.match(body, new RegExp(`^User-agent: ${bot}$`, 'm'));
    }
    assert.match(body, /^User-agent: ClaudeBot$/m);
  });

  it('allows public pages in every locale and disallows app, auth and api', () => {
    const body = buildRobotsTxt(LANDING, true);
    for (const line of ['Allow: /$', 'Allow: /en$', 'Allow: /fr$', 'Allow: /demo', 'Allow: /en/demo', 'Allow: /legal/', 'Allow: /fr/legal/']) {
      assert.ok(body.includes(`${line}\n`), line);
    }
    for (const line of ['Disallow: /app', 'Disallow: /auth', 'Disallow: /api', 'Disallow: /en/app', 'Disallow: /fr/auth']) {
      assert.ok(body.includes(`${line}\n`), line);
    }
    assert.doesNotMatch(body, /^Disallow: \/$/m);
    assert.match(body, /^Sitemap: https:\/\/landing\.example\.test\/sitemap\.xml$/m);
  });
});

describe('sitemap.xml', () => {
  const xml = buildSitemapXml(LANDING);

  it('lists each public page once with es, en, fr and x-default alternates', () => {
    assert.equal((xml.match(/<url>/g) ?? []).length, PUBLIC_PAGES.length);
    assert.ok(xml.includes(`<loc>${LANDING}/demo</loc>`));
    assert.ok(xml.includes(`hreflang="es" href="${LANDING}/demo"`));
    assert.ok(xml.includes(`hreflang="en" href="${LANDING}/en/demo"`));
    assert.ok(xml.includes(`hreflang="fr" href="${LANDING}/fr"`));
    assert.ok(xml.includes(`hreflang="x-default" href="${LANDING}/legal/terms"`));
    assert.ok(xml.includes(`<loc>${LANDING}/legal/symbols</loc>`));
  });

  it('lists nothing behind sign-in', () => {
    assert.doesNotMatch(xml, /\/app|\/auth|\/api/);
  });
});

// Claims the product cannot back today. Offline start shipped in voxa#32, so
// only "offline-ready" stays banned, as in the claims stop-list.
const UNBACKED_CLAIMS = [
  /SLA/i,
  /offline[- ]ready/i,
  /eye[- ]?(gaze|tracking|dwell)/i,
  /tobii/i,
  /neural/i,
  /GPT|OpenAI/i,
  /WCAG/i,
  /ARASAAC/i,
  /\$|MXN|precio|price/i,
  /reviewed by|SLP sign-off|clinically (reviewed|validated)/i,
];

describe('llms.txt', () => {
  const body = buildLlmsTxt(LANDING);

  it('describes the product and links the public pages on the given origin', () => {
    assert.match(body, /^# Voxa$/m);
    assert.ok(body.includes(`(${LANDING}/demo)`));
    assert.ok(body.includes(`(${LANDING}/llms-full.txt)`));
  });

  it('makes none of the claims the product cannot back today', () => {
    for (const claim of UNBACKED_CLAIMS) {
      assert.doesNotMatch(body, claim);
    }
  });

  it('says the clinical review is pending', () => {
    assert.match(body, /pending review by a credentialed speech-language pathologist/);
  });

  it('links nothing behind sign-in and no other host of the product', () => {
    assert.doesNotMatch(body, /\/app\b|\/auth\b|\/api\b|voxa-app|voxa-api/);
  });
});

describe('llms-full.txt', () => {
  const body = buildLlmsFullTxt(LANDING);

  it('describes every capability area with a status and links the public pages', () => {
    assert.match(body, /^# Voxa — full description$/m);
    for (const heading of ['Clinical review', 'Access methods', 'Symbols', 'Open Board Format', 'Privacy and consent', 'Accessibility']) {
      assert.match(body, new RegExp(`^## ${heading}$`, 'm'), heading);
    }
    // Read-proof: a stub must not pass as "no claims found".
    assert.ok((body.match(/^- (Shipped|Partial|Not yet)/gm) ?? []).length >= 30);
    assert.ok(body.includes(`(${LANDING}/demo)`));
  });

  it('makes none of the claims the product cannot back today', () => {
    for (const claim of UNBACKED_CLAIMS) {
      assert.doesNotMatch(body, claim);
    }
  });

  it('links nothing behind sign-in and no other host of the product', () => {
    assert.doesNotMatch(body, /\/app\b|\/auth\b|\/api\b|voxa-app|voxa-api/);
  });
});
