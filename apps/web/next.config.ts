import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Static security headers on every response (A-005). The per-request
 * Content-Security-Policy is set in src/middleware.ts (it needs a nonce).
 * Camera and microphone stay available to this origin only: recorded speech
 * (GLP) captures audio and video. Everything else is off. Guarded by
 * src/next-config.test.ts.
 */
export const STATIC_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: [
      'camera=(self)',
      'microphone=(self)',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'serial=()',
      'bluetooth=()',
      'hid=()',
      'midi=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'display-capture=()',
      'browsing-topics=()',
    ].join(', '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: STATIC_SECURITY_HEADERS }];
  },
  transpilePackages: [
    '@voxa/core',
    '@voxa/i18n',
    '@voxa/ui',
    '@voxa/vocabulary',
    '@voxa/sync',
    '@voxa/access',
    '@voxa/ai',
  ],
  // GHSA-2xp9-vwfh-vxw4 defence in depth: nothing in this app imports
  // next/image (pictograms render as plain <img> tags), so Next's built-in
  // optimizer is off and /_next/image answers 404. The allow-list is exact and
  // empty so re-enabling optimization later cannot turn the app into an open
  // image proxy. Guarded by src/next-config.test.ts, the CI standalone check
  // and scripts/launch/verify-prod-image-optimizer.sh after each deploy.
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
