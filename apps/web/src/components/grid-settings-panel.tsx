'use client';

import { useState } from 'react';
import { GRID_MAX_CELLS, GRID_MAX_DIMENSION, GRID_MIN_CELLS, GRID_MIN_DIMENSION } from '@voxa/vocabulary';

interface GridSettingsPanelProps {
  rows: number;
  columns: number;
  buttonCount: number;
  onApply: (rows: number, columns: number) => void;
  onClose: () => void;
}

export function GridSettingsPanel({
  rows,
  columns,
  buttonCount,
  onApply,
  onClose,
}: GridSettingsPanelProps): React.ReactNode {
  const [nextRows, setNextRows] = useState(rows);
  const [nextColumns, setNextColumns] = useState(columns);
  const cells = nextRows * nextColumns;

  return (
    <aside
      role="dialog"
      aria-label="Grid size"
      style={{
        width: 300,
        background: '#111',
        color: '#f5f5f5',
        borderLeft: '1px solid #333',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Grid size</h2>
        <button type="button" onClick={onClose} style={btnStyle}>
          Close
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: '#a3a3a3', lineHeight: 1.5 }}>
        {GRID_MIN_CELLS}–{GRID_MAX_CELLS} cells ({GRID_MIN_DIMENSION}–{GRID_MAX_DIMENSION} rows/columns). Locked
        motor-plan slots stay fixed; unlocked buttons reflow when the grid shrinks.
      </p>

      <label style={labelStyle}>
        Rows
        <input
          type="number"
          min={GRID_MIN_DIMENSION}
          max={GRID_MAX_DIMENSION}
          value={nextRows}
          onChange={(e) => setNextRows(Number(e.target.value))}
          style={fieldStyle}
        />
      </label>

      <label style={labelStyle}>
        Columns
        <input
          type="number"
          min={GRID_MIN_DIMENSION}
          max={GRID_MAX_DIMENSION}
          value={nextColumns}
          onChange={(e) => setNextColumns(Number(e.target.value))}
          style={fieldStyle}
        />
      </label>

      <p style={{ fontSize: '0.875rem', margin: '0 0 12px' }}>
        {cells} cells · {buttonCount} button{buttonCount === 1 ? '' : 's'}
        {buttonCount > cells ? (
          <span style={{ color: '#f87171' }}> — too many buttons for this grid</span>
        ) : null}
      </p>

      <button
        type="button"
        style={{ ...btnStyle, width: '100%', background: '#2563eb', borderColor: '#2563eb' }}
        disabled={buttonCount > cells}
        onClick={() => onApply(nextRows, nextColumns)}
      >
        Apply grid size
      </button>
    </aside>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.875rem',
  marginBottom: 12,
};

const fieldStyle: React.CSSProperties = {
  background: '#0a0a0a',
  border: '1px solid #404040',
  borderRadius: 6,
  color: '#f5f5f5',
  padding: '8px 10px',
};

const btnStyle: React.CSSProperties = {
  background: '#262626',
  color: '#fff',
  border: '1px solid #404040',
  borderRadius: 6,
  padding: '8px 12px',
  minHeight: 38,
  cursor: 'pointer',
};
