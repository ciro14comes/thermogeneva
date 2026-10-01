import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Intestazioni di sicurezza per tutte le pagine.
// Il browser parla solo con il sito stesso (pagine e /api/*) e con swisstopo (fondo mappa):
// il database Supabase viene interrogato solo dal server.
const CSP = [
  "default-src 'self'",
  // Next.js inserisce piccoli script inline; 'unsafe-eval' solo in sviluppo locale (React lo usa per il debug)
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",               // stili inline di React e MapLibre
  "img-src 'self' data: blob: https://*.geo.admin.ch",
  "font-src 'self' data:",
  "connect-src 'self' https://*.geo.admin.ch",      // tile vettoriali, sprite e font della mappa
  "worker-src 'self' blob:",                        // worker di MapLibre (/maplibre/)
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",                         // il sito non può essere incorporato in altri siti
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
