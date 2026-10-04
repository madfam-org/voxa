/**
 * Sign-in stays on the host the browser used, with the standalone server bound
 * to 0.0.0.0 as in production (2026-10-04 incident: every Janua callback
 * redirected to https://0.0.0.0:3000/auth/signin?error=Configuration).
 *
 * For every host the k8s web manifests allow-list (AUTH_PUBLIC_HOSTS), it
 * requests `/api/auth/providers`, an anonymous `/api/auth/callback/janua` and
 * the signed-out `/app` gate with that `Host` (and the forwarded headers the
 * tunnel sends), and asserts that no body or `Location` header names 0.0.0.0
 * and that the Auth.js URLs are on that host. A host outside the allow-list
 * must answer 400 and never appear in a URL.
 *
 * Runs only against a local server (the CI a11y job starts it with
 * AUTH_PUBLIC_HOSTS = loopback + the manifests' hosts): it forges Host headers,
 * which a shared deployment must never receive from tests.
 */
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const BASE_URL = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000');
const IS_LOCAL = ['127.0.0.1', 'localhost', '[::1]'].includes(BASE_URL.hostname);

/** AUTH_PUBLIC_HOSTS of the production and staging web manifests. */
function manifestHosts(): string[] {
  const hosts: string[] = [];
  for (const env of ['production', 'staging']) {
    const file = path.resolve(__dirname, '../../k8s', env, 'voxa-web-deployment.yaml');
    const match = /name: AUTH_PUBLIC_HOSTS\s*\n\s*value:\s*"([^"]+)"/.exec(readFileSync(file, 'utf8'));
    if (!match) throw new Error(`AUTH_PUBLIC_HOSTS missing in ${file}`);
    hosts.push(...(match[1] ?? '').split(',').map((h) => h.trim()).filter(Boolean));
  }
  return hosts;
}

interface Answer {
  status: number;
  location: string | null;
  body: string;
}

/** GET on the local server with exactly these headers (Host included); redirects are not followed. */
function get(pathname: string, headers: Record<string, string>): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: BASE_URL.hostname, port: BASE_URL.port || 80, path: pathname, method: 'GET', headers },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, location: (res.headers.location as string | undefined) ?? null, body }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout: ${pathname}`)));
    req.end();
  });
}

function expectNoBindAddress(answer: Answer, what: string): void {
  expect(answer.body, `${what}: body`).not.toContain('0.0.0.0');
  expect(answer.location ?? '', `${what}: Location`).not.toContain('0.0.0.0');
}

test.describe('Auth.js public origin (server bound to 0.0.0.0)', () => {
  test.skip(!IS_LOCAL, 'forges Host headers: local standalone server only');

  const hosts = manifestHosts();

  test('the manifests allow-list the landing and app host of each environment', () => {
    expect(hosts).toEqual(
      expect.arrayContaining([
        'voxa.madfam.io',
        'voxa-app.madfam.io',
        'voxa-staging.madfam.io',
        'voxa-app-staging.madfam.io',
      ]),
    );
  });

  for (const host of hosts) {
    test(`sign-in URLs stay on ${host}`, async () => {
      const tunnel = { Host: host, 'X-Forwarded-Host': host, 'X-Forwarded-Proto': 'https' };

      const providers = await get('/api/auth/providers', tunnel);
      expect(providers.status).toBe(200);
      expectNoBindAddress(providers, 'providers');
      const body = JSON.parse(providers.body) as Record<string, { callbackUrl?: string } | undefined>;
      expect(body.janua?.callbackUrl).toBe(`https://${host}/api/auth/callback/janua`);

      const callback = await get('/api/auth/callback/janua?code=x&state=y', tunnel);
      expectNoBindAddress(callback, 'callback');
      expect([302, 303]).toContain(callback.status);
      expect(new URL(callback.location ?? '', `https://${host}`).origin).toBe(`https://${host}`);
      expect(callback.location).toMatch(new RegExp(`^https://${host.replace(/\./g, '\\.')}/auth/signin\\?error=`));

      // Host alone (no forwarded headers): still never the bind address.
      const hostOnly = await get('/api/auth/providers', { Host: host });
      expect(hostOnly.status).toBe(200);
      expectNoBindAddress(hostOnly, 'providers (Host only)');
      const hostOnlyBody = JSON.parse(hostOnly.body) as Record<string, { callbackUrl?: string } | undefined>;
      expect(new URL(hostOnlyBody.janua?.callbackUrl ?? 'x:').host).toBe(host);

      // The signed-out gate redirect (middleware) stays on this host too.
      const gate = await get('/app', tunnel);
      expectNoBindAddress(gate, '/app gate');
      expect([302, 303, 307, 308]).toContain(gate.status);
      expect(new URL(gate.location ?? '', `https://${host}`).host).toBe(host);
    });
  }

  test('a host outside the allow-list is never used', async () => {
    for (const host of ['attacker.example', '0.0.0.0:3000', 'voxa.madfam.io.attacker.example']) {
      for (const pathname of ['/api/auth/providers', '/api/auth/callback/janua?code=x&state=y']) {
        const answer = await get(pathname, { Host: host, 'X-Forwarded-Host': host, 'X-Forwarded-Proto': 'https' });
        expect(answer.status, `${pathname} on ${host}`).toBe(400);
        expect(answer.location).toBeNull();
        expect(answer.body).not.toContain(host);
      }
    }
  });
});
