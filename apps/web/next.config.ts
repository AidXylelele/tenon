import path from "node:path";
import type { NextConfig } from "next";
import {
  ACCOUNT_HREF,
  CONNECTIONS_HREF,
  SETTINGS_HREF,
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
      {
        source: CONNECTIONS_HREF,
        destination: WEBHOOKS_HREF,
        permanent: false,
      },
      { source: SETTINGS_HREF, destination: ACCOUNT_HREF, permanent: false },
    ];
  },
};

export default nextConfig;
