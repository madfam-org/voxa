import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
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
