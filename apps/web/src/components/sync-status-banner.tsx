'use client';

import { useTranslations } from 'next-intl';

export type SyncConnectionStatus = 'offline' | 'connecting' | 'live';

interface SyncStatusBannerProps {
  syncStatus: SyncConnectionStatus;
  pendingSave: boolean;
  syncError: string | null;
  error: string | null;
  conflictRefreshed: boolean;
  warnings?: string[];
  isEditor: boolean;
  onRetry?: () => void;
  onDismissConflict?: () => void;
}

export function SyncStatusBanner({
  syncStatus,
  pendingSave,
  syncError,
  error,
  conflictRefreshed,
  warnings = [],
  isEditor,
  onRetry,
  onDismissConflict,
}: SyncStatusBannerProps): React.ReactNode {
  const t = useTranslations('sync');

  const showConnecting = syncStatus === 'connecting';
  const showOffline = syncStatus === 'offline';
  const showPending = pendingSave;
  const showSyncError = Boolean(syncError) && !conflictRefreshed;
  const showConflict = conflictRefreshed;
  const showWarnings = warnings.length > 0;

  if (!showConnecting && !showOffline && !showPending && !showSyncError && !showConflict && !showWarnings && !error) {
    return null;
  }

  const background = showConflict
    ? '#172554'
    : showOffline || showPending
      ? '#422006'
      : showConnecting
        ? '#1e293b'
        : '#171717';

  const color = showConflict ? '#bfdbfe' : '#fcd34d';

  let message = '';
  if (showConflict) {
    message = t('conflict');
  } else if (showOffline && error) {
    message = error;
  } else if (showOffline) {
    message = t('offlineError');
  } else if (showConnecting) {
    message = t('connecting');
  }
  if (showPending) {
    message = message ? `${message} ${t('queuedSuffix')}` : t('queuedSuffix');
  }
  if (showSyncError && syncError) {
    message = message ? `${message} ${syncError}` : syncError;
  }
  if (showWarnings) {
    const warningText = t('obfWarnings', { warnings: warnings.join('; ') });
    message = message ? `${message} ${warningText}` : warningText;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background,
        color,
        padding: '8px 16px',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ flex: '1 1 220px' }}>{message}</span>
      {showConflict && onDismissConflict ? (
        <button
          type="button"
          onClick={onDismissConflict}
          style={{
            background: 'transparent',
            color: '#93c5fd',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          {t('dismiss')}
        </button>
      ) : null}
      {(showPending || showSyncError) && isEditor && onRetry ? (
        <button
          type="button"
          onClick={() => void onRetry()}
          style={{
            background: '#262626',
            color: '#f5f5f5',
            border: '1px solid #404040',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          {t('retry')}
        </button>
      ) : null}
    </div>
  );
}
