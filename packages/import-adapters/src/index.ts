import { type BoardButton } from '@voxa/core';
import { type ObfBoard } from '@voxa/obf';
import { zipSync } from 'fflate';
import {
  gridsetPageToBoardButtons,
  gridsetPrimaryPageToObf,
  parseGridsetArchive,
  type GridsetPage,
} from './gridset.js';

export {
  gridsetPageToBoardButtons,
  gridsetPrimaryPageToObf,
  parseGridsetArchive,
  parseGridXml,
  type GridsetCell,
  type GridsetPage,
  type GridsetParseResult,
} from './gridset.js';

export function gridsetArchiveToBoardUpdate(
  bytes: Uint8Array,
  boardId: string,
): { page: GridsetPage; buttons: BoardButton[]; warnings: string[] } {
  const { pages, warnings } = parseGridsetArchive(bytes);
  const page = pages[0];
  if (!page) {
    throw new Error('Gridset has no importable grids.');
  }
  const { warnings: pageWarnings } = gridsetPrimaryPageToObf(pages, boardId);
  return {
    page,
    buttons: gridsetPageToBoardButtons(page),
    warnings: [...warnings, ...pageWarnings],
  };
}

export function gridsetArchiveToObf(bytes: Uint8Array, boardId: string): { board: ObfBoard; warnings: string[] } {
  const { pages, warnings } = parseGridsetArchive(bytes);
  const { board, warnings: pageWarnings } = gridsetPrimaryPageToObf(pages, boardId);
  return { board, warnings: [...warnings, ...pageWarnings] };
}

/** Build a minimal gridset zip for tests and fixtures. */
export function buildSampleGridsetArchive(): Uint8Array {
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
