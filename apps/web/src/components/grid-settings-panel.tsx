'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { GRID_MAX_CELLS, GRID_MAX_DIMENSION, GRID_MIN_CELLS, GRID_MIN_DIMENSION } from '@voxa/vocabulary';
import { brand, neutral, status, surface } from '@/lib/tokens';

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
  const t = useTranslations('gridSettings');
  const tc = useTranslations('common');
  const [nextRows, setNextRows] = useState(rows);
  const [nextColumns, setNextColumns] = useState(columns);
  const cells = nextRows * nextColumns;

  return (
    <aside
      role="dialog"
      aria-label={t('title')}
      style={{
        width: 300,
        background: surface.section,
        color: neutral.textSubtle,
        borderLeft: `1px solid ${neutral.borderSubtle}`,
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{t('title')}</h2>
        <button type="button" onClick={onClose} style={btnStyle}>
          {tc('close')}
        </button>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: neutral.muted, lineHeight: 1.5 }}>
        {t('limits', {
          minCells: GRID_MIN_CELLS,
          maxCells: GRID_MAX_CELLS,
          minDimension: GRID_MIN_DIMENSION,
          maxDimension: GRID_MAX_DIMENSION,
        })}
      </p>

      <label style={labelStyle}>
        {t('rows')}
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
        {t('columns')}
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
        {t('summary', { cells, buttons: buttonCount })}
        {buttonCount > cells ? <span style={{ color: status.danger }}> {t('tooMany')}</span> : null}
      </p>

      <button
        type="button"
        style={{ ...btnStyle, width: '100%', background: brand.primary, borderColor: brand.primary }}
        disabled={buttonCount > cells}
        onClick={() => onApply(nextRows, nextColumns)}
      >
        {t('apply')}
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
  background: surface.base,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  color: neutral.textSubtle,
  padding: '8px 10px',
};

const btnStyle: React.CSSProperties = {
  background: surface.overlay,
  color: surface.white,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '8px 12px',
  minHeight: 38,
  cursor: 'pointer',
};
