import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SignInControls } from '@/components/account-controls';
import { isAuthConfigured } from '@/lib/auth-env';
import { normalizeAuthRedirectPath } from '@/lib/auth-redirect';
import { brand, neutral, status, surface } from '@/lib/tokens';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Auth.js error codes that reach this page (`pages.error`); anything else is generic. */
const KNOWN_ERRORS = ['AccessDenied', 'Configuration', 'Verification'] as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactNode> {
  const t = await getTranslations('auth');
  const params = (await searchParams) ?? {};
  const redirectTo = normalizeAuthRedirectPath(
    firstParam(params.redirect_to) ?? firstParam(params.callbackUrl),
  );
  const configured = isAuthConfigured();

  // A valid session goes straight to the app. Switching accounts happens from
  // there, or from the controls below once that session has ended.
  if (configured && (await auth())) {
    redirect(redirectTo);
  }

  const rawError = firstParam(params.error);
  let errorMessage: string | null = null;
  if (rawError) {
    errorMessage = (KNOWN_ERRORS as readonly string[]).includes(rawError)
      ? t(`errors.${rawError as (typeof KNOWN_ERRORS)[number]}`)
      : t('errors.generic');
  }

  const primaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 8,
    border: 'none',
    background: brand.primary,
    color: surface.white,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 48,
  };
  const secondaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 8,
    border: `1px solid ${neutral.border}`,
    background: 'transparent',
    color: neutral.text,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 48,
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: surface.base,
        color: neutral.text,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          border: `1px solid ${neutral.border}`,
          borderRadius: 12,
          padding: 24,
          background: surface.raised,
        }}
      >
        <h1 style={{ marginTop: 0 }}>{t('title')}</h1>
        <p style={{ color: neutral.muted }}>{t('subtitle')}</p>
        {errorMessage ? (
          <p role="alert" style={{ color: status.danger }}>
            {errorMessage}
          </p>
        ) : null}
        {configured ? (
          <>
            <SignInControls
              redirectTo={redirectTo}
              primaryStyle={primaryStyle}
              secondaryStyle={secondaryStyle}
            />
            <p style={{ color: neutral.muted, fontSize: '0.875rem', marginBottom: 0 }}>{t('sharedDeviceHint')}</p>
          </>
        ) : (
          <p role="status" style={{ color: status.warning }}>
            {t('oidcNotConfigured')}
          </p>
        )}
      </section>
    </main>
  );
}
