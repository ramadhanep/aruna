import { decodeApiResponse } from '@/lib/secure-payload';
import { getRecentUnixRange } from '@/lib/time';

export async function fetchEncodedJson(input, init) {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({}));
  const decoded = decodeApiResponse(body);
  if (!decoded) {
    throw new Error('Failed to decode API response');
  }
  return { response, data: decoded };
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

