#!/usr/bin/env node
/**
 * Rebuilds packages/symbols/src/mulberry-index.json from an upstream Mulberry
 * Symbols checkout plus the hand-curated Spanish keyword list.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/mulberrysymbols/mulberry-symbols /tmp/mulberry
 *   node packages/symbols/scripts/build-mulberry-index.mjs /tmp/mulberry
 *
 * Inputs (all read-only):
 *   <checkout>/scripts/data/symbol-info.csv  English + French names, category, tags
 *   <checkout>/EN/*.svg                      the symbol files (must match the CSV)
 *   <checkout>/package.json                  upstream version
 *   packages/symbols/data/mulberry-es.tsv    Spanish keywords (pending SLP review)
 *
 * The script fails loudly when the CSV and the SVG directory disagree, when a
 * Spanish entry names a file that does not exist, or when two files map to the
 * same slug. It never translates anything: Spanish comes only from the TSV.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const outFile = path.join(packageRoot, 'src', 'mulberry-index.json');
const esFile = path.join(packageRoot, 'data', 'mulberry-es.tsv');

const checkout = process.argv[2];
if (!checkout) {
  console.error('usage: build-mulberry-index.mjs <path-to-mulberry-symbols-checkout>');
  process.exit(2);
}

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] ?? '') !== '');
}

/**
 * URL-safe, lowercase slug from an upstream file stem. The verb marker "_,_"
 * becomes "--" so "close_,_to" (verb) and "close_to" (position) stay distinct.
 */
function slugify(stem) {
  return stem
    .toLowerCase()
    .replace(/_,_/g, '\u0000')
    .replace(/[^a-z0-9\u0000]+/g, '-')
    .replace(/\u0000/g, '--')
    .replace(/^-+|-+$/g, '');
}

/**
 * Keywords from an upstream display name. Mulberry names encode variants
 * ("eat_1_,_to", "teacher_1a", "hat_-_ladies"); the base word is the first
 * keyword, the full phrase the second when it differs.
 */
function keywordsFromName(name) {
  const phrase = name
    .replace(/_,_/g, ', ')
    .replace(/_-_/g, ' - ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const [head, ...rest] = phrase.split(',').map((part) => part.trim());
  const base = (head ?? '')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+\d+[a-z]?$/u, '')
    .trim();
  const out = [];
  if (base) out.push(base);
  const suffix = rest.join(' ').trim();
  if (suffix === 'to' || suffix === 'à') {
    // Verb marker: "want, to" -> "want", "to want".
    if (base) out.push(`${suffix} ${base}`);
  } else if (suffix && base) {
    // Inverted phrase: "toilet, go to the" -> "go to the toilet".
    out.push(`${suffix} ${base}`);
  }
  return out;
}

/**
 * Upstream French names are partly untranslated or shifted ("eat", "à eat",
 * "proche de" on the verb "close"). Keep only the base form, and drop it when
 * it is identical to an English keyword (not a translation).
 */
function frenchKeywords(name, stem) {
  const [base] = keywordsFromName(name);
  if (!base) return [];
  return keywordsFromName(stem).includes(base) ? [] : [base];
}

function readSpanish() {
  const map = new Map();
  const lines = readFileSync(esFile, 'utf8').split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [stem, words, extra] = trimmed.split('\t');
    if (!stem || !words || extra !== undefined) {
      throw new Error(`${path.basename(esFile)}:${index + 1}: expected "<stem>\\t<kw>|<kw>"`);
    }
    if (map.has(stem)) {
      throw new Error(`${path.basename(esFile)}:${index + 1}: duplicate entry for ${stem}`);
    }
    const keywords = words
      .split('|')
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean);
    map.set(stem, keywords);
  });
  return map;
}

function upstreamCommit() {
  try {
    return execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const csvRows = parseCsv(readFileSync(path.join(checkout, 'scripts', 'data', 'symbol-info.csv'), 'utf8'));
const header = csvRows.shift();
const col = (name) => {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`symbol-info.csv: missing column ${name}`);
  return index;
};
const C = {
  grammar: col('grammar'),
  rated: col('rated'),
  tags: col('tags'),
  en: col('symbol-en'),
  category: col('category-en'),
  fr: col('symbol-fr'),
};

const svgStems = new Set(
  readdirSync(path.join(checkout, 'EN'))
    .filter((name) => name.endsWith('.svg'))
    .map((name) => name.slice(0, -4)),
);
const spanish = readSpanish();
const csvStems = new Set(csvRows.map((row) => row[C.en]));

const missingFiles = [...csvStems].filter((stem) => !svgStems.has(stem));
const unindexed = [...svgStems].filter((stem) => !csvStems.has(stem));
const unknownSpanish = [...spanish.keys()].filter((stem) => !svgStems.has(stem));
if (missingFiles.length || unindexed.length || unknownSpanish.length) {
  throw new Error(
    `upstream mismatch: csv-without-svg=${missingFiles.join(',')} svg-without-csv=${unindexed.join(',')} es-unknown=${unknownSpanish.join(',')}`,
  );
}

const slugs = new Map();
const symbols = csvRows
  .map((row) => {
    const stem = row[C.en];
    const slug = slugify(stem);
    if (slugs.has(slug)) throw new Error(`slug collision: ${stem} and ${slugs.get(slug)} -> ${slug}`);
    slugs.set(slug, stem);
    const tags = (row[C.tags] ?? '')
      .split(/\s+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
    const entry = {
      slug,
      file: `EN/${stem}.svg`,
      category: row[C.category] ?? '',
      en: keywordsFromName(stem),
      es: spanish.get(stem) ?? [],
      fr: frenchKeywords(row[C.fr] ?? '', stem),
    };
    if (tags.length) entry.tags = tags;
    if (row[C.rated] === '1') entry.rated = true;
    return entry;
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

const upstreamPackage = JSON.parse(readFileSync(path.join(checkout, 'package.json'), 'utf8'));
const meta = {
  generatedBy: 'packages/symbols/scripts/build-mulberry-index.mjs',
  upstream: 'https://github.com/mulberrysymbols/mulberry-symbols',
  upstreamVersion: upstreamPackage.version ?? 'unknown',
  upstreamCommit: upstreamCommit(),
  licence: 'Mulberry Symbols © Steve Lee, CC BY-SA 4.0 (symbols, English/French names and categories)',
  spanish:
    'packages/symbols/data/mulberry-es.tsv — hand-curated, pending review by a credentialed SLP',
  frenchNote: 'French keywords are upstream symbol-info.csv names, unreviewed',
  count: symbols.length,
  spanishCount: symbols.filter((symbol) => symbol.es.length > 0).length,
};

// One symbol per line keeps diffs reviewable without inflating the file.
const body = symbols.map((symbol) => `    ${JSON.stringify(symbol)}`).join(',\n');
writeFileSync(outFile, `{\n  "meta": ${JSON.stringify(meta)},\n  "symbols": [\n${body}\n  ]\n}\n`);
console.log(`wrote ${path.relative(process.cwd(), outFile)}: ${meta.count} symbols, ${meta.spanishCount} with Spanish`);
