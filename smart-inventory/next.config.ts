import type { NextConfig } from "next";

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
  // https:       → allows loading images over HTTPS from any source (for invoice logos etc.)
  "img-src 'self' data: blob: https:",

  // Fonts served from the same origin only
  "font-src 'self'",

  // SWR makes fetch() calls — all to the same origin (/api/*)
  "connect-src 'self'",

  // jspdf / xlsx may use web workers via blob URLs
  "worker-src blob:",

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

  // ── Fix 5: Remove "x-powered-by: Next.js" header (server disclosure) ─────
  // The poweredByHeader: false config option below handles this,
  // but we also explicitly remove it here as a second layer
  {
    key: "X-Powered-By",
    value: "",
  },
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

export default nextConfig;

// ─── NGINX CONFIG — do this on your server (fixes HSTS + nginx version) ──────
//
// Edit: /etc/nginx/sites-available/mysbe.in  (or wherever your site config is)
//
// 1. Hide nginx version (server disclosure fix):
//    In the `http {}` block:
//      server_tokens off;
//
// 2. Add HSTS header (protocol downgrade fix):
//    In your `server {}` block for port 443 (HTTPS only):
//      add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
//
// 3. Optionally hide x-nextjs-cache header:
//      proxy_hide_header X-Nextjs-Cache;
//
// Then run:
//   sudo nginx -t && sudo systemctl reload nginx
//
// That completes all 7 fixes from the security scan.
// ─────────────────────────────────────────────────────────────────────────────
