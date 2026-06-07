import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@voxa/core', '@voxa/ui', '@voxa/vocabulary', '@voxa/sync', '@voxa/access'],
};

export default nextConfig;
