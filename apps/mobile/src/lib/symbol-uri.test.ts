import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Board, BoardButton } from '@voxa/core';
import { MULBERRY_CORE_SLUGS } from '@voxa/symbols';
import { boardHidesSymbols, buttonSymbolUri, showsMulberrySymbol } from './symbol-uri';

const WEB = 'https://web.example.test/';
const coreSlug = Object.keys(MULBERRY_CORE_SLUGS)[0]!;

function button(extra: Partial<BoardButton> = {}): BoardButton {
  return {
    kind: 'analytic',
    id: 'b1',
    label: 'go',
    speechText: 'go',
    locale: 'en-US',
    position: { row: 0, column: 0 },
    locked: false,
    ...extra,
  } as BoardButton;
}

describe('buttonSymbolUri', () => {
  it('resolves a Mulberry reference against the web host', () => {
    const uri = buttonSymbolUri(button({ symbolRef: { provider: 'mulberry', slug: coreSlug } }), WEB);
    assert.ok(uri?.startsWith('https://web.example.test/symbols/mulberry/'), uri);
    assert.ok(uri?.endsWith('.svg'), uri);
  });

  it('keeps absolute https symbol URLs', () => {
    const url = 'https://media.example.test/a.png';
    assert.equal(buttonSymbolUri(button({ symbolUrl: url }), WEB), url);
  });

  it('is label-only without a symbol, for a removed-library reference, and for other schemes', () => {
    assert.equal(buttonSymbolUri(button(), WEB), undefined);
    assert.equal(
      buttonSymbolUri(button({ symbolRef: { provider: 'arasaac', pictogramId: 1 } }), WEB),
      undefined,
    );
    assert.equal(buttonSymbolUri(button({ symbolUrl: 'data:image/png;base64,AAAA' }), WEB), undefined);
    assert.equal(buttonSymbolUri(button({ symbolUrl: '//other.example.test/a.svg' }), WEB), undefined);
  });
});

describe('symbol display rules', () => {
  const board = { grid: { rows: 1, columns: 1, buttons: [] } } as unknown as Board;

  it('hides symbols when the board says so', () => {
    assert.equal(boardHidesSymbols(board), false);
    assert.equal(boardHidesSymbols({ ...board, display: { hideSymbols: true } }), true);
  });

  it('asks for attribution only when a Mulberry symbol is shown', () => {
    const mulberry = buttonSymbolUri(button({ symbolRef: { provider: 'mulberry', slug: coreSlug } }), WEB);
    assert.equal(showsMulberrySymbol([undefined, 'https://media.example.test/a.png']), false);
    assert.equal(showsMulberrySymbol([undefined, mulberry]), true);
  });
});
