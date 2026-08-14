import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';
import { ensureUsLogo } from '@/lib/logo-cache';
import { getIdxLogoUrl, getUsLogoUrl } from '@/lib/supabase-storage';
import { readMarketDataCache, writeMarketDataCache, dedupeInflight } from '@/lib/market-data-cache';

const CACHE_TABLE = 'quote_cache';

// Signature of the user-visible quote shape. When it is unchanged between
// polls, the cache row is not rewritten (free-tier friendly — only cached_at
// is bumped). Deliberately excludes volatile meta fields the UI never shows.
function quoteSignature(quote) {
    const lastPrice = Array.isArray(quote.chartData) ? quote.chartData[quote.chartData.length - 1] : null;
    const lastTs = Array.isArray(quote.chartTimestamps)
        ? quote.chartTimestamps[quote.chartTimestamps.length - 1]
        : null;
    return [
        quote.symbol,
        quote.name,
        quote.price,
        quote.change,
        quote.changePercent,
        quote.timeframeChange,
        quote.logo,
        quote.chartData?.length,
        lastPrice,
        lastTs,
        quote.meta?.currency,
        quote.meta?.marketState,
    ].join('|');
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Max symbols per request to prevent abuse
const MAX_SYMBOLS = 50;
// Concurrency limit for Yahoo Finance calls
const CONCURRENCY_LIMIT = 10;
const MAX_CHART_POINTS = 180;
const DEFAULT_TIMEFRAME = '1D';

const TIMEFRAME_CONFIG = {
    '1D': { lookbackDays: 10, interval: '1d' },
    '1W': { lookbackDays: 14, interval: '1d' },
    '1M': { lookbackDays: 45, interval: '1d' },
    '3M': { lookbackDays: 120, interval: '1d' },
    YTD: { lookbackDays: 366, interval: '1d', fromYearStart: true },
    '1Y': { lookbackDays: 400, interval: '1d' },
    '2Y': { lookbackDays: 800, interval: '1d' },
    '5Y': { lookbackDays: 2000, interval: '1d' },
    ATH: { lookbackDays: 7000, interval: '1d' },
};

function resolveTimeframe(timeframeRaw) {
    const normalized = typeof timeframeRaw === 'string' ? timeframeRaw.toUpperCase() : DEFAULT_TIMEFRAME;
    return TIMEFRAME_CONFIG[normalized] ? normalized : DEFAULT_TIMEFRAME;
}

function getPeriodRange(timeframe) {
    const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG[DEFAULT_TIMEFRAME];
    const now = new Date();

    if (config.fromYearStart) {
        return {
            period1: new Date(now.getFullYear(), 0, 1),
            period2: now,
            interval: config.interval,
        };
    }

    return {
        period1: new Date(now.getTime() - config.lookbackDays * DAY_IN_MS),
        period2: now,
        interval: config.interval,
    };
}

function downsampleSeries(points, maxPoints = MAX_CHART_POINTS) {
    if (!Array.isArray(points) || points.length <= maxPoints) {
        return points;
    }
    const step = (points.length - 1) / (maxPoints - 1);
    const sampled = [];
    for (let i = 0; i < maxPoints; i++) {
        const index = Math.round(i * step);
        sampled.push(points[index]);
    }
    return sampled;
}

function computeTimeframeChange(timeframe, currentPrice, previousClosePrice, validSeries) {
    if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
        return null;
    }

    if (timeframe === '1D') {
        if (typeof previousClosePrice !== 'number' || previousClosePrice === 0) {
            return null;
        }
        return ((currentPrice - previousClosePrice) / previousClosePrice) * 100;
    }

    if (!Array.isArray(validSeries) || validSeries.length < 2) {
        return null;
    }

    if (timeframe === 'ATH') {
        const highest = Math.max(...validSeries.map((point) => point.price).filter((value) => Number.isFinite(value)));
        if (!Number.isFinite(highest) || highest <= 0) {
            return null;
        }
        return ((currentPrice - highest) / highest) * 100;
    }

    const basePrice = validSeries[0]?.price;
    if (typeof basePrice !== 'number' || basePrice <= 0) {
        return null;
    }
    return ((currentPrice - basePrice) / basePrice) * 100;
}

/**
 * Run promises with limited concurrency.
 */
