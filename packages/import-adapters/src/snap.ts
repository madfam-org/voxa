import { createBoardId, createButtonId, type BoardButton } from '@voxa/core';

export interface SnapCell {
  row: number;
  column: number;
  label: string;
  vocalization: string;
}

export interface SnapPage {
  id: string;
  name: string;
  rows: number;
  columns: number;
  cells: SnapCell[];
}

interface SqlJsStatic {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
}

interface SqlJsDatabase {
  exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
}

async function openSnapDatabase(bytes: Uint8Array): Promise<SqlJsDatabase> {
  const initSqlJs = (await import('sql.js')).default as (config?: {
    locateFile?: (file: string) => string;
  }) => Promise<SqlJsStatic>;
  const SQL = await initSqlJs();
  return new SQL.Database(bytes);
}

function queryButtons(db: SqlJsDatabase): SnapCell[] {
  const queries = [
    `SELECT b.Label, b.Message, ep.GridPosition
     FROM Button b
     LEFT JOIN ElementReference er ON b.ElementReferenceId = er.Id
     LEFT JOIN ElementPlacement ep ON ep.ElementReferenceId = er.Id
     WHERE b.Label IS NOT NULL`,
    `SELECT Label, Message, GridPosition FROM Button WHERE Label IS NOT NULL`,
    `SELECT Label, Message, NULL as GridPosition FROM Button WHERE Label IS NOT NULL`,
  ];

  for (const sql of queries) {
    try {
      const result = db.exec(sql);
      if (!result[0]?.values.length) continue;
      const cells: SnapCell[] = [];
      for (const row of result[0].values) {
        const label = String(row[0] ?? '').trim();
        const message = String(row[1] ?? label).trim();
        const position = String(row[2] ?? '0,0');
        const [rowText, colText] = position.split(',');
        if (!label) continue;
        cells.push({
          row: Number(rowText) || 0,
          column: Number(colText) || 0,
          label,
          vocalization: message || label,
        });
      }
      if (cells.length > 0) return cells;
    } catch {
      // try next schema variant
    }
  }

  return [];
}

function pageFromCells(cells: SnapCell[], pageId: string): SnapPage {
  const rows = Math.max(1, ...cells.map((cell) => cell.row + 1));
  const columns = Math.max(1, ...cells.map((cell) => cell.column + 1));
  return {
    id: pageId,
    name: pageId,
    rows,
    columns,
    cells,
  };
}

export function snapCellsToBoardButtons(cells: SnapCell[]): BoardButton[] {
  return cells.map((cell, index) => ({
    kind: 'analytic' as const,
    id: createButtonId(`snap-${cell.row}-${cell.column}-${index}`),
    label: cell.label,
    speechText: cell.vocalization,
    locale: 'en-US',
    position: { row: cell.row, column: cell.column },
    locked: false,
  }));
}

export async function parseSnapArchive(bytes: Uint8Array): Promise<{ page: SnapPage; warnings: string[] }> {
  const db = await openSnapDatabase(bytes);
  try {
    const cells = queryButtons(db);
    if (cells.length === 0) {
      throw new Error('Invalid Snap archive: no Button rows found.');
    }
    return {
      page: pageFromCells(cells, 'snap-primary'),
      warnings: ['Snap import uses primary page buttons only; symbols and links are not migrated yet.'],
    };
  } finally {
    db.close();
  }
}

export async function snapArchiveToBoardUpdate(
  bytes: Uint8Array,
  boardId: string,
): Promise<{ page: SnapPage; buttons: BoardButton[]; warnings: string[] }> {
  void boardId;
  const { page, warnings } = await parseSnapArchive(bytes);
  return {
    page,
    buttons: snapCellsToBoardButtons(page.cells),
    warnings,
  };
}

/** Build a minimal Snap-style SQLite archive for tests. */
export async function buildSampleSnapArchive(): Promise<Uint8Array> {
  const initSqlJs = (await import('sql.js')).default as () => Promise<SqlJsStatic>;
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE Button (id INTEGER PRIMARY KEY, Label TEXT, Message TEXT, GridPosition TEXT);
    INSERT INTO Button (Label, Message, GridPosition) VALUES ('hello', 'hello', '0,0');
    INSERT INTO Button (Label, Message, GridPosition) VALUES ('goodbye', 'goodbye', '0,1');
    INSERT INTO Button (Label, Message, GridPosition) VALUES ('more', 'more please', '1,0');
  `);
  const exported = db.export();
  db.close();
  return Uint8Array.from(exported);
}
