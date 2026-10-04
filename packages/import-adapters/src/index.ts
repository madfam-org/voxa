import { type BoardButton } from '@voxa/core';
import { zipSync } from 'fflate';
import { gridsetPageToBoardButtons, parseGridsetArchive, type GridsetPage } from './gridset.js';

export {
  gridsetPageToBoardButtons,
  parseGridsetArchive,
  parseGridsetSettings,
  parseGridXml,
  type GridsetCell,
  type GridsetPage,
  type GridsetParseResult,
} from './gridset.js';

export interface AdapterOptions {
  /** Locale when the file has none (Voxa passes the importer's content locale). */
  fallbackLocale?: string;
}

export interface AdapterPageResult<Page> {
  page: Page;
  buttons: BoardButton[];
  /** Locale of the imported page: from the file when present, else the fallback. */
  locale: string;
  warnings: string[];
}

/** Grid 3: the HOME grid (from the gridset settings), captions only (beta). */
export function gridsetArchiveToBoardUpdate(
  bytes: Uint8Array,
  options: AdapterOptions = {},
): AdapterPageResult<GridsetPage> {
  const { home, locale: fileLocale, warnings } = parseGridsetArchive(bytes);
  const locale = fileLocale ?? options.fallbackLocale ?? 'es-MX';
  return { page: home, buttons: gridsetPageToBoardButtons(home, locale), locale, warnings };
}

/**
 * Build a minimal SYNTHETIC gridset zip for tests: two grids, where the home
 * grid (named by `Settings0/settings.xml` `<StartGrid>`) is not the
 * alphabetically first one. It mirrors the documented structure; it is not a
 * file produced by Grid 3.
 */
export function buildSampleGridsetArchive(options: { language?: string; startGrid?: string | null } = {}): Uint8Array {
  const startGrid = options.startGrid === undefined ? 'core-home' : options.startGrid;
  const settingsXml = `<?xml version="1.0" encoding="utf-8"?>
<GridSetSettings>${startGrid ? `<StartGrid>${startGrid}</StartGrid>` : ''}${
    options.language ? `<Language>${options.language}</Language>` : ''
  }</GridSetSettings>`;
  const alphaXml = `<?xml version="1.0" encoding="utf-8"?>
<Grid Name="Alphabet">
  <RowDefinitions><RowDefinition/></RowDefinitions>
  <ColumnDefinitions><ColumnDefinition/></ColumnDefinitions>
  <Cells><Cell><Content><CaptionAndImage><Caption>a</Caption></CaptionAndImage></Content></Cell></Cells>
</Grid>`;
  const gridXml = `<?xml version="1.0" encoding="utf-8"?>
<Grid Name="Core" GridGuid="core-home">
  <RowDefinitions><RowDefinition Height="1"/><RowDefinition Height="1"/></RowDefinitions>
  <ColumnDefinitions><ColumnDefinition Width="1"/><ColumnDefinition Width="1"/></ColumnDefinitions>
  <Cells>
    <Cell X="0" Y="0"><Content><CaptionAndImage><Caption>hello</Caption></CaptionAndImage></Content></Cell>
    <Cell X="1" Y="0"><Content><CaptionAndImage><Caption>goodbye</Caption></CaptionAndImage></Content></Cell>
    <Cell X="0" Y="1"><Content><CaptionAndImage><Caption>more</Caption></CaptionAndImage>
      <Commands><Command ID="Jump.To"><Parameter Key="grid">core-more</Parameter></Command></Commands>
    </Content></Cell>
  </Cells>
</Grid>`;

  return zipSync({
    'Settings0/settings.xml': new TextEncoder().encode(settingsXml),
    'Grids/Alphabet/grid.xml': new TextEncoder().encode(alphaXml),
    'Grids/core-home/grid.xml': new TextEncoder().encode(gridXml),
  });
}

export {
  buildSampleSnapArchive,
  parseSnapArchive,
  snapArchiveToBoardUpdate,
  snapCellsToBoardButtons,
  type SnapCell,
  type SnapPage,
} from './snap.js';

export {
  buildSampleTouchChatArchive,
  parseTouchChatArchive,
  touchChatArchiveToBoardUpdate,
  touchChatCellsToBoardButtons,
  type TouchChatCell,
  type TouchChatPage,
} from './touchchat.js';
