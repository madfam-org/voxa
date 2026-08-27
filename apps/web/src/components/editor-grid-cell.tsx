'use client';

import type { CSSProperties, DragEvent } from 'react';
import { brand, neutral, surface } from '@/lib/tokens';

const DRAG_MIME = 'application/x-voxa-button-id';

export function readDraggedButtonId(event: DragEvent): string | null {
  return event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain') || null;
}

export function setDraggedButtonId(event: DragEvent, buttonId: string): void {
  event.dataTransfer.setData(DRAG_MIME, buttonId);
  event.dataTransfer.effectAllowed = 'move';
}

interface EditorGridCellProps {
  row: number;
  column: number;
  occupied?: boolean;
  dropHighlight?: boolean;
  onDropButton: (buttonId: string, row: number, column: number) => void;
  onAddButton?: (row: number, column: number) => void;
  children?: React.ReactNode;
}

export function EditorGridCell({
  row,
  column,
  occupied,
  dropHighlight,
  onDropButton,
  onAddButton,
  children,
}: EditorGridCellProps): React.ReactNode {
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const buttonId = readDraggedButtonId(event);
    if (buttonId) onDropButton(buttonId, row, column);
  };

  if (children) {
    return (
      <div
        style={{ width: '100%', height: '100%', minHeight: 0 }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => onAddButton?.(row, column)}
      style={{
        ...emptyCellStyle,
        borderColor: dropHighlight ? brand.primary : neutral.border,
        background: dropHighlight ? brand.surfaceTint : surface.base,
      }}
      aria-label={`Empty grid cell row ${row + 1} column ${column + 1}. Drop a button here or click to add.`}
    >
      +
    </button>
  );
}

interface DraggableButtonShellProps {
  buttonId: string;
  draggable: boolean;
  children: React.ReactNode;
}

export function DraggableButtonShell({
  buttonId,
  draggable,
  children,
}: DraggableButtonShellProps): React.ReactNode {
  if (!draggable) return children;

  return (
    <div
      draggable
      onDragStart={(event) => setDraggedButtonId(event, buttonId)}
      style={{ width: '100%', height: '100%', cursor: 'grab' }}
    >
      {children}
    </div>
  );
}

const emptyCellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 48,
  border: `2px dashed ${neutral.border}`,
  borderRadius: 8,
  background: surface.base,
  color: neutral.muted,
  fontSize: '1.25rem',
  cursor: 'pointer',
};
