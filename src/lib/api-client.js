import { decodeApiResponse } from '@/lib/secure-payload';
import { getRecentUnixRange } from '@/lib/time';

export async function fetchEncodedJson(input, init, timeoutMs = 30000) {
  const response = await fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
  });
  const body = await response.json().catch(() => ({}));
  const decoded = decodeApiResponse(body);
  if (decoded) {
    return { response, data: decoded };
  }
  // Non-encoded error bodies (rate-limit 429s, misconfigured routes) must
  // surface their real message instead of a generic decode failure.
  if (body && typeof body.error === 'string') {
    throw new Error(body.error);
  }
  throw new Error('Failed to decode API response');
}

/**
 * Search symbols via /api/symbol-search.
 * Tolerant by default (returns [] on failure); abort errors propagate so
 * callers can distinguish cancelled searches.
 */
export async function searchSymbols(query, { signal } = {}) {
  if (!query) return [];
  try {
    const { response, data } = await fetchEncodedJson(
      `/api/symbol-search?q=${encodeURIComponent(query)}`,
      { signal }
    );
    if (!response.ok) {
      throw new Error(data?.error || 'Search failed');
    }
    return Array.isArray(data.symbols) ? data.symbols : [];
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    console.warn('Symbol search failed', error);
    return [];
  }
}

/**
 * Fetch the latest quote (price, logo, name) for a symbol via /api/finance
 * using the shared recent window. Returns null on failure.
 * ponytail: latest-quote only — series/seasonal/historical fetches are
 * separate contracts and must not be folded into this helper.
 */
export async function fetchLatestQuote(symbol) {
  try {
    const { startDate, endDate } = getRecentUnixRange();
    const { response, data } = await fetchEncodedJson(
      `/api/finance?symbol=${encodeURIComponent(symbol)}&startDate=${startDate}&endDate=${endDate}`
    );
    if (!response.ok) return null;
    const series = data.data || [];
    const last = series.slice().reverse().find((row) => row?.adjclose != null);
    return {
      price: last?.adjclose ?? null,
      logo: data?.meta?.logo || null,
      name: data?.meta?.name || null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch latest quotes for multiple symbols in a single batched request via
 * POST /api/quotes. Returns the quotes map as-is (keyed by uppercased symbol):
 * { AAPL: { price, change, changePercent, logo, ... }, ... }.
 * ponytail: collapses the per-symbol N+1 loop into one network round-trip.
 * Returns {} on any failure so callers degrade gracefully.
 */
export async function fetchBatchQuotes(symbols, timeframe = '1D') {
  try {
    const { response, data } = await fetchEncodedJson('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols, timeframe }),
    });
    if (!response.ok) return {};
    return data?.quotes || {};
  } catch {
    return {};
  }
}

