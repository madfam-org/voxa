import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@voxa/core', '@voxa/ui', '@voxa/vocabulary'],
};

export default nextConfig;
