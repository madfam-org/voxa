import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { isSessionExpired, isSessionExpiring } from './session-expiry.js';
import type { MobileSession } from './session.js';

export type { MobileSession } from './session.js';
export { isSessionExpired, isSessionExpiring } from './session-expiry.js';

export function getOidcConfig(): { issuer: string; clientId: string } {
  const extra = Constants.expoConfig?.extra as
    | { oidcIssuer?: string; oidcClientId?: string }
    | undefined;
  return {
    issuer: extra?.oidcIssuer ?? 'https://auth.madfam.io',
    clientId: extra?.oidcClientId ?? '',
  };
}

export function isOidcConfigured(): boolean {
  return Boolean(getOidcConfig().clientId);
}

const SESSION_KEY = 'voxa-mobile-session';

export async function loadMobileSession(): Promise<MobileSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as MobileSession;
    if (isSessionExpired(session) && !session.refreshToken) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function saveMobileSession(session: MobileSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearMobileSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function refreshMobileSession(
  session: MobileSession,
  discovery: AuthSession.DiscoveryDocument,
): Promise<MobileSession | null> {
  if (!session.refreshToken) return null;

  const { clientId } = getOidcConfig();
  try {
    const tokenResult = await AuthSession.refreshAsync(
      {
        clientId,
        refreshToken: session.refreshToken,
      },
      discovery,
    );

    const nextSession: MobileSession = {
      ...session,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken ?? session.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + (tokenResult.expiresIn ?? 3600),
    };
    await saveMobileSession(nextSession);
    return nextSession;
  } catch {
    await clearMobileSession();
    return null;
  }
}
