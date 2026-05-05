import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  turbopack: {},
};

export default nextConfig;