import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

// ─── Security Headers ────────────────────────────────────────────────────────
// Fixes all 7 medium-severity issues from the Barrion security scan (2026-03-20)
// Remaining fix: HSTS must be added in nginx (see comment at bottom of file)

const CSP = [
  // Only load resources from the same origin by default
  "default-src 'self'",

  // Next.js 15 requires 'unsafe-inline' for its __NEXT_DATA__ hydration scripts.
  // Removing 'unsafe-inline' would break the app. A nonce-based CSP is the
  // proper long-term fix but requires significant middleware work.
  "script-src 'self' 'unsafe-inline'",

  // Tailwind CSS generates inline styles — 'unsafe-inline' is required
  "style-src 'self' 'unsafe-inline'",

  // 'self'      → logo, images served from the app
  // data:        → jspdf uses data: URIs when generating PDFs
  // blob:        → xlsx exports create blob URLs
  // lh3.googleusercontent.com → Google OAuth profile pictures
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",

  // Fonts served from the same origin only
  "font-src 'self'",

  // SWR makes fetch() calls — all to the same origin (/api/*)
  "connect-src 'self'",

  // 'self' → PWA service worker (served at /sw.js, same origin)
  // blob: → jspdf / xlsx may use web workers via blob URLs
  "worker-src 'self' blob:",

  // No external iframes allowed
  "frame-src 'none'",

  // Prevents this app from being embedded in iframes on other sites (clickjacking fix)
  // Works alongside the X-Frame-Options header below for older browser support
  "frame-ancestors 'none'",

  // Forms can only submit to the same origin
  "form-action 'self'",

  // Prevents <base> tag injection attacks
  "base-uri 'self'",

  // No Flash or browser plugins
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  // ── Fix 1: Content Security Policy (XSS + injection protection) ──────────
  {
    key: "Content-Security-Policy",
    value: CSP,
  },

  // ── Fix 2: Frame Security Policy (clickjacking protection) ───────────────
  // X-Frame-Options covers older browsers; frame-ancestors in CSP covers modern ones
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // ── Fix 3: X-Content-Type-Options (MIME sniffing protection) ─────────────
  // Tells browsers to trust the declared Content-Type and not guess/sniff it
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // ── Fix 4: Permissions-Policy (browser feature access control) ───────────
  // Explicitly blocks features this app doesn't use.
  // If you ever add geolocation or camera features, update this.
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
      "display-capture=()",
    ].join(", "),
  },

  // ── Fix 5: Strict-Transport-Security (HSTS) ─────────────────────────────
  // Forces browsers to always use HTTPS for this domain for 2 years.
  // includeSubDomains covers all subdomains; preload allows HSTS preload list submission.
  // Also set this in nginx for belt-and-suspenders coverage.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // Fix 6 (server disclosure): poweredByHeader: false in nextConfig removes this.
  // Do NOT set X-Powered-By to "" here — that sends an empty header, which
  // scanners still flag. Nginx should strip it: proxy_hide_header X-Powered-By;
];

// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  // ── Fix 5 (server disclosure): Remove "x-powered-by: Next.js" response header
  poweredByHeader: false,

  // pdf2json uses Node.js Buffer APIs — must stay server-side only
  serverExternalPackages: ['pdf2json', 'sharp'],

  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },

  async headers() {
    return [
      {
        // Apply security headers to ALL routes
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// ─── PWA Configuration ────────────────────────────────────────────────────────
// Wraps nextConfig with Workbox service worker generation.
// SW is served at /sw.js and scoped to /portal/ via the manifest.
// Disabled in development (hot reload conflicts with SW caching).
// ─────────────────────────────────────────────────────────────────────────────

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    // Shown instead of browser error page when user is offline and tries to navigate
    document: "/portal/offline",
  },
})(nextConfig);

// ─── NGINX CONFIG — do this on your server ──────────────────────────────────
//
// Edit: /etc/nginx/sites-available/mysbe.in  (or wherever your site config is)
//
// 1. Hide nginx version (fixes "Server Leaks Version Information"):
//    In the `http {}` block of /etc/nginx/nginx.conf:
//      server_tokens off;
//
// 2. Strip X-Powered-By (fixes "Server Leaks Information via X-Powered-By"):
//    In your `location` block that proxies to Next.js:
//      proxy_hide_header X-Powered-By;
//
// 3. HSTS (belt-and-suspenders — also set in Next.js headers above):
//    In your `server {}` block for port 443 (HTTPS only):
//      add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
//
// Then run:
//   sudo nginx -t && sudo systemctl reload nginx
// ─────────────────────────────────────────────────────────────────────────────
