import { cookies } from 'next/headers';
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

const SIGNIN_ERRORS: Record<string, string> = {
  missing_code_or_state: 'Sign-in could not be completed. Try again.',
  token_exchange_failed: 'Janua token exchange failed. Try again.',
  state_mismatch: 'Sign-in session expired. Try again.',
  id_token_verification_failed: 'Could not verify Janua identity token.',
  missing_tokens: 'Janua did not return required tokens.',
  missing_required_claims: 'Janua account is missing email or user id.',
  invalid_token_expiry: 'Janua returned an invalid session expiry.',
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactNode> {
  const params = (await searchParams) ?? {};
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const redirectTo = normalizeAuthRedirectPath(firstParam(params?.redirect_to) || '/app');
  const configured = isOidcConfigured();
  const session = await getSession();

  if (session) {
    redirect(redirectTo);
  }

  const rawError = firstParam(params?.error);
  const errorMessage = rawError
    ? SIGNIN_ERRORS[rawError] || `Authentication error: ${rawError}`
    : null;

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
        <h1 style={{ marginTop: 0 }}>Sign in to Voxa</h1>
        <p style={{ color: '#a3a3a3' }}>
          Use your MADFAM account (Janua) to sync boards and collaborate with your team.
        </p>
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
              Continue with Janua
            </button>
          </form>
        ) : (
          <p role="status" style={{ color: '#fbbf24' }}>
            OIDC is not configured. Set NEXT_PUBLIC_OIDC_ISSUER and NEXT_PUBLIC_OIDC_CLIENT_ID for
            production sign-in.
          </p>
        )}
      </section>
    </main>
  );
}
