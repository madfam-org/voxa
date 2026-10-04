import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyScanInput,
  cellKey,
  createScanMachine,
  scanStepDelay,
  SwitchAcceptanceFilter,
  type GridCell,
  type ScanHighlight,
  type ScanMachine,
  type ScanState,
} from './index.js';

function allCells(rows: number, columns: number): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) out.add(cellKey({ row: r, column: c }));
  return out;
}

/** Compact label for a highlight: "R2" (row group), "2,1" (cell), "back", "-". */
function label(h: ScanHighlight): string {
  if (h.kind === 'group') return `R${h.cells[0]!.row}`;
  if (h.kind === 'cell') return cellKey(h.cell);
  if (h.kind === 'back') return 'back';
  return '-';
}

function run(machine: ScanMachine, state: ScanState, steps: number): { seq: string[]; state: ScanState } {
  const seq: string[] = [];
  let s = state;
  for (let i = 0; i < steps; i++) {
    s = machine.advance(s);
    seq.push(label(machine.highlight(s)));
  }
  return { seq, state: s };
}

describe('scan machine: group scanning never traps', () => {
  const machine = createScanMachine({
    rows: 3,
    columns: 3,
    order: 'row-major',
    groupStrategy: 'rows',
    occupied: allCells(3, 3),
    groupCycles: 2,
  });

  it('rows mode: after entering a row and 2 full cycles without selection, the scan is back at row level', () => {
    let s = machine.initial();
    assert.equal(label(machine.highlight(s)), 'R0');
    s = machine.advance(s);
    assert.equal(label(machine.highlight(s)), 'R1');
    s = machine.select(s).state; // enter row 1 (possibly the wrong row)
    assert.equal(s.level, 'cells');
    assert.equal(label(machine.highlight(s)), '1,0');
    const { seq, state } = run(machine, s, 8);
    assert.deepEqual(seq, [
      '1,1', '1,2', 'back', // end of cycle 1
      '1,0', '1,1', '1,2', 'back', // cycle 2
      'R1', // returned to row level on its own
    ]);
    assert.equal(state.level, 'groups');
    // and the row-level scan continues normally
    assert.deepEqual(run(machine, state, 3).seq, ['R2', 'R0', 'R1']);
  });

  it('the explicit back position returns to row level at once', () => {
    let s = machine.select(machine.initial()).state; // enter row 0
    s = run(machine, s, 3).state; // 0,1 0,2 back
    assert.equal(machine.highlight(s).kind, 'back');
    const result = machine.select(s);
    assert.equal(result.selected, undefined);
    assert.equal(result.state.level, 'groups');
    assert.equal(label(machine.highlight(result.state)), 'R0');
  });

  it('selecting a cell returns the cell and restarts at the first group', () => {
    let s = machine.select(machine.advance(machine.advance(machine.initial()))).state; // row 2
    s = machine.advance(s); // 2,1
    const result = machine.select(s);
    assert.deepEqual(result.selected, { row: 2, column: 1 });
    assert.equal(label(machine.highlight(result.state)), 'R0');
  });

  it('honours a configured cycle count', () => {
    const once = createScanMachine({
      rows: 2, columns: 2, order: 'row-major', groupStrategy: 'rows', occupied: allCells(2, 2), groupCycles: 1,
    });
    const s = once.select(once.initial()).state;
    assert.deepEqual(run(once, s, 3).seq, ['0,1', 'back', 'R0']);
  });

  it('quadrant groups skip empty regions and empty cells', () => {
    const occupied = new Set(['0,0', '3,3', '3,2']);
    const m = createScanMachine({ rows: 4, columns: 4, order: 'row-major', groupStrategy: 'regions', occupied });
    assert.equal(m.groups!.length, 2);
    let s = m.initial();
    s = m.advance(s);
    s = m.select(s).state; // bottom-right region
    assert.equal(label(m.highlight(s)), '3,2');
    assert.deepEqual(run(m, s, 2).seq, ['3,3', 'back']);
  });
});

