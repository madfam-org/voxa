import { buildGridScanPath, type GridCell, type ScanOrder } from './index.js';
import {
  buildGroupCellPath,
  cellKey,
  resolveScanGroups,
  type SwitchGroupStrategy,
} from './group-scan.js';

/**
 * Switch-scan state machine (pure, no timers).
 *
 * - Auto scan (one switch): a timer calls `advance`; any switch press selects.
 * - Step scan (two switches): switch 1 moves (`advance`), switch 2 selects;
 *   nothing moves on its own.
 * - Group scan (rows or quadrants): select a group, then a cell. Inside a
 *   group the scan offers an explicit "back" position after the last cell,
 *   and after `groupCycles` full cycles without a selection it returns to the
 *   group level by itself, so a wrong group never traps the user.
 * - Empty cells are never highlighted, and groups without a button are skipped.
 */
export type SwitchScanMode = 'auto' | 'step';

export const DEFAULT_GROUP_CYCLES = 2;
export const GROUP_CYCLES_MIN = 1;
export const GROUP_CYCLES_MAX = 5;

export interface ScanMachineConfig {
  rows: number;
  columns: number;
  order: ScanOrder;
  groupStrategy: SwitchGroupStrategy;
  /** Cells that hold a selectable button (`cellKey` format "row,column"). */
  occupied: ReadonlySet<string>;
  /** Full cycles inside a group without a selection before returning to group level. */
  groupCycles?: number;
  /** Offer a "back" position at the end of each group (default true). */
  backPosition?: boolean;
  customGroups?: number[][];
}

export type ScanState =
  | { level: 'linear'; index: number; fresh: boolean }
  | { level: 'groups'; groupIndex: number; fresh: boolean }
  | { level: 'cells'; groupIndex: number; position: number; cycles: number; fresh: boolean };

export type ScanHighlight =
  | { kind: 'none' }
  | { kind: 'cell'; cell: GridCell }
  | { kind: 'group'; groupIndex: number; cells: GridCell[] }
  | { kind: 'back'; groupIndex: number };

export interface ScanSelectResult {
  state: ScanState;
  /** The cell chosen by this press, if the press selected a button. */
  selected?: GridCell;
}

export interface ScanMachine {
  /** True when nothing on the board can be scanned. */
  readonly empty: boolean;
  /** Groups that hold at least one button (group scan only). */
  readonly groups: GridCell[][] | null;
  /** For each entry of `groups`, its index among all groups of the strategy (for naming quadrants). */
  readonly groupSourceIndices: number[];
  initial(): ScanState;
  advance(state: ScanState): ScanState;
  select(state: ScanState): ScanSelectResult;
  highlight(state: ScanState): ScanHighlight;
}

export function clampGroupCycles(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GROUP_CYCLES;
  return Math.min(GROUP_CYCLES_MAX, Math.max(GROUP_CYCLES_MIN, Math.round(value)));
}

