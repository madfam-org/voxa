'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { brand, neutral, surface } from '@/lib/tokens';

/**
 * Single-pointer and keyboard alternative to dragging buttons in the editor
 * (WCAG 2.2 2.5.7 Dragging Movements). "Move" selects the button; a tap or
 * click on any destination cell moves it there (swapping with a button that
 * is already there). The arrow commands move it one cell at a time.
 * HTML5 drag and drop stays available for mouse users.
 */
export function ButtonMoveControls({
  moving,
  canMove,
  onStartMove,
  onCancelMove,
  onMoveBy,
}: {
  moving: boolean;
  canMove: boolean;
  onStartMove: () => void;
  onCancelMove: () => void;
  onMoveBy: (rows: number, columns: number) => void;
}): React.ReactNode {
  const t = useTranslations('editor');
  return (
    <section aria-label={t('moveSection')} style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={moving ? onCancelMove : onStartMove}
        disabled={!canMove}
        aria-pressed={moving}
        style={{ ...moveBtn, width: '100%', marginBottom: 8, background: moving ? brand.primary : surface.overlay }}
      >
        {moving ? t('moveCancel') : t('moveStart')}
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <button type="button" style={moveBtn} disabled={!canMove} onClick={() => onMoveBy(-1, 0)} aria-label={t('moveUp')}>
          ↑
        </button>
        <button type="button" style={moveBtn} disabled={!canMove} onClick={() => onMoveBy(1, 0)} aria-label={t('moveDown')}>
          ↓
        </button>
        <button type="button" style={moveBtn} disabled={!canMove} onClick={() => onMoveBy(0, -1)} aria-label={t('moveLeft')}>
          ←
        </button>
        <button type="button" style={moveBtn} disabled={!canMove} onClick={() => onMoveBy(0, 1)} aria-label={t('moveRight')}>
          →
        </button>
      </div>
    </section>
  );
}

/** Shown while a button is selected for moving; Escape or Cancel ends it. */
export function MoveModeBanner({ label, onCancel }: { label: string; onCancel: () => void }): React.ReactNode {
  const t = useTranslations('editor');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 16px',
        background: brand.surfaceTint,
        color: brand.onSurfaceTint,
        borderBottom: `1px solid ${brand.primaryStrong}`,
        fontSize: '0.875rem',
      }}
    >
      <span>{t('moveBanner', { label })}</span>
      <button type="button" onClick={onCancel} style={moveBtn}>
        {t('moveCancel')}
      </button>
    </div>
  );
}

const moveBtn: React.CSSProperties = {
  background: surface.overlay,
  color: neutral.text,
  border: `1px solid ${neutral.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  minWidth: 38,
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
};
