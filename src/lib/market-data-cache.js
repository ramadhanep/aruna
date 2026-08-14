import { getSupabaseServiceRoleClient } from '@/lib/supabase-server';

// Best-effort DB cache for market data (quotes + price series) so repeated
// requests reuse fresh rows instead of re-hitting Yahoo Finance. Cache is
// never a hard dependency: every failure path falls back to a live fetch.
//
// TTL per timeframe in milliseconds. Quotes pair a volatile price/change with
// its mini-chart, so all quote timeframes share a short TTL. Price-series
// historical candles change far less frequently and get longer TTLs.
const TTL_BY_TIMEFRAME = {
  // /api/quotes
  '1D': 60_000,
  '1W': 60_000,
  '1M': 60_000,
  '3M': 60_000,
  YTD: 60_000,
  '1Y': 60_000,
  '2Y': 60_000,
  '5Y': 60_000,
  ATH: 60_000,
  // /api/price-series
  '15M': 60_000,
  '1H': 60_000,
  '2H': 60_000,
  '4H': 60_000,
  D: 15 * 60_000,
  W: 60 * 60_000,
  M: 6 * 60 * 60_000,
};

// Hard retention window; rows older than this are pruned on every write so
// the tables stay bounded without a cron (deterministic cleanup). Kept short
// because all TTLs are well under a day — anything untouched for 3 days is
// dead weight on the (free-tier) database.
const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export function getMarketDataTtl(timeframe) {
  return TTL_BY_TIMEFRAME[timeframe] ?? 60_000;
}

function isFresh(row, ttlMs) {
  if (!row) return false;
  const cachedAt = Date.parse(row.cached_at);
  if (!Number.isFinite(cachedAt)) return false;
  return Date.now() - cachedAt < ttlMs;
}

/**
 * Read fresh cached payloads for a set of symbols sharing one timeframe.
 * Returns Map<symbol, payload>. Best-effort: returns an empty map on any
 * missing config, network failure, or stale/missing rows.
 */
export async function readMarketDataCache(table, symbols, timeframe) {
  const client = getSupabaseServiceRoleClient();
  if (!client || !Array.isArray(symbols) || symbols.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await client
      .from(table)
      .select('symbol, payload, cached_at')
      .eq('timeframe', timeframe)
      .in('symbol', symbols);

    if (error || !Array.isArray(data)) {
      console.warn(`[market-data-cache] read failed for ${table}:`, error?.message ?? 'unexpected response');
      return new Map();
    }

    const ttlMs = getMarketDataTtl(timeframe);
    const result = new Map();
    data.forEach((row) => {
      if (row && row.payload != null && isFresh(row, ttlMs)) {
        result.set(row.symbol, row.payload);
      }
    });
    return result;
  } catch (error) {
    console.warn(`[market-data-cache] read failed for ${table}:`, error.message);
    return new Map();
  }
}

/**
 * Write/refresh cache rows for a set of (symbol, payload) entries sharing one
 * timeframe, then prune rows older than the retention window. Best-effort —
 * failures are logged and ignored so a cache outage never breaks the API.
 *
 * Free-tier friendly: when `getSignature(payload)` is provided, a row is only
 * rewritten when its signature changed. Unchanged rows just get `cached_at`
 * bumped via a tiny update — the jsonb payload (TOASTed out-of-line) is left
 * untouched, avoiding constant MVCC write amplification from the 60 s polling
 * cycle.
 */
export async function writeMarketDataCache(table, timeframe, entries, getSignature = null) {
  const client = getSupabaseServiceRoleClient();
  if (!client || !Array.isArray(entries) || entries.length === 0) {
    return;
  }

  const valid = entries.filter((entry) => entry && entry.symbol && entry.payload != null);
  if (valid.length === 0) {
    return;
  }

  try {
    const symbols = valid.map((entry) => entry.symbol);
    const { data: existing, error: readError } = await client
      .from(table)
      .select('symbol, payload')
      .eq('timeframe', timeframe)
      .in('symbol', symbols);

    if (readError) {
      console.warn(`[market-data-cache] write compare failed for ${table}:`, readError.message);
      return;
    }

    const existingBySymbol = new Map((existing ?? []).map((row) => [row.symbol, row.payload]));
    const now = new Date().toISOString();
    const toUpsert = [];
    const toTouch = [];

    valid.forEach((entry) => {
      const oldPayload = existingBySymbol.get(entry.symbol);
      const unchanged =
        oldPayload != null &&
        typeof getSignature === 'function' &&
        getSignature(entry.payload) === getSignature(oldPayload);
      if (unchanged) {
        toTouch.push(entry.symbol);
      } else {
        toUpsert.push({ symbol: entry.symbol, timeframe, payload: entry.payload, cached_at: now });
      }
    });

    if (toUpsert.length > 0) {
      const { error: upsertError } = await client.from(table).upsert(toUpsert, { onConflict: 'symbol,timeframe' });
      if (upsertError) {
        console.warn(`[market-data-cache] write failed for ${table}:`, upsertError.message);
        return;
      }
    }

    if (toTouch.length > 0) {
      const { error: touchError } = await client
        .from(table)
        .update({ cached_at: now })
        .eq('timeframe', timeframe)
        .in('symbol', toTouch);
      if (touchError) {
        console.warn(`[market-data-cache] touch failed for ${table}:`, touchError.message);
      }
    }

    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const { error: deleteError } = await client.from(table).delete().lt('cached_at', cutoff);
    if (deleteError) {
      console.warn(`[market-data-cache] prune failed for ${table}:`, deleteError.message);
    }
  } catch (error) {
    console.warn(`[market-data-cache] write failed for ${table}:`, error.message);
  }
}

// Short-lived in-flight dedupe so concurrent requests for the same key reuse
// one Yahoo call instead of stampeding. Only meaningful within a single server
// instance (e.g. self-hosted), harmless on serverless.
const inflight = new Map();

export function dedupeInflight(key, factory) {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = factory().catch((error) => {
    inflight.delete(key);
    throw error;
  });
  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key)).catch(() => {});
  return promise;
}
