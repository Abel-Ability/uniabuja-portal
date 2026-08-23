import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const cspDirectives = [
  "default-src 'self'",
  // Next.js injects inline scripts during dev (HMR) and production hydration.
  // 'unsafe-inline' is required for Next.js to function. 'unsafe-eval' is
  // only needed during development (HMR); production builds do not use eval.
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://drive.google.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.open-meteo.com",
  // Allow embedding the external admission application form (Google Apps
  // Script). Without frame-src, default-src 'self' would block it.
  "frame-src https://script.google.com",
  // Restrict framing to same-origin to prevent clickjacking.
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
];

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // Camera/microphone are delegated to the embedded Apps Script form
    // (passport photo capture). Everything else stays disabled.
    value:
      'camera=(self "https://script.google.com"), microphone=(self "https://script.google.com"), geolocation=()',
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
