import type { MobileSession } from './session.js';

export function isSessionExpired(session: MobileSession, skewSeconds = 0): boolean {
  return session.expiresAt * 1000 <= Date.now() + skewSeconds * 1000;
}

export function isSessionExpiring(session: MobileSession, withinSeconds = 120): boolean {
  return isSessionExpired(session, withinSeconds);
}
