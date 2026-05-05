import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        '@sparticuz/chromium',
        'puppeteer-core',
      ];
    }
    return config;
  },
};

export default nextConfig;