describe('scan machine: linear scanning', () => {
  it('skips empty cells', () => {
    const occupied = new Set(['0,0', '0,2', '1,1']);
    const m = createScanMachine({ rows: 2, columns: 3, order: 'row-major', groupStrategy: 'none', occupied });
    const seq = [label(m.highlight(m.initial())), ...run(m, m.initial(), 4).seq];
    assert.deepEqual(seq, ['0,0', '0,2', '1,1', '0,0', '0,2']);
  });

  it('a 47-button board on a 6x8 grid has 47 linear steps, none empty', () => {
    const occupied = allCells(6, 8);
    occupied.delete('5,7');
    const m = createScanMachine({ rows: 6, columns: 8, order: 'row-major', groupStrategy: 'none', occupied });
    const visited = new Set<string>();
    let s = m.initial();
    for (let i = 0; i < 47; i++) {
      const h = m.highlight(s);
      assert.equal(h.kind, 'cell');
      visited.add(label(h));
      s = m.advance(s);
    }
    assert.equal(visited.size, 47);
    assert.equal(label(m.highlight(s)), '0,0');
  });

  it('an empty board highlights nothing and never selects', () => {
    const m = createScanMachine({ rows: 2, columns: 2, order: 'row-major', groupStrategy: 'rows', occupied: new Set() });
    assert.equal(m.empty, true);
    assert.equal(m.highlight(m.initial()).kind, 'none');
    assert.equal(m.select(m.initial()).selected, undefined);
  });

  it('selection returns the highlighted cell', () => {
    const m = createScanMachine({ rows: 1, columns: 3, order: 'row-major', groupStrategy: 'none', occupied: allCells(1, 3) });
    const selected: GridCell | undefined = m.select(m.advance(m.initial())).selected;
    assert.deepEqual(selected, { row: 0, column: 1 });
  });
});

describe('scan modes', () => {
  const m = createScanMachine({ rows: 1, columns: 4, order: 'row-major', groupStrategy: 'none', occupied: allCells(1, 4) });

  it('step scan moves only on switch 1', () => {
    let s = m.initial();
    s = applyScanInput(m, 'step', s, 'tick').state;
    s = applyScanInput(m, 'step', s, 'tick').state;
    assert.equal(label(m.highlight(s)), '0,0', 'the timer does not move a step scan');
    s = applyScanInput(m, 'step', s, 'advance').state;
    assert.equal(label(m.highlight(s)), '0,1', 'switch 1 moves');
    const selected = applyScanInput(m, 'step', s, 'select');
    assert.deepEqual(selected.selected, { row: 0, column: 1 }, 'switch 2 selects');
    assert.equal(label(m.highlight(selected.state)), '0,1', 'switch 2 does not move');
  });

  it('auto scan moves on the timer', () => {
    let s = m.initial();
    s = applyScanInput(m, 'auto', s, 'tick').state;
    s = applyScanInput(m, 'auto', s, 'tick').state;
    assert.equal(label(m.highlight(s)), '0,2');
  });

  it('holds the first item of a level for the configured extra time', () => {
    const first = m.initial();
    assert.equal(scanStepDelay(first, 1000, 600), 1600);
    assert.equal(scanStepDelay(m.advance(first), 1000, 600), 1000);
  });
});

describe('switch acceptance time', () => {
  it('ignores presses shorter than the acceptance time', () => {
    const f = new SwitchAcceptanceFilter<'select' | 'advance'>(150);
    assert.equal(f.press('select', 0), null);
    assert.deepEqual(f.due(50), []);
    assert.equal(f.release('select', 60), null, 'a 60 ms press is ignored');
    assert.deepEqual(f.due(500), [], 'and never fires later');
  });

  it('accepts a press held long enough, once', () => {
    const f = new SwitchAcceptanceFilter<'select' | 'advance'>(150);
    assert.equal(f.press('advance', 1000), null);
    assert.equal(f.press('advance', 1050), null, 'key repeat while held is ignored');
    assert.deepEqual(f.due(1150), ['advance']);
    assert.deepEqual(f.due(1300), []);
    assert.equal(f.release('advance', 1400), null, 'release after firing does not fire again');
  });

  it('with no acceptance time a press counts at once', () => {
    const f = new SwitchAcceptanceFilter<'select'>(0);
    assert.equal(f.press('select', 0), 'select');
    assert.equal(f.release('select', 10), null);
  });
});
