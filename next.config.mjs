const APP_URL = process.env.APP_URL;
const SECURE_PAYLOAD_KEY = process.env.SECURE_PAYLOAD_KEY;

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_NAME: 'Aruna',
    NEXT_PUBLIC_APP_VERSION: '1.7.56',
    NEXT_PUBLIC_APP_URL: APP_URL,
    SECURE_PAYLOAD_KEY,
  },
  images: {
    // Tiny logos and remote avatars only; pass-through keeps /aruna.png URLs stable
    // for the service-worker precache and avoids Vercel image-optimization usage.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Exclude internal build assets: a broad catch-all makes Next 404
        // _next/static/*.css (text/plain), which nosniff then refuses.
        source: '/((?!_next/static).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // ponytail: report-only CSP. Next/Tailwind emit inline styles; audit the
          // reports in prod before tightening to enforce mode.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