async function promisePool(tasks, limit) {
    const results = new Array(tasks.length);
    let index = 0;

    async function runNext() {
        while (index < tasks.length) {
            const currentIndex = index++;
            results[currentIndex] = await tasks[currentIndex]();
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(limit, tasks.length); i++) {
        workers.push(runNext());
    }
    await Promise.all(workers);
    return results;
}

/**
 * Fetch a single symbol's quote data (price, change, mini-chart).
 * Uses chart() API which includes meta with regularMarketPrice, previousClose, etc.
 * Skips the separate quote() call to save resources.
 */
async function fetchSymbolQuote(symbol, timeframe = DEFAULT_TIMEFRAME) {
    try {
        const { period1, period2, interval } = getPeriodRange(timeframe);

        const result = await yahooFinance.chart(symbol, {
            period1,
            period2,
            interval,
        });

        if (!result?.quotes || result.quotes.length === 0) {
            return null;
        }

        const series = result.quotes.map((quote) => ({
            date: quote.date.toISOString(),
            adjclose: quote.adjclose ?? null,
            close: quote.close ?? null,
        }));

        const meta = result.meta ?? {};
        const normalizedSymbol = symbol.toUpperCase();

        // Determine price and change
        let price = meta.regularMarketPrice;
        let previousPrice = meta.previousClose || meta.chartPreviousClose;

        const validSeries = series
            .map((point) => ({
                date: point.date,
                price:
                    typeof point.adjclose === 'number'
                        ? point.adjclose
                        : typeof point.close === 'number'
                            ? point.close
                            : null,
            }))
            .filter((point) => typeof point.price === 'number' && Number.isFinite(point.price));

        if (validSeries.length >= 2) {
            const current = validSeries[validSeries.length - 1];
            const previous = validSeries[validSeries.length - 2];

            price = current.price;
            previousPrice = previous.price;
        }

        if (price == null || previousPrice == null) {
            return null;
        }

        const change = price - previousPrice;
        const changePercent = previousPrice === 0 ? 0 : (change / previousPrice) * 100;
        const timeframeChange = computeTimeframeChange(timeframe, price, previousPrice, validSeries);
        const downsampledSeries = downsampleSeries(validSeries);
        const chartData = downsampledSeries.map((point) => point.price);
        const chartTimestamps = downsampledSeries.map((point) => point.date);

        // Resolve logo
        let logoUrl = null;
        const exchangeName = meta.exchangeName || '';
        const fullExchangeName = meta.fullExchangeName || '';
        const isIdxMarket =
            exchangeName === 'JKT' ||
            fullExchangeName.includes('Jakarta') ||
            /\.JK$/i.test(normalizedSymbol);
        const isUsMarket =
            ['NYQ', 'NMS', 'NGM', 'NCM', 'NYE', 'ASE', 'PCX', 'BTS'].includes(exchangeName) ||
            fullExchangeName.includes('NYSE') ||
            fullExchangeName.includes('NASDAQ');
        const isCrypto =
            exchangeName === 'CCC' ||
            fullExchangeName.includes('CCC') ||
            /-(USD|BTC|USDT|EUR|GBP)$/i.test(normalizedSymbol);

        if (isIdxMarket) {
            logoUrl = getIdxLogoUrl(normalizedSymbol);
        } else if (isCrypto) {
            // Crypto logos are not in chart().meta — fetch from quote() metadata
            try {
                const quoteMeta = await yahooFinance.quote(symbol);
                logoUrl = quoteMeta?.companyLogoUrl || quoteMeta?.logoUrl || null;
            } catch {
                // Silently fail — no logo is fine
            }
        } else if (isUsMarket) {
            logoUrl = (await ensureUsLogo(normalizedSymbol)) || getUsLogoUrl(normalizedSymbol);
        }

        return {
            symbol: normalizedSymbol,
            name: meta.longName || meta.shortName || meta.symbol || symbol,
            price,
            change,
            changePercent,
            timeframe,
            timeframeChange,
            chartData,
            chartTimestamps,
            logo: logoUrl,
            meta: {
                currency: meta.currency,
                exchangeName: meta.exchangeName,
                regularMarketPrice: meta.regularMarketPrice,
                previousClose: meta.previousClose,
                chartPreviousClose: meta.chartPreviousClose,
                marketState: meta.marketState,
                fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
                fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
            },
        };
    } catch (error) {
        console.warn(`[quotes] Failed to fetch ${symbol}:`, error.message);
        return null;
    }
}

/**
 * Batch quotes endpoint.
 * POST /api/quotes
 * Body: { symbols: ["AAPL", "MSFT", "BBRI.JK", ...] }
 * Returns: { quotes: { AAPL: {...}, MSFT: {...}, ... } }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const symbols = body?.symbols;
        const timeframe = resolveTimeframe(body?.timeframe);

        if (!Array.isArray(symbols) || symbols.length === 0) {
            return Response.json(
                {
                    payload: encodePayload({
                        error: 'Missing or empty symbols array in request body',
                    }),
                },
                { status: 400 }
            );
        }

        // Deduplicate and validate symbols
        const uniqueSymbols = [
            ...new Set(
                symbols
                    .filter((s) => typeof s === 'string' && s.trim().length > 0)
                    .map((s) => s.trim())
            ),
        ].slice(0, MAX_SYMBOLS);

        if (uniqueSymbols.length === 0) {
            return Response.json(
                {
                    payload: encodePayload({
                        error: 'No valid symbols provided',
                    }),
                },
                { status: 400 }
            );
        }

        // Serve fresh cached quotes where possible; only fetch misses from Yahoo.
        const cachedMap = await readMarketDataCache(CACHE_TABLE, uniqueSymbols, timeframe);
        const misses = uniqueSymbols.filter((symbol) => !cachedMap.has(symbol));

        // Fetch missing quotes with concurrency control, deduped in-flight.
        const tasks = misses.map(
            (symbol) => () =>
                dedupeInflight(`quote:${timeframe}:${symbol}`, () => fetchSymbolQuote(symbol, timeframe))
        );
        const results = await promisePool(tasks, CONCURRENCY_LIMIT);

        const fetchedResults = results.filter(Boolean);

        // Refresh cache for everything we fetched from Yahoo (best-effort).
        await writeMarketDataCache(
            CACHE_TABLE,
            timeframe,
            fetchedResults.map((result) => ({ symbol: result.symbol, payload: result })),
            quoteSignature
        );

        // Build results map: fresh cache first, then live fetches override.
        const quotesMap = {};
        cachedMap.forEach((payload, symbol) => {
            quotesMap[symbol] = payload;
        });
        fetchedResults.forEach((result) => {
            quotesMap[result.symbol] = result;
        });

        return Response.json({
            payload: encodePayload({
                quotes: quotesMap,
                meta: {
                    requested: uniqueSymbols.length,
                    resolved: Object.keys(quotesMap).length,
                    cached: cachedMap.size,
                    fetched: fetchedResults.length,
                    provider: 'yahoo-finance2',
                    timeframe,
                },
            }),
        });
    } catch (error) {
        console.error('[quotes] Batch error:', error);
        return Response.json(
            {
                payload: encodePayload({
                    error: error?.message || 'Internal server error',
                }),
            },
            { status: 500 }
        );
    }
}
