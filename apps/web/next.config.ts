import type { NextConfig } from "next";

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? ["https://orqafy.powerbyte.app"]
    : process.env.NODE_ENV === "test"
      ? ["https://orqafy-staging.powerbyte.app"]
      : ["http://localhost:42951"];

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Turnstile requires challenges.cloudflare.com
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      // Turnstile iframe
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@orqafy/jobs", "@orqafy/db"],
  serverExternalPackages: [
    "@blocknote/core",
    "@react-pdf/renderer",
    "isomorphic-dompurify",
    "jsdom",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [];
  },
  // CORS handled in middleware.ts and tRPC context
  env: {
    ALLOWED_ORIGINS: allowedOrigins.join(","),
  },
  webpack: (config) => {
    // Workspace packages with "type": "module" use ESM .js extensions in source.
    // Map .js imports to .ts files so webpack resolves them in TS workspace packages.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
