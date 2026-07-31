import { NextResponse } from 'next/server';

// --- Minimal per-IP limiter for the heavy screener batches ---
// ponytail: fixed-window counter in per-instance memory. Not authoritative
// across lambda instances — good enough to stop casual abuse of the public
// screener trigger, not a defense against distributed bots. Swap for a
// managed rate limiter if the screener endpoint becomes a real target.
const SCREENER_LIMIT = 20;
const SCREENER_WINDOW_MS = 60_000;
const requestCounts = new Map();

const buildRateLimitResponse = (retryAfterSeconds) =>
  new Response(JSON.stringify({ error: 'Too many screener requests. Try again later.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
    },
  });

function enforceScreenerLimit(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/screeners')) {
    return null;
  }
  // Internal cron-triggered self-calls must not be throttled.
  if (request.headers.get('user-agent') === 'aruna-cron') {
    return null;
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown';

  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now - entry.windowStart >= SCREENER_WINDOW_MS) {
    requestCounts.set(ip, { windowStart: now, count: 1 });
    return null;
  }

  entry.count += 1;
  if (entry.count > SCREENER_LIMIT) {
    const retryAfterSeconds = Math.ceil(
      (entry.windowStart + SCREENER_WINDOW_MS - now) / 1000
    );
    return buildRateLimitResponse(retryAfterSeconds);
  }

  if (requestCounts.size > 5000) {
    for (const [key, value] of requestCounts) {
      if (now - value.windowStart > SCREENER_WINDOW_MS * 2) {
        requestCounts.delete(key);
      }
    }
  }

  return null;
}

// --- CORS allowlist (decorative; see docs/known-issues.md) ---

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

export function proxy(request) {
  const limited = enforceScreenerLimit(request);
  if (limited) {
    return limited;
  }

  const allowedOrigin = resolveAllowedOrigin(request);
  const response = NextResponse.next();
  return applyCorsHeaders(response, allowedOrigin);
}

export const config = {
  matcher: ['/api/:path*'],
};
