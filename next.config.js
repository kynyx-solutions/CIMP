/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Content Security Policy. Google sign-in (Firebase popup) needs apis.google.com, the project's
// firebaseapp.com frame and the googleapis.com token endpoints. Next.js still emits inline
// scripts, so 'unsafe-inline' stays until nonces are added; dev mode also needs 'unsafe-eval'.
// Set CSP_REPORT_ONLY=true to watch for violations in the browser console without blocking.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.googleapis.com https://apis.google.com https://*.firebaseapp.com",
  "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: process.env.CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // The Google sign-in popup must be able to message this window
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig = {
  // Lets a second dev/test server run without clobbering the main .next folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Self-contained server bundle for the Docker image (only used by `next build`).
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  // src/instrumentation.ts starts the in-app scheduler when the server boots
  experimental: { instrumentationHook: true },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses carry personal data: never cache them in shared caches
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
  async redirects() {
    // Old directory URL (shared links, bookmarks) → new page
    return [{ source: '/public-startups', destination: '/startups', permanent: true }];
  },
};
module.exports = nextConfig;
