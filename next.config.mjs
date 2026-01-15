const APP_URL = process.env.APP_URL;
const SECURE_PAYLOAD_KEY = process.env.SECURE_PAYLOAD_KEY;

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_NAME: 'Aruna',
    NEXT_PUBLIC_APP_VERSION: '1.32.42',
    NEXT_PUBLIC_APP_URL: APP_URL,
    SECURE_PAYLOAD_KEY,
  },
};

export default nextConfig;
