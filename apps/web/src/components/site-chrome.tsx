'use client';

import { Link } from '@/i18n/navigation';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslations } from 'next-intl';

const navLink: React.CSSProperties = {
  color: '#d4d4d4',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: '0.9375rem',
};

export function SiteNav({ active }: { active?: 'home' | 'demo' | 'app' }): React.ReactNode {
  const t = useTranslations('nav');
  const tc = useTranslations('common');

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 24px',
        borderBottom: '1px solid #262626',
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Link href="/" style={{ color: '#fafafa', fontWeight: 800, fontSize: '1.25rem', textDecoration: 'none' }}>
        {tc('brand')}
      </Link>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <Link href="/#why-aac" style={{ ...navLink, opacity: active === 'home' ? 1 : 0.85 }}>
          {t('whyAac')}
        </Link>
        <Link href="/demo" style={{ ...navLink, color: active === 'demo' ? '#93c5fd' : navLink.color }}>
          {t('liveDemo')}
        </Link>
        <Link href="/#pricing" style={navLink}>
          {t('pricing')}
        </Link>
        <LanguageSwitcher compact />
        <PwaInstallBanner compact />
        <Link
          href="/auth/signin?redirect_to=%2Fapp"
          style={{
            ...navLink,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #404040',
          }}
        >
          {t('signIn')}
        </Link>
        <Link
          href="/app"
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: '0.9375rem',
          }}
        >
          {t('openCommunicator')}
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter(): React.ReactNode {
  const t = useTranslations('nav');

  return (
    <footer
      style={{
        padding: '32px 24px 48px',
        borderTop: '1px solid #262626',
        background: '#0a0a0a',
        color: '#a3a3a3',
        fontSize: '0.875rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'space-between',
        maxWidth: 1100,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.6 }}>{t('footerTagline')}</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/legal/privacy" style={{ color: '#93c5fd' }}>
          {t('privacy')}
        </Link>
        <Link href="/legal/terms" style={{ color: '#93c5fd' }}>
          {t('terms')}
        </Link>
        <Link href="/legal/accessibility" style={{ color: '#93c5fd' }}>
          {t('accessibility')}
        </Link>
      </div>
    </footer>
  );
}
