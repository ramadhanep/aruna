import { NextResponse } from 'next/server';

const toList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeOrigin = (value) => {
  if (!value) return null;
  const normalizedValue = value.includes('://') ? value : `https://${value}`;
  try {
    return new URL(normalizedValue).origin;
  } catch {
    return null;
  }
};

const baseOrigins = [
  ...toList(process.env.API_ALLOWED_ORIGINS),
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3000' : null,
].filter(Boolean);

const allowedOrigins = new Set(
  baseOrigins
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
);

const buildUnauthorizedResponse = () =>
  new NextResponse(JSON.stringify({ error: 'Unauthorized origin' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

const applyCorsHeaders = (response, origin) => {
  if (!origin) return response;
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.append('Vary', 'Origin');
  return response;
};

const resolveAllowedOrigin = (request) => {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  const secFetchSite = request.headers.get('sec-fetch-site');

  const candidates = [originHeader, refererHeader]
    .map((value) => (value ? normalizeOrigin(value) : null))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (allowedOrigins.has(candidate)) {
      return candidate;
    }
  }

  if (!originHeader && !refererHeader) {
    if (secFetchSite && ['same-origin', 'same-site'].includes(secFetchSite)) {
      const impliedOrigin = normalizeOrigin(
        `${request.nextUrl.protocol}//${request.nextUrl.host}`
      );
      if (impliedOrigin && allowedOrigins.has(impliedOrigin)) {
        return impliedOrigin;
      }
    }
  }

  return null;
};

export function middleware(request) {
  const allowedOrigin = resolveAllowedOrigin(request);

  if (request.method === 'OPTIONS') {
    if (!allowedOrigin) {
      return buildUnauthorizedResponse();
    }
    const response = new NextResponse(null, { status: 204 });
    return applyCorsHeaders(response, allowedOrigin);
  }

  if (!allowedOrigin) {
    return buildUnauthorizedResponse();
  }

  const response = NextResponse.next();
  return applyCorsHeaders(response, allowedOrigin);
}

export const config = {
  matcher: ['/api/:path*'],
};
