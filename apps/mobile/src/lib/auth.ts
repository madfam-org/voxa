import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'voxa-mobile-session';

export interface MobileSession {
  accessToken: string;
  refreshToken?: string;
  userId: string;
  email?: string;
  name?: string;
  expiresAt: number;
}

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

export async function loadMobileSession(): Promise<MobileSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as MobileSession;
    if (session.expiresAt * 1000 < Date.now()) {
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
