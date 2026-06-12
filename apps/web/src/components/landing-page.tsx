'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SiteFooter, SiteNav } from '@/components/site-chrome';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { formatMxn, PRICING, clinicListMonthly } from '@/lib/pricing';

const section: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '64px 24px',
};

const card: React.CSSProperties = {
  background: '#171717',
  border: '1px solid #333',
  borderRadius: 16,
  padding: 24,
};

const FEATURE_KEYS = ['motor', 'cvi', 'ai', 'obf', 'offline', 'janua'] as const;

export function LandingPage(): React.ReactNode {
  const t = useTranslations('landing');
  const familyMonthly = formatMxn(PRICING.family.monthly);
  const familyAnnual = formatMxn(PRICING.family.annual);
  const clinicFrom = formatMxn(clinicListMonthly());

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fafafa' }}>
      <SiteNav active="home" />

      {/* Hero */}
      <section
        style={{
          ...section,
          paddingTop: 48,
          paddingBottom: 48,
          display: 'grid',
          gap: 40,
          alignItems: 'center',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 12px',
              color: '#93c5fd',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontSize: '0.8125rem',
            }}
          >
            {t('heroEyebrow')}
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}>
            {t('heroTitle')}
          </h1>
          <p style={{ margin: '0 0 28px', color: '#a3a3a3', fontSize: '1.125rem', lineHeight: 1.65, maxWidth: 540 }}>
            {t('heroBody')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link href="/demo" style={primaryCta}>
              {t('tryDemo')}
            </Link>
            <Link href="/auth/signin?redirect_to=%2Fapp" style={secondaryCta}>
              {t('signInFree')}
            </Link>
          </div>
          <PwaInstallBanner />
        </div>
        <div style={{ ...card, background: 'linear-gradient(145deg, #1e3a5f 0%, #171717 60%)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.125rem' }}>{t('whyChangingTitle')}</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#d4d4d4', lineHeight: 1.7 }}>
            <li>{t('whyChangingList1')}</li>
            <li>{t('whyChangingList2')}</li>
            <li>{t('whyChangingList3')}</li>
            <li>{t('whyChangingList4')}</li>
          </ul>
          <p style={{ margin: '16px 0 0', fontSize: '0.875rem', color: '#93c5fd' }}>
            {t('whyChangingNote')}
          </p>
        </div>
      </section>

      {/* Why AAC deep dive */}
      <section id="why-aac" style={{ background: '#111', borderBlock: '1px solid #262626' }}>
        <div style={section}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1.75rem' }}>{t('humanRightTitle')}</h2>
          <p style={{ margin: '0 0 32px', color: '#a3a3a3', maxWidth: 720, lineHeight: 1.65 }}>
            {t('humanRightBody')}
          </p>
          <div
            style={{
              display: 'grid',
              gap: 20,
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            {FEATURE_KEYS.map((key) => (
              <div key={key} style={card}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.0625rem' }}>{t(`features.${key}.title`)}</h3>
                <p style={{ margin: 0, color: '#a3a3a3', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                  {t(`features.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section style={section}>
        <div
          style={{
            ...card,
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            alignItems: 'center',
            borderColor: '#2563eb',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>{t('demoCtaTitle')}</h2>
            <p style={{ margin: 0, color: '#a3a3a3', lineHeight: 1.6 }}>{t('demoCtaBody')}</p>
          </div>
          <Link href="/demo" style={{ ...primaryCta, textAlign: 'center', justifyContent: 'center' }}>
            {t('openDemo')}
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: '#111', borderBlock: '1px solid #262626' }}>
        <div style={section}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.75rem', textAlign: 'center' }}>{t('pricingTitle')}</h2>
          <p style={{ margin: '0 0 40px', textAlign: 'center', color: '#a3a3a3' }}>
            {t('pricingSubtitle')}
          </p>
          <div
            style={{
              display: 'grid',
              gap: 24,
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            }}
          >
            <div style={{ ...card, borderColor: '#2563eb' }}>
              <p style={{ margin: '0 0 4px', color: '#93c5fd', fontWeight: 700, fontSize: '0.8125rem' }}>
                {t('parentsLabel')}
              </p>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>{t('free')}</h3>
              <p style={{ margin: '0 0 4px', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {t('priceFree')}
              </p>
              <p style={{ margin: '0 0 16px', color: '#737373', fontSize: '0.8125rem' }}>{t('priceIvaNote')}</p>
              <p style={{ margin: '0 0 16px', color: '#a3a3a3', fontSize: '0.9375rem' }}>
                {t('parentsBody')}
              </p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: '#d4d4d4', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                <li>{t('parentsLi1')}</li>
                <li>{t('parentsLi2')}</li>
                <li>{t('parentsLi3')}</li>
                <li>{t('parentsLi4')}</li>
              </ul>
              <Link href="/auth/signin?redirect_to=%2Fapp" style={primaryCta}>
                {t('createAccount')}
              </Link>
            </div>
            <div style={card}>
              <p style={{ margin: '0 0 4px', color: '#a3a3a3', fontWeight: 700, fontSize: '0.8125rem' }}>
                {t('familyLabel')}
              </p>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>{t('family')}</h3>
              <p style={{ margin: '0 0 4px', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {familyMonthly}
                <span style={{ fontSize: '1rem', fontWeight: 600, color: '#a3a3a3' }}>{t('pricePerMonth')}</span>
              </p>
              <p style={{ margin: '0 0 16px', color: '#737373', fontSize: '0.8125rem' }}>
                {t('priceAnnualOption', { annual: familyAnnual })}
                {' · '}
                {t('priceIvaNote')}
              </p>
              <p style={{ margin: '0 0 16px', color: '#a3a3a3', fontSize: '0.9375rem' }}>{t('familyBody')}</p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: '#d4d4d4', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                <li>{t('familyLi1')}</li>
                <li>{t('familyLi2')}</li>
                <li>{t('familyLi3')}</li>
              </ul>
              <Link href="/auth/signin?redirect_to=%2Fapp%3Fupgrade%3Dfamily" style={secondaryCta}>
                {t('signInUpgrade')}
              </Link>
            </div>
            <div id="institutions" style={{ ...card, borderColor: '#ca8a04' }}>
              <p style={{ margin: '0 0 4px', color: '#fbbf24', fontWeight: 700, fontSize: '0.8125rem' }}>
                {t('instLabel')}
              </p>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>{t('institutional')}</h3>
              <p style={{ margin: '0 0 4px', fontSize: '1.625rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fde68a' }}>
                {t('priceFrom')} {clinicFrom}
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#a3a3a3' }}>{t('pricePerMonth')}</span>
              </p>
              <p style={{ margin: '0 0 16px', color: '#737373', fontSize: '0.8125rem' }}>
                {t('priceClinicDetail')}
                {' · '}
                {t('priceIvaNote')}
              </p>
              <p style={{ margin: '0 0 16px', color: '#a3a3a3', fontSize: '0.9375rem' }}>{t('instBody')}</p>
              <ul style={{ margin: '0 0 20px', paddingLeft: 18, color: '#d4d4d4', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                <li>{t('instLi1')}</li>
                <li>{t('instLi2')}</li>
                <li>{t('instLi3')}</li>
                <li>{t('instLi4')}</li>
              </ul>
              <a
                href="mailto:hello@madfam.io?subject=Voxa%20institutional%20plan"
                style={{ ...secondaryCta, borderColor: '#ca8a04', color: '#fde68a' }}
              >
                {t('contactSales')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Conversion footer CTA */}
      <section style={{ ...section, textAlign: 'center', paddingBottom: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.75rem' }}>{t('footerCtaTitle')}</h2>
        <p style={{ margin: '0 0 24px', color: '#a3a3a3', maxWidth: 560, marginInline: 'auto', lineHeight: 1.6 }}>
          {t('footerCtaBody')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/demo" style={primaryCta}>
            {t('tryDemoShort')}
          </Link>
          <Link href="/app" style={secondaryCta}>
            {t('openMyCommunicator')}
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const primaryCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '14px 22px',
  borderRadius: 10,
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  textDecoration: 'none',
  fontSize: '1rem',
};

const secondaryCta: React.CSSProperties = {
  ...primaryCta,
  background: 'transparent',
  border: '1px solid #404040',
  color: '#e5e5e5',
};