export function createScanMachine(config: ScanMachineConfig): ScanMachine {
  const { rows, columns, order, groupStrategy, occupied } = config;
  const groupCycles = clampGroupCycles(config.groupCycles ?? DEFAULT_GROUP_CYCLES);
  const backPosition = config.backPosition ?? true;
  const isOccupied = (cell: GridCell) => occupied.has(cellKey(cell));

  const rawGroups = resolveScanGroups(rows, columns, groupStrategy, config.customGroups);
  const kept = rawGroups
    ? rawGroups
        .map((cells, sourceIndex) => ({ cells: cells.filter(isOccupied), sourceIndex }))
        .filter((group) => group.cells.length > 0)
    : [];
  const groups = rawGroups ? kept.map((group) => group.cells) : null;
  const groupSourceIndices = kept.map((group) => group.sourceIndex);
  const groupPaths = groups ? groups.map((cells) => buildGroupCellPath(cells, rows, columns, order)) : null;
  const linearPath = groups ? [] : buildGridScanPath(rows, columns, order).filter(isOccupied);
  const empty = groups ? groups.length === 0 : linearPath.length === 0;

  /** Positions inside group `g`: its cells, then "back" when enabled. */
  const positionsIn = (g: number) => (groupPaths?.[g]?.length ?? 0) + (backPosition ? 1 : 0);

  const initial = (): ScanState =>
    groups ? { level: 'groups', groupIndex: 0, fresh: true } : { level: 'linear', index: 0, fresh: true };

  const advance = (state: ScanState): ScanState => {
    if (empty) return state;
    if (state.level === 'linear') {
      return { level: 'linear', index: (state.index + 1) % linearPath.length, fresh: false };
    }
    if (state.level === 'groups') {
      return { level: 'groups', groupIndex: (state.groupIndex + 1) % groups!.length, fresh: false };
    }
    const total = positionsIn(state.groupIndex);
    const next = state.position + 1;
    if (next < total) return { ...state, position: next, fresh: false };
    const cycles = state.cycles + 1;
    if (cycles >= groupCycles) {
      // No selection after N full cycles: back to the group level, on the group just left.
      return { level: 'groups', groupIndex: state.groupIndex, fresh: true };
    }
    return { ...state, position: 0, cycles, fresh: false };
  };

  const select = (state: ScanState): ScanSelectResult => {
    if (empty) return { state };
    if (state.level === 'linear') {
      return { state: { ...state, fresh: true }, selected: linearPath[state.index % linearPath.length] };
    }
    if (state.level === 'groups') {
      return {
        state: { level: 'cells', groupIndex: state.groupIndex, position: 0, cycles: 0, fresh: true },
      };
    }
    const path = groupPaths![state.groupIndex] ?? [];
    if (state.position >= path.length) {
      // The "back" position.
      return { state: { level: 'groups', groupIndex: state.groupIndex, fresh: true } };
    }
    return {
      state: { level: 'groups', groupIndex: 0, fresh: true },
      selected: path[state.position],
    };
  };

  const highlight = (state: ScanState): ScanHighlight => {
    if (empty) return { kind: 'none' };
    if (state.level === 'linear') {
      const cell = linearPath[state.index % linearPath.length];
      return cell ? { kind: 'cell', cell } : { kind: 'none' };
    }
    if (state.level === 'groups') {
      const g = state.groupIndex % groups!.length;
      return { kind: 'group', groupIndex: g, cells: groups![g]! };
    }
    const path = groupPaths![state.groupIndex] ?? [];
    if (state.position >= path.length) return { kind: 'back', groupIndex: state.groupIndex };
    return { kind: 'cell', cell: path[state.position]! };
  };

  return { empty, groups, groupSourceIndices, initial, advance, select, highlight };
}

export type ScanInput = 'tick' | 'advance' | 'select';

/**
 * One input to the scan, by mode. Auto scan moves on the timer (`tick`) and
 * still honours a second "move" switch; step scan ignores the timer and moves
 * only on switch 1 (`advance`). Switch 2 (`select`) selects in both modes.
 */
export function applyScanInput(
  machine: ScanMachine,
  mode: SwitchScanMode,
  state: ScanState,
  input: ScanInput,
): ScanSelectResult {
  if (input === 'select') return machine.select(state);
  if (input === 'tick' && mode === 'step') return { state };
  return { state: machine.advance(state) };
}

/** Delay before the next automatic step: the first item of a level is held longer. */
export function scanStepDelay(state: ScanState, intervalMs: number, firstItemHoldMs: number): number {
  return intervalMs + (state.fresh ? Math.max(0, firstItemHoldMs) : 0);
}

/**
 * Acceptance time: a switch press counts only once it has been held for
 * `acceptanceMs` (0 = on press). Shorter presses (tremor, bounces) are ignored.
 * Pure bookkeeping: callers pass the clock and schedule `due()` themselves.
 */
export class SwitchAcceptanceFilter<A extends string = string> {
  private readonly held = new Map<A, { at: number; fired: boolean }>();

  constructor(private readonly acceptanceMs: number) {}

  /** A switch went down. Returns the action when it counts immediately. */
  press(action: A, now: number): A | null {
    if (this.held.has(action)) return null; // key repeat while held
    const fireNow = this.acceptanceMs <= 0;
    this.held.set(action, { at: now, fired: fireNow });
    return fireNow ? action : null;
  }

  /** Actions held long enough by `now` that have not fired yet. */
  due(now: number): A[] {
    const out: A[] = [];
    for (const [action, entry] of this.held) {
      if (!entry.fired && now - entry.at >= this.acceptanceMs) {
        entry.fired = true;
        out.push(action);
      }
    }
    return out;
  }

  /** A switch went up. Returns the action if this release completes an accepted press. */
  release(action: A, now: number): A | null {
    const entry = this.held.get(action);
    this.held.delete(action);
    if (!entry || entry.fired) return null;
    return now - entry.at >= this.acceptanceMs ? action : null;
  }

  reset(): void {
    this.held.clear();
  }
}
