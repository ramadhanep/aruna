import { after } from 'next/server';
import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';
import { writeYahooRawLog } from '@/lib/yahoo-raw-log';
import { ensureUsLogo } from '@/lib/logo-cache';
import { getIdxLogoUrl, getUsLogoUrl } from '@/lib/supabase-storage';
import { readMarketDataCache, writeMarketDataCache, dedupeInflight } from '@/lib/market-data-cache';
import { isCryptoSymbol, fetchBybitFinancePayload } from '@/lib/bybit';

// ponytail: finance takes arbitrary date ranges (unlike the fixed timeframes of
// /api/quotes and /api/price-series), so the cache key encodes interval + bounds.
// Reuses the generic price_series_cache (symbol, timeframe, payload, cached_at)
// table — timeframe here is just a string token, no schema change needed.
const CACHE_TABLE = 'price_series_cache';

function financeCacheKey(interval, start, end) {
  return `finance:${interval}:${start}:${end}`;
}

// Signature of the finance payload's volatile surface. Unchanged rows only bump
// cached_at (skip-write), avoiding jsonb/MVCC churn on the polling cycle.
function financeSignature(payload) {
  const last = Array.isArray(payload.data) && payload.data.length > 0
    ? payload.data[payload.data.length - 1]
    : null;
  return [
    payload.meta?.symbol,
    payload.meta?.currency,
    payload.meta?.regularMarketPrice,
    payload.meta?.marketState,
    payload.data?.length,
    last?.date,
    last?.close ?? last?.adjclose,
  ].join('|');
}

