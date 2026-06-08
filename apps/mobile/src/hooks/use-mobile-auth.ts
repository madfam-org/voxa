import { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  clearMobileSession,
  getOidcConfig,
  isOidcConfigured,
  loadMobileSession,
  saveMobileSession,
  type MobileSession,
} from '@/lib/auth';

WebBrowser.maybeCompleteAuthSession();

export function useMobileAuth() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const { issuer, clientId } = getOidcConfig();
  const configured = isOidcConfigured();

  const discovery = AuthSession.useAutoDiscovery(issuer);
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'voxa', path: 'auth/callback' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: configured ? clientId : 'voxa-mobile-unconfigured',
      redirectUri,
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    void loadMobileSession().then((stored) => {
      setSession(stored);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (response?.type !== 'success' || !discovery || !request?.codeVerifier) return;

    void (async () => {
      try {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code: response.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier ?? '' },
          },
          discovery,
        );

        let userId = 'mobile-user';
        let email: string | undefined;
        let name: string | undefined;

        if (tokenResult.accessToken) {
          try {
            const profile = await AuthSession.fetchUserInfoAsync(
              { accessToken: tokenResult.accessToken },
              discovery,
            );
            userId = profile.sub ?? userId;
            email = profile.email ?? undefined;
            name = profile.name ?? profile.preferred_username ?? undefined;
          } catch {
            /* userinfo optional */
          }
        }

        const nextSession: MobileSession = {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          userId,
          email,
          name,
          expiresAt: Math.floor(Date.now() / 1000) + (tokenResult.expiresIn ?? 3600),
        };
        await saveMobileSession(nextSession);
        setSession(nextSession);
      } catch {
        /* sign-in failed — user can retry */
      }
    })();
  }, [clientId, discovery, redirectUri, request?.codeVerifier, response]);

  const signIn = useCallback(async () => {
    if (!configured) return;
    await promptAsync();
  }, [configured, promptAsync]);

  const signOut = useCallback(async () => {
    await clearMobileSession();
    setSession(null);
  }, []);

  return {
    session,
    loading,
    configured,
    signIn,
    signOut,
    accessToken: session?.accessToken,
    userId: session?.userId ?? 'mobile-user',
    isAuthenticated: Boolean(session?.accessToken),
  };
}
