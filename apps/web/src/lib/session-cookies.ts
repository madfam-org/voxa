/**
 * Small cookie helpers for server code that has to see the session the way
 * the browser will after this response (a refreshed session is written as
 * Set-Cookie on the same response that uses it).
 */
export function parseCookieHeader(header: string | null | undefined): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (name) jar.set(name, part.slice(index + 1).trim());
  }
  return jar;
}

export function serializeCookieJar(jar: Map<string, string>): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

/** Applies Set-Cookie lines to a jar: new values replace, expired ones are removed. */
export function applySetCookies(
  jar: Map<string, string>,
  setCookies: string[],
  now = Date.now(),
): Map<string, string> {
  const next = new Map(jar);
  for (const line of setCookies) {
    const [pair, ...attributes] = line.split(';');
    const index = pair?.indexOf('=') ?? -1;
    if (!pair || index <= 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    let expired = value === '';
    for (const attribute of attributes) {
      const [rawKey, ...rest] = attribute.split('=');
      const key = rawKey?.trim().toLowerCase();
      const attrValue = rest.join('=').trim();
      if (key === 'max-age' && Number(attrValue) <= 0) expired = true;
      if (key === 'expires') {
        const at = Date.parse(attrValue);
        if (Number.isFinite(at) && at <= now) expired = true;
      }
    }
    if (expired) next.delete(name);
    else next.set(name, value);
  }
  return next;
}

/** The session cookie and its chunks (`name`, `name.0`, `name.1`, …) present in a jar. */
export function sessionCookieNames(jar: Map<string, string>, cookieName: string): string[] {
  return [...jar.keys()].filter((name) => name === cookieName || name.startsWith(`${cookieName}.`));
}

/** Set-Cookie lines that delete the session cookie and every chunk of it. */
export function expireSessionCookies(
  jar: Map<string, string>,
  cookieName: string,
  secure: boolean,
): string[] {
  const names = new Set([cookieName, ...sessionCookieNames(jar, cookieName)]);
  return [...names].map(
    (name) =>
      `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
  );
}
