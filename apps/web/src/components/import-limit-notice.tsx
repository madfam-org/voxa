'use client';

import { useTranslations } from 'next-intl';
import { neutral, status, surface } from '@/lib/tokens';

interface ImportLimitNoticeProps {
  /** Boards the plan allows, when the API said so. */
  limit?: number;
  /** The board on screen can be deleted by this user (not the shared demo board). */
  canDelete: boolean;
  busy: boolean;
  onExportObf: () => void;
  onExportObz: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const actionBtn: React.CSSProperties = {
  background: surface.overlay,
  color: status.warningText,
  border: `1px solid ${status.warningBorder}`,
  borderRadius: 8,
  padding: '8px 12px',
  minHeight: 38,
  cursor: 'pointer',
  fontWeight: 600,
};

/**
 * Shown when an import answers 402: imports always create a new board, and
 * the plan's board limit is reached. Explains the limit and offers what the
 * user can do now: export the board on screen (OBF/OBZ) and delete a board
 * they no longer need. Plan limits themselves are a pricing decision.
 */
export function ImportLimitNotice({
  limit,
  canDelete,
  busy,
  onExportObf,
  onExportObz,
  onDelete,
  onClose,
}: ImportLimitNoticeProps): React.ReactNode {
  const t = useTranslations('communicator');
  return (
    <div
      role="alert"
      data-voxa-import-limit=""
      style={{
        background: status.warningFill,
        color: status.warningText,
        borderBottom: `1px solid ${neutral.border}`,
        padding: '10px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <p style={{ margin: 0, flex: '1 1 320px' }}>
        {limit === undefined ? t('importBoardLimitUnknown') : t('importBoardLimit', { limit })}{' '}
        {t('importBoardLimitHelp')}
      </p>
      <button type="button" onClick={onExportObf} disabled={busy} style={actionBtn}>
        {t('exportObf')}
      </button>
      <button type="button" onClick={onExportObz} disabled={busy} style={actionBtn}>
        {t('exportObz')}
      </button>
      {canDelete ? (
        <button type="button" onClick={onDelete} disabled={busy} style={actionBtn}>
          {t('importBoardLimitDelete')}
        </button>
      ) : null}
      <button type="button" onClick={onClose} style={actionBtn}>
        {t('importBoardLimitClose')}
      </button>
    </div>
  );
}
