'use client';

import { forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DISCOVERY_CALL_URL } from '@/lib/pricing';
import { brand, neutral, status, surface } from '@/lib/tokens';

export type DemoCallToActionVariant = 'parent' | 'institution' | 'feature';

export interface DemoCallToActionProps {
  variant: DemoCallToActionVariant;
  title: string;
  body: string;
  onDismiss: () => void;
  signInHref?: string;
}

/**
 * The public demo's call to action. Communication is never blocked: this is
 * a region in the page flow below the board, not a dialog. It never covers
 * the board or the message bar, never takes focus on its own, and every
 * control in it is an ordinary link or button (keyboard and key-emulating
 * switches reach it with Tab). Escape or «Keep exploring» dismisses it.
 * Paid-plan intent goes to the discovery call.
 *
 * The forwarded ref is the heading (focusable with tabIndex -1), so a caller
 * that opened it on the visitor's request can move focus there.
 */
export const DemoCallToAction = forwardRef<HTMLHeadingElement, DemoCallToActionProps>(function DemoCallToAction(
  { variant, title, body, onDismiss, signInHref = '/auth/signin?redirect_to=%2Fapp' },
  headingRef,
) {
  const t = useTranslations('gate');

  const eyebrow =
    variant === 'institution'
      ? t('institutionEyebrow')
      : variant === 'parent'
        ? t('parentEyebrow')
        : t('featureEyebrow');

  return (
    <section
      aria-labelledby="demo-cta-title"
      data-voxa-demo-cta={variant}
      style={regionStyle}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <p
          style={{
            margin: '0 0 6px',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: variant === 'institution' ? status.warning : brand.link,
          }}
        >
          {eyebrow}
        </p>
        <h2 id="demo-cta-title" ref={headingRef} tabIndex={-1} style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>
          {title}
        </h2>
        <p style={{ margin: 0, color: neutral.muted, lineHeight: 1.6 }}>{body}</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {variant === 'institution' ? (
          <a href={DISCOVERY_CALL_URL} rel="noopener" style={btnPrimary}>
            {t('requestDemo')}
          </a>
        ) : (
          <Link href={signInHref} style={btnPrimary}>
            {t('createAccount')}
          </Link>
        )}
        {variant !== 'institution' ? (
          <a href={DISCOVERY_CALL_URL} rel="noopener" style={btnSecondary}>
            {t('representInstitution')}
          </a>
        ) : null}
        <button type="button" onClick={onDismiss} style={{ ...btnSecondary, background: surface.overlay }}>
          {t('keepExploring')}
        </button>
      </div>
    </section>
  );
});

const regionStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: 0,
  padding: '20px 24px',
  background: surface.raised,
  borderTop: `1px solid ${neutral.border}`,
  color: neutral.text,
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: brand.primary,
  color: surface.white,
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: 'transparent',
  border: `1px solid ${neutral.disabled}`,
  color: neutral.borderLight,
};
