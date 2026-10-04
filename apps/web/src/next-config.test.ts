import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import nextConfig from '../next.config';

// Guards the Next.js image-optimizer posture (GHSA-2xp9-vwfh-vxw4 defence in
// depth). Nothing in apps/web imports next/image, so the optimizer is off and
// /_next/image answers 404. Widening the allow-list is a security decision:
// change it here, in next.config.ts and in AGENTS.md together.

const srcRoot = path.dirname(fileURLToPath(import.meta.url));

function filesImportingNextImage(dir: string): string[] {
  const offenders: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') offenders.push(...filesImportingNextImage(full));
    } else if (
      /\.(t|j)sx?$/.test(entry.name) &&
      /from\s+['"]next\/(legacy\/)?image['"]/.test(readFileSync(full, 'utf8'))
    ) {
      offenders.push(path.relative(srcRoot, full));
    }
  }
  return offenders;
}

describe('next.config images posture', () => {
  it('disables the built-in image optimizer', () => {
    assert.equal(nextConfig.images?.unoptimized, true);
  });

  it('keeps remotePatterns an exact, empty allow-list with no legacy domains', () => {
    assert.deepEqual(nextConfig.images?.remotePatterns, []);
    assert.equal(nextConfig.images?.domains, undefined);
  });

  it('has no source file importing next/image', () => {
    assert.deepEqual(
      filesImportingNextImage(srcRoot),
      [],
      'next/image was imported; revisit images.unoptimized before shipping',
    );
  });
});

describe('next.config security headers', () => {
  it('does not advertise the framework', () => {
    assert.equal(nextConfig.poweredByHeader, false);
  });

  it('sends HSTS, nosniff, referrer, frame and permissions headers on every path', async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === '/:path*');
    assert.ok(all, 'a rule for /:path* exists');
    const headers = new Map(all.headers.map((h) => [h.key.toLowerCase(), h.value]));
    assert.equal(headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(headers.get('x-frame-options'), 'DENY');
    const permissions = headers.get('permissions-policy') ?? '';
    assert.match(permissions, /(^|, )camera=\(self\)(,|$)/);
    assert.match(permissions, /(^|, )microphone=\(self\)(,|$)/);
    assert.match(permissions, /(^|, )geolocation=\(\)(,|$)/);
  });
});
