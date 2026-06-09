import { createBoardId, createButtonId, type BoardButton } from '@voxa/core';
import { unzipSync, zipSync } from 'fflate';

export interface TouchChatCell {
  row: number;
  column: number;
  label: string;
  vocalization: string;
  navigateToPageId?: string;
}

export interface TouchChatPage {
  id: string;
  name: string;
  rows: number;
  columns: number;
  cells: TouchChatCell[];
}

interface SqlJsStatic {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
}

interface SqlJsDatabase {
  exec(sql: string): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
}

async function openTouchChatDatabase(bytes: Uint8Array): Promise<SqlJsDatabase> {
  const initSqlJs = (await import('sql.js')).default as (config?: {
    locateFile?: (file: string) => string;
  }) => Promise<SqlJsStatic>;
  const SQL = await initSqlJs();
  return new SQL.Database(bytes);
}

function extractC4vDatabase(bytes: Uint8Array): Uint8Array {
  const entries = unzipSync(bytes);
  for (const [path, data] of Object.entries(entries)) {
    if (path.toLowerCase().endsWith('.c4v')) {
      return data;
    }
  }
  throw new Error('Invalid TouchChat archive: expected a .c4v vocabulary database in the zip.');
}

function queryScalar(db: SqlJsDatabase, sql: string): unknown | undefined {
  const result = db.exec(sql);
  return result[0]?.values[0]?.[0];
}

function queryHomePageId(db: SqlJsDatabase): number | undefined {
  const homeId = queryScalar(db, `SELECT page_id FROM special_pages WHERE name = 'Home' LIMIT 1`);
  if (homeId != null && homeId !== '') {
    return Number(homeId);
  }
  const firstPage = queryScalar(db, `SELECT id FROM pages ORDER BY id LIMIT 1`);
  return firstPage != null ? Number(firstPage) : undefined;
}

function queryPageLayout(
  db: SqlJsDatabase,
  pageId: number,
): { name: string; columns: number; rows: number } | undefined {
  const sql = `
    SELECT r.name, bb.init_size_x, bb.init_size_y
    FROM pages p
    JOIN resources r ON p.resource_id = r.id
    JOIN button_box_instances bbi ON bbi.page_id = p.id
    JOIN button_boxes bb ON bbi.button_box_id = bb.id
    WHERE p.id = ${pageId}
    LIMIT 1
  `;
  const result = db.exec(sql);
  const row = result[0]?.values[0];
  if (!row) return undefined;
  const columns = Math.max(1, Number(row[1]) || 1);
  const rows = Math.max(1, Number(row[2]) || 1);
  return { name: String(row[0] ?? 'TouchChat'), columns, rows };
}

function queryPageCells(db: SqlJsDatabase, pageId: number, columns: number): TouchChatCell[] {
  const sql = `
    SELECT b.label, b.message, bbc.location, p.id
    FROM button_box_instances bbi
    JOIN button_boxes bb ON bbi.button_box_id = bb.id
    JOIN button_box_cells bbc ON bbc.button_box_id = bb.id
    JOIN resources br ON br.id = bbc.resource_id
    JOIN buttons b ON b.resource_id = br.id
    LEFT JOIN actions a ON a.resource_id = b.resource_id AND a.code = 1
    LEFT JOIN action_data ad ON ad.action_id = a.id AND ad.key = 1
    LEFT JOIN pages p ON p.id = ad.value
    WHERE bbi.page_id = ${pageId}
      AND b.label IS NOT NULL
      AND TRIM(b.label) != ''
  `;

  const cells: TouchChatCell[] = [];
  try {
    const result = db.exec(sql);
    for (const row of result[0]?.values ?? []) {
      const label = String(row[0] ?? '').trim();
      const message = String(row[1] ?? label).trim();
      const location = Number(row[2]) || 0;
      const navigateToPageId = row[3] != null ? String(row[3]) : undefined;
      if (!label) continue;
      cells.push({
        row: Math.floor(location / columns),
        column: location % columns,
        label,
        vocalization: message || label,
        navigateToPageId,
      });
    }
    if (cells.length > 0) return cells;
  } catch {
    // fall back to simpler schema without actions tables
  }

  const fallbackSql = `
    SELECT b.label, b.message, bbc.location
    FROM button_box_instances bbi
    JOIN button_boxes bb ON bbi.button_box_id = bb.id
    JOIN button_box_cells bbc ON bbc.button_box_id = bb.id
    JOIN buttons b ON b.resource_id = bbc.resource_id
    WHERE bbi.page_id = ${pageId}
      AND b.label IS NOT NULL
      AND TRIM(b.label) != ''
  `;
  const fallback = db.exec(fallbackSql);
  for (const row of fallback[0]?.values ?? []) {
    const label = String(row[0] ?? '').trim();
    const message = String(row[1] ?? label).trim();
    const location = Number(row[2]) || 0;
    if (!label) continue;
    cells.push({
      row: Math.floor(location / columns),
      column: location % columns,
      label,
      vocalization: message || label,
    });
  }
  return cells;
}

