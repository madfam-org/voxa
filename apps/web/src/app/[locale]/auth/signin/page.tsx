import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import {
  createOidcStateEnvelope,
  generatePkce,
  getAuthorizeUrl,
  getSession,
  isOidcConfigured,
  normalizeAuthRedirectPath,
  oidcTransientCookieAttrs,
} from '@/lib/auth';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactNode> {
  const t = await getTranslations('auth');
  const params = (await searchParams) ?? {};
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const redirectTo = normalizeAuthRedirectPath(firstParam(params?.redirect_to) || '/app');
  const configured = isOidcConfigured();
  const session = await getSession();

  if (session) {
    redirect(redirectTo);
  }

  const rawError = firstParam(params?.error);
  let errorMessage: string | null = null;
  if (rawError) {
    const known = [
      'missing_code_or_state',
      'token_exchange_failed',
      'state_mismatch',
      'id_token_verification_failed',
      'missing_tokens',
      'missing_required_claims',
      'invalid_token_expiry',
    ] as const;
    if ((known as readonly string[]).includes(rawError)) {
      errorMessage = t(`errors.${rawError as (typeof known)[number]}`);
    } else {
      errorMessage = t('errors.generic', { code: rawError });
    }
  }

  async function startSignIn(formData: FormData) {
    'use server';
    const nextRedirect = normalizeAuthRedirectPath(
      (formData.get('redirect_to') as string) || '/',
    );
    const { verifier, challenge } = await generatePkce();
    const oidcState = await createOidcStateEnvelope({
      verifier,
      redirectTo: nextRedirect,
    });

    const store = await cookies();
    store.set('voxa_pkce_verifier', verifier, oidcTransientCookieAttrs());
    store.set('voxa_oidc_state', oidcState.cookieValue, oidcTransientCookieAttrs());

    const url = await getAuthorizeUrl({
      redirectUri: `${baseUrl}/auth/callback`,
      state: oidcState.state,
      codeChallenge: challenge,
    });
    redirect(url);
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#0a0a0a',
        color: '#fafafa',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1px solid #404040',
          borderRadius: 12,
          padding: 24,
          background: '#171717',
        }}
      >
        <h1 style={{ marginTop: 0 }}>{t('title')}</h1>
        <p style={{ color: '#a3a3a3' }}>{t('subtitle')}</p>
        {errorMessage ? (
          <p role="alert" style={{ color: '#f87171' }}>
            {errorMessage}
          </p>
        ) : null}
        {configured ? (
          <form action={startSignIn}>
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <button
              type="submit"
              style={{
                width: '100%',
                marginTop: 12,
                padding: '12px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('continueJanua')}
            </button>
          </form>
        ) : (
          <p role="status" style={{ color: '#fbbf24' }}>
            {t('oidcNotConfigured')}
          </p>
        )}
      </section>
    </main>
  );
}
