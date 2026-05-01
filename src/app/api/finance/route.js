import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';
import { getSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { writeYahooRawLog } from '@/lib/yahoo-raw-log';

const SUPABASE_STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;
const PLUANG_CDN_BASE = 'https://image-cdn.pluang.com/icons/light/global-stocks';

/**
 * Ensure a US stock logo exists in Supabase storage.
 * If missing, download from Pluang CDN and upload automatically.
 * Returns the Supabase public URL (or null on failure).
 */
async function ensureUsLogo(normalizedSymbol) {
  const supabaseUrl = `${SUPABASE_STORAGE_BASE}/us/${normalizedSymbol}.svg`;

  try {
    // 1. Check if logo already exists in Supabase storage
    const headRes = await fetch(supabaseUrl, { method: 'HEAD' });
    if (headRes.ok) {
      return supabaseUrl; // already exists
    }

    // 2. Download from Pluang CDN
    const cdnUrl = `${PLUANG_CDN_BASE}/${normalizedSymbol.toLowerCase()}.svg`;
    const cdnRes = await fetch(cdnUrl);
    if (!cdnRes.ok) {
      console.warn(`Pluang CDN returned ${cdnRes.status} for ${normalizedSymbol}`);
      return null;
    }

    const svgBuffer = Buffer.from(await cdnRes.arrayBuffer());

    // 3. Upload to Supabase storage via service role client
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) {
      console.warn('Supabase service role client unavailable, skipping logo upload');
      return null;
    }

    const { error: uploadError } = await supabase.storage
      .from('us')
      .upload(`${normalizedSymbol}.svg`, svgBuffer, {
        contentType: 'image/svg+xml',
        cacheControl: '31536000', // 1 year
        upsert: true,
      });

    if (uploadError) {
      console.warn(`Failed to upload ${normalizedSymbol}.svg to Supabase:`, uploadError.message);
      return null;
    }

    console.log(`Uploaded ${normalizedSymbol}.svg to Supabase storage`);
    return supabaseUrl;
  } catch (err) {
    console.warn(`ensureUsLogo error for ${normalizedSymbol}:`, err.message);
    return null;
  }
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

    const result = await yahooFinance.chart(symbol, chartOptions);
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

    // Handle empty results
    if (!result?.quotes || result.quotes.length === 0) {
      return Response.json(
        { payload: encodePayload({ error: 'No data available for the specified period. Symbol may be invalid or delisted.' }) },
        { status: 404 }
      );
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
      if (quoteMeta.market == 'id_market') {
        const idxSymbol = normalizedSymbol.replace(/\.JK$/i, '');
        logoUrl = `${SUPABASE_STORAGE_BASE}/idx/${idxSymbol}.png`;
      } else if (quoteMeta.market == 'us_market') {
        logoUrl = await ensureUsLogo(normalizedSymbol) || `${SUPABASE_STORAGE_BASE}/us/${normalizedSymbol}.svg`;
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

    return Response.json({
      payload: encodePayload({
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
      }),
    });
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