export function touchChatCellsToBoardButtons(cells: TouchChatCell[]): BoardButton[] {
  return cells.map((cell, index) => {
    const base = {
      kind: 'analytic' as const,
      id: createButtonId(`tc-${cell.row}-${cell.column}-${index}`),
      label: cell.label,
      speechText: cell.vocalization,
      locale: 'en-US',
      position: { row: cell.row, column: cell.column },
      locked: false,
    };
    if (cell.navigateToPageId) {
      return {
        ...base,
        navigateToBoardId: createBoardId(`touchchat-page-${cell.navigateToPageId}`),
      };
    }
    return base;
  });
}

export async function parseTouchChatArchive(
  bytes: Uint8Array,
): Promise<{ page: TouchChatPage; warnings: string[] }> {
  const c4v = extractC4vDatabase(bytes);
  const db = await openTouchChatDatabase(c4v);
  try {
    const pageId = queryHomePageId(db);
    if (pageId == null) {
      throw new Error('Invalid TouchChat archive: no pages found in vocabulary database.');
    }
    const layout = queryPageLayout(db, pageId);
    if (!layout) {
      throw new Error('Invalid TouchChat archive: home page has no button grid.');
    }
    const cells = queryPageCells(db, pageId, layout.columns);
    if (cells.length === 0) {
      throw new Error('Invalid TouchChat archive: home page has no speakable buttons.');
    }
    return {
      page: {
        id: String(pageId),
        name: layout.name,
        rows: layout.rows,
        columns: layout.columns,
        cells,
      },
      warnings: [
        'TouchChat import uses the Home page only; symbols and custom images are not migrated yet.',
      ],
    };
  } finally {
    db.close();
  }
}

export async function touchChatArchiveToBoardUpdate(
  bytes: Uint8Array,
  boardId: string,
): Promise<{ page: TouchChatPage; buttons: BoardButton[]; warnings: string[] }> {
  void boardId;
  const { page, warnings } = await parseTouchChatArchive(bytes);
  return {
    page,
    buttons: touchChatCellsToBoardButtons(page.cells),
    warnings,
  };
}

/** Build a minimal TouchChat `.ce` zip archive for tests. */
export async function buildSampleTouchChatArchive(): Promise<Uint8Array> {
  const initSqlJs = (await import('sql.js')).default as () => Promise<SqlJsStatic>;
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE resources (id INTEGER PRIMARY KEY, rid TEXT, name TEXT, type INTEGER);
    CREATE TABLE pages (id INTEGER PRIMARY KEY, resource_id INTEGER);
    CREATE TABLE special_pages (id INTEGER PRIMARY KEY, name TEXT, page_id INTEGER);
    CREATE TABLE button_boxes (id INTEGER PRIMARY KEY, init_size_x INTEGER, init_size_y INTEGER);
    CREATE TABLE button_box_instances (id INTEGER PRIMARY KEY, button_box_id INTEGER, page_id INTEGER);
    CREATE TABLE button_box_cells (id INTEGER PRIMARY KEY, button_box_id INTEGER, resource_id INTEGER, location INTEGER);
    CREATE TABLE buttons (id INTEGER PRIMARY KEY, resource_id INTEGER, label TEXT, message TEXT);

    INSERT INTO resources VALUES (1, '{HOME-PAGE}', 'Core', 7);
    INSERT INTO pages VALUES (1, 1);
    INSERT INTO special_pages VALUES (1, 'Home', 1);
    INSERT INTO button_boxes VALUES (1, 2, 2);
    INSERT INTO button_box_instances VALUES (1, 1, 1);

    INSERT INTO resources VALUES (2, '{BTN-HELLO}', 'hello', 4);
    INSERT INTO buttons VALUES (1, 2, 'hello', 'hello');
    INSERT INTO button_box_cells VALUES (1, 1, 2, 0);

    INSERT INTO resources VALUES (3, '{BTN-GOODBYE}', 'goodbye', 4);
    INSERT INTO buttons VALUES (2, 3, 'goodbye', 'goodbye');
    INSERT INTO button_box_cells VALUES (2, 1, 3, 1);

    INSERT INTO resources VALUES (4, '{BTN-MORE}', 'more', 4);
    INSERT INTO buttons VALUES (3, 4, 'more', 'more please');
    INSERT INTO button_box_cells VALUES (3, 1, 4, 2);
  `);
  const exported = db.export();
  db.close();

  return zipSync({
    'Sample.c4v': Uint8Array.from(exported),
    'version.txt': new TextEncoder().encode('4'),
  });
}