/**
 * Yahoo Finance API proxy route
 * Fetches historical price data for a given symbol using yahoo-finance2 chart module
 * Supports different intervals, events (dividends/splits), and comprehensive OHLCV data
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const startDate = searchParams.get('startDate'); // Unix timestamp
  const endDate = searchParams.get('endDate'); // Unix timestamp
  const interval = searchParams.get('interval') || '1d'; // Default to daily
  const events = searchParams.get('events'); // Optional: 'div|split|earn'
  const includePrePost = searchParams.get('includePrePost') === 'true'; // Pre/post market data

  if (!symbol || !startDate || !endDate) {
    return Response.json(
      { payload: encodePayload({ error: 'Missing required parameters: symbol, startDate, endDate' }) },
      { status: 400 }
    );
  }

  const start = Number(startDate);
  const end = Number(endDate);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Response.json(
      { payload: encodePayload({ error: 'Invalid date parameters; expected Unix timestamps' }) },
      { status: 400 }
    );
  }

  // Validate interval
  const validIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'];
  if (!validIntervals.includes(interval)) {
    return Response.json(
      { payload: encodePayload({ error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` }) },
      { status: 400 }
    );
  }

  // Crypto charts come live from Bybit public API — no cache, Yahoo only as
  // a fallback if Bybit fails (e.g. unsupported interval like '5d'/'90m').
  if (isCryptoSymbol(symbol)) {
    try {
      const payload = await fetchBybitFinancePayload(symbol, interval, start, end);
      return Response.json({ payload: encodePayload(payload) });
    } catch (error) {
      console.warn(`[finance] Bybit failed for ${symbol}, falling back to Yahoo:`, error.message);
    }
  }

  // Stale-while-revalidate cache: fresh rows are served as-is, stale rows are
  // served instantly and refreshed after the response is sent. Never a hard
  // dep — any cache miss/error falls through to a live fetch below.
  const cacheKey = financeCacheKey(interval, start, end);
  try {
    const { fresh, stale } = await readMarketDataCache(CACHE_TABLE, [symbol], cacheKey);
    const hit = fresh.get(symbol) ?? stale.get(symbol);
    if (hit) {
      if (!fresh.has(symbol)) {
        after(async () => {
          try {
            const payload = await buildFinancePayload(symbol, interval, start, end, events, includePrePost);
            if (payload) {
              await writeMarketDataCache(CACHE_TABLE, cacheKey, [{ symbol, payload }], financeSignature);
            }
          } catch {
            // best-effort — stale row stays for the next request
          }
        });
      }
      return Response.json({ payload: encodePayload(hit) });
    }
  } catch {
    // cache read failed — continue to live fetch
  }

  try {
    const payload = await buildFinancePayload(symbol, interval, start, end, events, includePrePost);

    // Cache the resolved payload (incl. logo) — best-effort, never breaks the
    // response. Falls back silently so a cache outage never breaks the API.
    await writeMarketDataCache(
      CACHE_TABLE,
      cacheKey,
      [{ symbol, payload }],
      financeSignature
    );

    return Response.json({ payload: encodePayload(payload) });
  } catch (error) {
    console.error('Error fetching Yahoo Finance chart data:', error);

    // Provide more specific error messages
    let message = error?.message || 'Failed to fetch data from Yahoo Finance';
    let status = 500;

    if (message.includes('No data found')) {
      message = 'Symbol may be invalid, delisted, or no data available for the requested period';
      status = 404;
    } else if (message.includes('Invalid cookie')) {
      message = 'Yahoo Finance API session error. Please try again.';
    }

    return Response.json({ payload: encodePayload({ error: message }) }, { status });
  }
}

// Fetch + normalize the finance payload for one symbol. Throws on failure;
// errors mentioning "No data found" are mapped to 404 by the route.
async function buildFinancePayload(symbol, interval, start, end, events, includePrePost) {
  const cacheKey = financeCacheKey(interval, start, end);
  let quoteMeta = null;
  try {
    quoteMeta = await yahooFinance.quote(symbol, {
      lang: 'en-US',
      region: 'US',
    });
    await writeYahooRawLog({
      endpoint: 'finance-quote',
      symbol,
      requestParams: { lang: 'en-US', region: 'US' },
      payload: quoteMeta,
    });
  } catch (error) {
    console.warn(`Failed to fetch quote metadata for ${symbol}`, error);
  }

  try {
    // Build chart options according to documentation
    const chartOptions = {
      period1: new Date(start * 1000),
      period2: new Date(end * 1000),
      interval,
    };

    // Add optional parameters
    if (events) {
      chartOptions.events = events;
    }
    if (includePrePost) {
      chartOptions.includePrePost = true;
    }

    const result = await dedupeInflight(
      `finance:chart:${cacheKey}`,
      () => yahooFinance.chart(symbol, chartOptions)
    );
    await writeYahooRawLog({
      endpoint: 'finance-chart',
      symbol,
      requestParams: {
        period1: chartOptions.period1?.toISOString?.() || chartOptions.period1,
        period2: chartOptions.period2?.toISOString?.() || chartOptions.period2,
        interval: chartOptions.interval,
        events: chartOptions.events,
        includePrePost: chartOptions.includePrePost || false,
      },
      payload: result,
    });

    // Handle empty results — throw so the route maps it to a 404
    if (!result?.quotes || result.quotes.length === 0) {
      throw new Error('No data found for the specified period. Symbol may be invalid or delisted.');
    }

    // Extract quotes data (array format by default)
    const prices = result.quotes.map((quote) => ({
      date: quote.date.toISOString(),
      open: quote.open ?? null,
      high: quote.high ?? null,
      low: quote.low ?? null,
      close: quote.close ?? null,
      volume: quote.volume ?? null,
      adjclose: quote.adjclose ?? null,
    }));

    const meta = result.meta ?? {};
    const normalizedSymbol = symbol.toUpperCase();
    let logoUrl = quoteMeta?.companyLogoUrl || quoteMeta?.logoUrl || null;
    if (!logoUrl) {
      if (quoteMeta?.market == 'id_market') {
        logoUrl = getIdxLogoUrl(normalizedSymbol);
      } else if (quoteMeta?.market == 'us_market') {
        logoUrl = await ensureUsLogo(normalizedSymbol) || getUsLogoUrl(normalizedSymbol);
      }
    }

    // Process events if available
    const eventsData = {};
    if (result.events) {
      if (result.events.dividends) {
        eventsData.dividends = result.events.dividends.map(div => ({
          date: div.date.toISOString(),
          amount: div.amount,
        }));
      }
      if (result.events.splits) {
        eventsData.splits = result.events.splits.map(split => ({
          date: split.date.toISOString(),
          numerator: split.numerator,
          denominator: split.denominator,
          splitRatio: split.splitRatio,
        }));
      }
    }

    const payload = {
      data: prices,
      events: Object.keys(eventsData).length > 0 ? eventsData : undefined,
      meta: {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol || symbol,
        logo: logoUrl,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
        fullExchangeName: meta.fullExchangeName,
        instrumentType: meta.instrumentType,
        firstTradeDate: meta.firstTradeDate,
        regularMarketTime: meta.regularMarketTime,
        regularMarketPrice: meta.regularMarketPrice,
        chartPreviousClose: meta.chartPreviousClose,
        previousClose: meta.previousClose,
        scale: meta.scale,
        priceHint: meta.priceHint,
        dataGranularity: meta.dataGranularity,
        range: meta.range,
        validRanges: meta.validRanges,
        gmtoffset: meta.gmtoffset,
        timezone: meta.exchangeTimezoneName,
        currentTradingPeriod: meta.currentTradingPeriod,
        marketState: meta.marketState, // Add marketState for pages to detect market status
        provider: 'yahoo-finance2',
      },
    };

    return payload;
  } catch (error) {
    console.error('[finance] Failed to build payload:', error);
    throw error;
  }
}
