/**
 * Guard: user-facing text in the web components comes from the message
 * catalogues (packages/i18n/messages/*.json), never from string literals, so
 * a Spanish page carries no English (WCAG 3.1.2 Language of Parts).
 *
 * A pragmatic AST scan over apps/web/src/components/**\/*.tsx. It flags:
 *   - JSX text nodes with words in them;
 *   - string literals in user-facing JSX attributes (aria-*, title, alt,
 *     placeholder, label) and in JSX child expressions;
 *   - window.prompt / window.alert / window.confirm (use AppDialog instead).
 * String literals passed as call arguments (t('key')) are message keys, not
 * text, and are ignored. Brand and format names live in ALLOWED_TEXT.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import en from '@voxa/i18n/messages/en';
import es from '@voxa/i18n/messages/es';
import fr from '@voxa/i18n/messages/fr';

const COMPONENTS_DIR = join(import.meta.dirname, 'components');

/** Text that is a name, not language: brand, product and file-format names. */
const ALLOWED_TEXT = new Set([
  'Voxa',
  'OBF',
  'OBZ',
  'Mulberry Symbols',
  'ARASAAC',
  'CC BY-SA 4.0',
  'CC BY-NC-SA 4.0',
  'MADFAM',
]);

/** Attributes whose value is read to the user (aria-live, aria-labelledby … are tokens, not text). */
const TEXT_ATTRIBUTES = new Set([
  'title',
  'alt',
  'placeholder',
  'label',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
]);

function hasWords(text: string): boolean {
  return /[A-Za-zÀ-ÿ]{2,}/.test(text);
}

function isAllowed(text: string): boolean {
  let rest = text.replace(/\s+/g, ' ').trim();
  // E-mail addresses and URLs are identifiers, not language.
  rest = rest.replace(/\S+@\S+\.\S+|https?:\/\/\S+/g, ' ');
  for (const allowed of ALLOWED_TEXT) rest = rest.split(allowed).join(' ');
  return !hasWords(rest);
}

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsx(full));
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

/** True when `node` sits in a call's argument list (a message key such as t('speak')). */
function isCallArgument(node: ts.Node): boolean {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isCallExpression(parent) && parent.arguments.some((arg) => arg === current)) return true;
    if (ts.isJsxAttribute(parent) || ts.isJsxExpression(parent) || ts.isSourceFile(parent)) return false;
    current = parent;
  }
  return false;
}

/** Literal text pieces inside an expression, skipping call arguments and comparisons. */
function literalTexts(expression: ts.Node): Array<{ node: ts.Node; text: string }> {
  const found: Array<{ node: ts.Node; text: string }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      const comparison =
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        op === ts.SyntaxKind.EqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsToken;
      if (comparison) return;
    }
    if (ts.isElementAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isCallArgument(node)) found.push({ node, text: node.text });
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
      found.push({ node, text: parts });
      node.templateSpans.forEach((span) => visit(span.expression));
      return;
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return;
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
}

export interface HardcodedText {
  file: string;
  line: number;
  kind: 'jsx-text' | 'attribute' | 'expression' | 'native-dialog';
  text: string;
}

export function findHardcodedText(file: string, source: string): HardcodedText[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: HardcodedText[] = [];
  const at = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (!isAllowed(node.text)) {
        hits.push({ file, line: at(node), kind: 'jsx-text', text: node.text.trim() });
      }
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (TEXT_ATTRIBUTES.has(name)) {
        const init = node.initializer;
        const pieces = ts.isStringLiteral(init)
          ? [{ node: init, text: init.text }]
          : ts.isJsxExpression(init) && init.expression
            ? literalTexts(init.expression)
            : [];
        for (const piece of pieces) {
          if (!isAllowed(piece.text)) hits.push({ file, line: at(piece.node), kind: 'attribute', text: piece.text });
        }
      }
    } else if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      for (const piece of literalTexts(node.expression)) {
        if (!isAllowed(piece.text)) hits.push({ file, line: at(piece.node), kind: 'expression', text: piece.text });
      }
    } else if (
      ts.isCallExpression(node) &&
      /^(window\.)?(prompt|alert|confirm)$/.test(node.expression.getText(sf))
    ) {
      hits.push({ file, line: at(node), kind: 'native-dialog', text: node.expression.getText(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('hardcoded UI text guard', () => {
  it('detects the patterns it is meant to catch', () => {
    const sample = [
      'export const A = () => (',
      '  <div aria-label="Communication board" title={ok ? "Locked" : t("x")}>',
      '    Tap buttons to build a message',
      '    {busy ? "Saving…" : t("save")}',
      '    {t("speak")} Voxa 🔒',
      '  </div>',
      ');',
      'window.alert("x"); confirm("y");',
    ].join('\n');
    const kinds = findHardcodedText('sample.tsx', sample).map((hit) => `${hit.kind}:${hit.text}`);
    assert.deepEqual(kinds, [
      'attribute:Communication board',
      'attribute:Locked',
      'jsx-text:Tap buttons to build a message',
      'expression:Saving…',
      'native-dialog:window.alert',
      'native-dialog:confirm',
    ]);
  });

  it('finds no hardcoded English in apps/web/src/components', () => {
    const files = listTsx(COMPONENTS_DIR);
    assert.ok(files.length > 20, `expected to scan the components folder, listed ${files.length}`);
    const hits = files.flatMap((file) =>
      findHardcodedText(relative(COMPONENTS_DIR, file), readFileSync(file, 'utf8')),
    );
    assert.deepEqual(
      hits.map((hit) => `${hit.file}:${hit.line} [${hit.kind}] ${hit.text}`),
      [],
      'move these strings into packages/i18n/messages/{es,en,fr}.json',
    );
  });
});

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !key.startsWith('_'))
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe('message catalogues', () => {
  it('es, en and fr carry the same keys', () => {
    const esKeys = flattenKeys(es).sort();
    assert.deepEqual(flattenKeys(en).sort(), esKeys);
    assert.deepEqual(flattenKeys(fr).sort(), esKeys);
  });

  it('the Spanish catalogue carries the linguistic-review note (ruling R89)', () => {
    assert.match(String((es as Record<string, unknown>)._review), /credentialed SLP/);
  });
});
