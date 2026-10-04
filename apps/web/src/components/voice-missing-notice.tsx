'use client';

import { useTranslations } from 'next-intl';
import { brand, neutral, surface } from '@/lib/tokens';

interface VoiceMissingNoticeProps {
  /** The voice Voxa speaks with now; null when only the browser default is left. */
  fallbackName: string | null;
  onDismiss: () => void;
}

/** Shown once when the voice chosen on this device is no longer installed. */
export function VoiceMissingNotice({ fallbackName, onDismiss }: VoiceMissingNoticeProps): React.ReactNode {
  const t = useTranslations('voice');
  return (
    <div
      role="status"
      data-voxa-voice-missing=""
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: brand.surfaceTint,
        color: brand.onSurfaceTint,
        fontSize: '0.875rem',
      }}
    >
      <span style={{ flex: 1, minWidth: 200 }}>
        {fallbackName ? t('missingNotice', { fallback: fallbackName }) : t('missingNoticeDefault')}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: surface.overlay,
          color: surface.white,
          border: `1px solid ${neutral.border}`,
          borderRadius: 6,
          padding: '6px 12px',
          minWidth: 38,
          minHeight: 38,
          cursor: 'pointer',
        }}
      >
        {t('dismiss')}
      </button>
    </div>
  );
}
