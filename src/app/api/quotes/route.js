import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';
import { getSupabaseServiceRoleClient } from '@/lib/supabase-server';

const SUPABASE_STORAGE_BASE = 'https://yjygsxwzkkjhvigedvdy.supabase.co/storage/v1/object/public';
const PLUANG_CDN_BASE = 'https://image-cdn.pluang.com/icons/light/global-stocks';

// Max symbols per request to prevent abuse
const MAX_SYMBOLS = 50;
// Concurrency limit for Yahoo Finance calls
const CONCURRENCY_LIMIT = 10;

/**
 * Ensure a US stock logo exists in Supabase storage.
 * If missing, download from Pluang CDN and upload automatically.
 */
async function ensureUsLogo(normalizedSymbol) {
    const supabaseUrl = `${SUPABASE_STORAGE_BASE}/us/${normalizedSymbol}.svg`;

    try {
        const headRes = await fetch(supabaseUrl, { method: 'HEAD' });
        if (headRes.ok) {
            return supabaseUrl;
        }

        const cdnUrl = `${PLUANG_CDN_BASE}/${normalizedSymbol.toLowerCase()}.svg`;
        const cdnRes = await fetch(cdnUrl);
        if (!cdnRes.ok) {
            return null;
        }

        const svgBuffer = Buffer.from(await cdnRes.arrayBuffer());

        const supabase = getSupabaseServiceRoleClient();
        if (!supabase) {
            return null;
        }

        const { error: uploadError } = await supabase.storage
            .from('us')
            .upload(`${normalizedSymbol}.svg`, svgBuffer, {
                contentType: 'image/svg+xml',
                cacheControl: '31536000',
                upsert: true,
            });

        if (uploadError) {
            return null;
        }

        return supabaseUrl;
    } catch {
        return null;
    }
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
async function fetchSymbolQuote(symbol) {
    try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

        const result = await yahooFinance.chart(symbol, {
            period1: startDate,
            period2: endDate,
            interval: '1d',
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

        const validSeries = series.filter(
            (point) => point.adjclose != null || point.close != null
        );

        if (validSeries.length >= 2) {
            const current = validSeries[validSeries.length - 1];
            const previous = validSeries[validSeries.length - 2];

            if (current.adjclose != null) {
                price = current.adjclose;
            } else if (current.close != null) {
                price = current.close;
            }

            if (previous.adjclose != null) {
                previousPrice = previous.adjclose;
            } else if (previous.close != null) {
                previousPrice = previous.close;
            }
        }

        if (price == null || previousPrice == null) {
            return null;
        }

        const change = price - previousPrice;
        const changePercent = previousPrice === 0 ? 0 : (change / previousPrice) * 100;

        // Mini-chart data (last 30 data points)
        const chartData = series
            .slice(-30)
            .map((row) =>
                typeof row.adjclose === 'number'
                    ? row.adjclose
                    : typeof row.close === 'number'
                        ? row.close
                        : null
            )
            .filter((value) => typeof value === 'number');

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
            const idxSymbol = normalizedSymbol.replace(/\.JK$/i, '');
            logoUrl = `${SUPABASE_STORAGE_BASE}/idx/${idxSymbol}.png`;
        } else if (isCrypto) {
            // Crypto logos are not in chart().meta — fetch from quote() metadata
            try {
                const quoteMeta = await yahooFinance.quote(symbol);
                logoUrl = quoteMeta?.companyLogoUrl || quoteMeta?.logoUrl || null;
            } catch {
                // Silently fail — no logo is fine
            }
        } else if (isUsMarket) {
            logoUrl =
                (await ensureUsLogo(normalizedSymbol)) ||
                `${SUPABASE_STORAGE_BASE}/us/${normalizedSymbol}.svg`;
        }

        return {
            symbol: normalizedSymbol,
            name: meta.longName || meta.shortName || meta.symbol || symbol,
            price,
            change,
            changePercent,
            chartData,
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

        if (!Array.isArray(symbols) || symbols.length === 0) {
            return Response.json(
                {
                    HIDUP_JOKOWI: encodePayload({
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
                    HIDUP_JOKOWI: encodePayload({
                        error: 'No valid symbols provided',
                    }),
                },
                { status: 400 }
            );
        }

        // Fetch all quotes with concurrency control
        const tasks = uniqueSymbols.map(
            (symbol) => () => fetchSymbolQuote(symbol)
        );
        const results = await promisePool(tasks, CONCURRENCY_LIMIT);

        // Build results map
        const quotesMap = {};
        results.forEach((result) => {
            if (result) {
                quotesMap[result.symbol] = result;
            }
        });

        return Response.json({
            HIDUP_JOKOWI: encodePayload({
                quotes: quotesMap,
                meta: {
                    requested: uniqueSymbols.length,
                    resolved: Object.keys(quotesMap).length,
                    provider: 'yahoo-finance2',
                },
            }),
        });
    } catch (error) {
        console.error('[quotes] Batch error:', error);
        return Response.json(
            {
                HIDUP_JOKOWI: encodePayload({
                    error: error?.message || 'Internal server error',
                }),
            },
            { status: 500 }
        );
    }
}
