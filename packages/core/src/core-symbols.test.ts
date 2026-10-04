import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyCoreSymbols,
  CORE_SYMBOL_ALLOW_MAP,
  coreSymbolFields,
} from './core-symbols.js';
import { boardForDemoScene, createDemoCoreBoard, type DemoSceneId } from './demo-experience.js';
import { createStarterBoard, type StarterTemplateId } from './starter-boards.js';
import { STARTER_CONTENT_LOCALES } from './demo-locale.js';
import type { Board } from './index.js';

const MULBERRY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../apps/web/public/symbols/mulberry',
);

/** Pictogram ids an earlier release showed for the wrong concept ("I" = blouse, ...). */
const RETIRED_WRONG_IDS = [2280, 2281, 34021, 39109, 37428, 8252, 7020, 6882];

function analyticIds(board: Board): string[] {
  return board.grid.buttons.filter((b) => b.kind === 'analytic').map((b) => String(b.id));
}

describe('core symbol allow-map', () => {
  it('covers every Core 47 word exactly once', () => {
    const core = analyticIds(createStarterBoard('core-47'));
    assert.equal(core.length, 47);
    assert.deepEqual([...Object.keys(CORE_SYMBOL_ALLOW_MAP)].sort(), [...core].sort());
  });

  it('maps only to vendored Mulberry files, and shows "I", "on", "off" label-only', () => {
    for (const [slug, entry] of Object.entries(CORE_SYMBOL_ALLOW_MAP)) {
      if (entry.provider === 'mulberry') {
        assert.ok(existsSync(join(MULBERRY_DIR, `${entry.file}.svg`)), `${slug} -> ${entry.file}.svg missing`);
      } else {
        assert.equal(entry.provider, 'label-only');
        assert.ok(entry.reason.length > 0, `${slug} needs a reason`);
      }
    }
    for (const slug of ['i', 'on', 'off']) {
      assert.equal(CORE_SYMBOL_ALLOW_MAP[slug]?.provider, 'label-only', slug);
      assert.equal(coreSymbolFields(slug), undefined, slug);
    }
  });

  it('every symbol on a Voxa-built board comes from the allow-map', () => {
    const templates: StarterTemplateId[] = ['core-47', 'core-100', 'literacy-keyboard', 'visual-schedule'];
    const boards: Board[] = [];
    for (const locale of STARTER_CONTENT_LOCALES) {
      for (const template of templates) boards.push(createStarterBoard(template, { locale }));
    }
    for (const scene of ['communicate', 'literacy', 'schedule', 'access'] as DemoSceneId[]) {
      for (const ui of ['es', 'en', 'fr'] as const) boards.push(boardForDemoScene(scene, ui));
    }
    for (const board of boards) {
      for (const button of board.grid.buttons) {
        const expected = coreSymbolFields(String(button.id));
        assert.equal(button.symbolUrl, expected?.symbolUrl, `${board.id}/${String(button.id)}`);
        assert.deepEqual(button.symbolRef, expected?.symbolRef, `${board.id}/${String(button.id)}`);
      }
      const serialized = JSON.stringify(board).toLowerCase();
      assert.ok(!serialized.includes('arasaac'), `${board.id} references the non-commercial set`);
      for (const id of RETIRED_WRONG_IDS) {
        assert.ok(!serialized.includes(`/${id}/`), `${board.id} carries retired id ${id}`);
      }
    }
  });

  it('applyCoreSymbols replaces stale symbols on a stored demo board', () => {
    const fresh = createDemoCoreBoard();
    const stale: Board = {
      ...fresh,
      grid: {
        ...fresh.grid,
        buttons: fresh.grid.buttons.map((button) => ({
          ...button,
          symbolUrl: `https://example.invalid/pictograms/2280/2280_300.png`,
        })),
      },
    };
    const repaired = applyCoreSymbols(stale);
    const i = repaired.grid.buttons.find((b) => b.id === 'i');
    assert.ok(i && !i.symbolUrl && !i.symbolRef, '"I" is label-only after repair');
    const want = repaired.grid.buttons.find((b) => b.id === 'want');
    assert.equal(want?.symbolUrl, '/symbols/mulberry/want.svg');
    assert.equal(applyCoreSymbols(fresh), fresh, 'no-op returns the same object');
  });
});
