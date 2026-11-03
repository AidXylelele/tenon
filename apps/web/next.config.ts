import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.join(__dirname, '../..');

// The hardening headers of the constitution (Security requirements); the Content Security
// Policy carries a per-request nonce and is set in `src/proxy.ts`.
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: 'standalone',
  // Trace and resolve files from the monorepo root, not just apps/web.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  poweredByHeader: false,
  experimental: {
    // A workflow document is up to 1 MiB; actions carry it with some overhead.
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // The addresses of iteration 2, before Connections and Settings became pages with tabs
  // (research R15).
  async redirects() {
    return [
      {
        source: '/webhooks',
        destination: '/connections/webhooks',
        permanent: true,
      },
      {
        source: '/subscriptions',
        destination: '/connections/notifications',
        permanent: true,
      },
      {
        source: '/subscriptions/:path*',
        destination: '/connections/notifications/:path*',
        permanent: true,
      },
      {
        source: '/events',
        destination: '/connections/test-event',
        permanent: true,
      },
      { source: '/secrets', destination: '/credentials', permanent: true },
      { source: '/account', destination: '/settings/account', permanent: true },
      { source: '/team', destination: '/settings/team', permanent: true },
      {
        source: '/conformance',
        destination: '/settings/standard',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
