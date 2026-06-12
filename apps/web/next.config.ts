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
};

export default withNextIntl(nextConfig);
