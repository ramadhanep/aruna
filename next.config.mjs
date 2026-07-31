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
};

export default nextConfig;
