function getHeader(request, name) {
  return request.headers.get(name) || request.headers.get(name.toLowerCase()) || '';
}

export function ensureCsrfToken(request) {
  const origin = getHeader(request, 'origin');
  const referer = getHeader(request, 'referer');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    return true;
  }
  const allowedOrigin = new URL(baseUrl).origin;
  if (origin) {
    return origin === allowedOrigin;
  }
  if (referer) {
    return referer.startsWith(allowedOrigin);
  }
  return false;
}
