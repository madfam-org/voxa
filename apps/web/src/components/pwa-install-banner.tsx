'use client';

import { useTranslations } from 'next-intl';
import { usePwaInstall } from '@/hooks/use-pwa-install';

interface PwaInstallBannerProps {
  compact?: boolean;
}

export function PwaInstallBanner({ compact = false }: PwaInstallBannerProps): React.ReactNode {
  const t = useTranslations('pwa');
  const { canInstall, promptInstall, dismiss } = usePwaInstall();

  if (!canInstall) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid #404040',
          background: '#171717',
          color: '#e5e5e5',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        {t('installApp')}
      </button>
    );
  }

  return (
    <aside
      role="region"
      aria-label={t('ariaLabel')}
      style={{
        marginTop: 20,
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid #1d4ed8',
        background: 'linear-gradient(135deg, #172554 0%, #111827 100%)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: '1 1 220px' }}>
        <strong style={{ display: 'block', marginBottom: 4, color: '#dbeafe' }}>{t('title')}</strong>
        <span style={{ color: '#93c5fd', fontSize: '0.875rem', lineHeight: 1.5 }}>{t('body')}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void promptInstall()} style={primaryBtn}>
          {t('install')}
        </button>
        <button type="button" onClick={dismiss} style={secondaryBtn}>
          {t('notNow')}
        </button>
      </div>
    </aside>
  );
}

const primaryBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#93c5fd',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '10px 16px',
  fontWeight: 600,
  cursor: 'pointer',
};
