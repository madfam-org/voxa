'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export type ConversionGateVariant = 'parent' | 'institution' | 'feature';

export interface ConversionGateProps {
  open: boolean;
  variant: ConversionGateVariant;
  title: string;
  body: string;
  onClose: () => void;
  signInHref?: string;
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 20px',
  borderRadius: 10,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: 'transparent',
  border: '1px solid #525252',
  color: '#e5e5e5',
};

export function ConversionGate({
  open,
  variant,
  title,
  body,
  onClose,
  signInHref = '/auth/signin?redirect_to=%2Fapp',
}: ConversionGateProps): React.ReactNode {
  const t = useTranslations('gate');

  if (!open) return null;

  const institutionHref =
    'mailto:hello@madfam.io?subject=Voxa%20institutional%20plan&body=Organization%20name%3A%0AExpected%20communicators%3A%0A';

  const eyebrow =
    variant === 'institution'
      ? t('institutionEyebrow')
      : variant === 'parent'
        ? t('parentEyebrow')
        : t('featureEyebrow');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conversion-gate-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.72)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#171717',
          border: '1px solid #404040',
          borderRadius: 16,
          padding: 28,
          color: '#fafafa',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: variant === 'institution' ? '#fbbf24' : '#93c5fd',
          }}
        >
          {eyebrow}
        </p>
        <h2 id="conversion-gate-title" style={{ margin: '0 0 12px', fontSize: '1.5rem' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 20px', color: '#a3a3a3', lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {variant === 'institution' ? (
            <a href={institutionHref} style={btnPrimary}>
              {t('requestDemo')}
            </a>
          ) : (
            <Link href={signInHref} style={btnPrimary}>
              {t('createAccount')}
            </Link>
          )}
          {variant !== 'institution' && (
            <Link href="/#institutions" style={btnSecondary} onClick={onClose}>
              {t('representInstitution')}
            </Link>
          )}
          <button type="button" onClick={onClose} style={{ ...btnSecondary, background: '#262626' }}>
            {t('keepExploring')}
          </button>
        </div>
      </div>
    </div>
  );
}
