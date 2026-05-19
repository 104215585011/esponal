import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // msedge-tts ships a bundled `ws` whose `bufferutil` mask helper breaks
  // when Next.js / SWC re-bundles it for serverless. Mark both as external
  // so the runtime loads them straight from node_modules and the WebSocket
  // mask function stays intact.
  experimental: {
    serverComponentsExternalPackages: ["msedge-tts", "ws"]
  }
};

export default withSentryConfig(
  nextConfig,
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true
  },
  {
    hideSourceMaps: true,
    disableLogger: true
  }
);
