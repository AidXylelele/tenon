import path from "node:path";
import type { NextConfig } from "next";
import {
  ACCOUNT_HREF,
  NOTIFICATIONS_HREF,
  PEOPLE_HREF,
  SETTINGS_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
} from "./src/libs/routing/routes";

const monorepoRoot = path.join(__dirname, "../..");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
];

const workerHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'; connect-src 'self'",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
    rules: {
      "*.wasm": { type: "asset" },
      "*.yaml": { type: "raw" },
    },
  },
  poweredByHeader: false,
  agentRules: false,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/_next/static/chunks/:file*", headers: workerHeaders },
    ];
  },
  redirects() {
    return [
      { source: SETTINGS_HREF, destination: ACCOUNT_HREF, permanent: false },
      { source: "/connections", destination: WEBHOOKS_HREF, permanent: true },
      {
        source: "/connections/webhooks",
        destination: WEBHOOKS_HREF,
        permanent: true,
      },
      {
        source: "/connections/test-event",
        destination: TEST_EVENT_HREF,
        permanent: true,
      },
      {
        source: "/connections/notifications/:path*",
        destination: `${NOTIFICATIONS_HREF}/:path*`,
        permanent: true,
      },
      {
        source: "/settings/invitations",
        destination: PEOPLE_HREF,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
