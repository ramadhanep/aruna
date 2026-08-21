import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';
import { calculateMSCIMetrics, calculateSummaryStats } from '@/lib/msci-calculations';
import { getIdxLogoUrl } from '@/lib/supabase-storage';
import yahooFinance from '@/lib/yahoo-finance';
import { readMarketDataCache, writeMarketDataCache, dedupeInflight } from '@/lib/market-data-cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FX_SYMBOL = 'IDR=X';
const FALLBACK_USD_TO_IDR = 15_800;

/**
 * Live USD/IDR rate, cached in quote_cache like every other quote (60 s TTL).
 * Falls back to 15_800 on any failure — a stale rate beats a broken page.
 */
async function getUsdToIdr() {
  try {
    const { fresh } = await readMarketDataCache('quote_cache', [FX_SYMBOL], '1D');
    const cachedRate = fresh.get(FX_SYMBOL);
    if (cachedRate && Number.isFinite(cachedRate.price) && cachedRate.price > 0) {
      return cachedRate.price;
    }
  } catch {
    // fall through to live fetch
  }

  try {
    const quote = await dedupeInflight(`quote:1D:${FX_SYMBOL}`, () => yahooFinance.quote(FX_SYMBOL));
    const rate = quote?.regularMarketPrice;
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      await writeMarketDataCache('quote_cache', '1D', [
        { symbol: FX_SYMBOL, payload: { symbol: FX_SYMBOL, price: rate } },
      ]);
      return rate;
    }
  } catch (error) {
    console.warn('[msci] USD/IDR fetch failed, using fallback:', error.message);
  }

  return FALLBACK_USD_TO_IDR;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/msci
 * Fetches MSCI stocks with real-time data from Bibit API (via bibit_stocks table)
 */
export async function GET(request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Supabase configuration missing' }) },
        { status: 500 }
      );
    }

    const usdToIdr = await getUsdToIdr();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const indexFilter = searchParams.get('index'); // 'standard' or 'small_cap'

    // Fetch MSCI stocks from database
    let query = supabase
      .from('msci_stocks')
      .select('*')
      .order('order', { ascending: true })
      .order('company_name');

    if (indexFilter && (indexFilter === 'standard' || indexFilter === 'small_cap')) {
      query = query.eq('msci_index', indexFilter);
    }

    const { data: msciStocks, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { payload: encodePayload({ error: 'Failed to fetch MSCI stocks' }) },
        { status: 500 }
      );
    }

    if (!msciStocks || msciStocks.length === 0) {
      return NextResponse.json({
        payload: encodePayload({
          stocks: [],
          summary: {
            standard: { totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 },
            small_cap: { totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 },
          },
          lastUpdated: new Date().toISOString(),
        }),
      });
    }

    // Fetch real-time market data from bibit_stocks table
    const symbols = msciStocks.map(stock => stock.ticker.replace('.JK', ''));
    
    const { data: bibitStocks, error: bibitError } = await supabase
      .from('bibit_stocks')
      .select('*')
      .in('symbol', symbols);

    if (bibitError) {
      console.error('Bibit data fetch error:', bibitError);
      return NextResponse.json(
        { payload: encodePayload({ error: 'Failed to fetch market data' }) },
        { status: 500 }
      );
    }

    // Create map for easy lookup
    const bibitMap = {};
    (bibitStocks || []).forEach(stock => {
      bibitMap[stock.symbol] = stock;
    });

    // Helper function to parse market cap string from Bibit (e.g. "92,540 B" -> number in billions)
    const parseMarketCap = (mcapString) => {
      if (!mcapString) return 0;
      
      // Remove commas and split by space
      const parts = mcapString.replace(/,/g, '').trim().split(' ');
      if (parts.length !== 2) return 0;
      
      const value = parseFloat(parts[0]);
      const unit = parts[1].toUpperCase();
      
      // Convert to consistent unit (assume in Rupiah billions)
      if (unit === 'B') return value * 1000000000; // Billions to actual number
      if (unit === 'T') return value * 1000000000000; // Trillions to actual number
      if (unit === 'M') return value * 1000000; // Millions to actual number
      
      return value;
    };

    // Merge data and calculate MSCI metrics
    const enrichedStocks = msciStocks.map(stock => {
      const symbol = stock.ticker.replace('.JK', '');
      const bibitData = bibitMap[symbol] || {};
      
      const stockWithMarketData = {
        ...stock,
        price: bibitData.price || 0,
        market_cap: parseMarketCap(bibitData.key_stats_market_cap),
        volume: bibitData.key_stats_volume || 0,
        logo_url: getIdxLogoUrl(symbol) || bibitData.icon_url,
        price_1_week: 0, // Bibit doesn't provide this, set to 0
        price_1_month: 0, // Bibit doesn't provide this, set to 0
      };

      const metrics = calculateMSCIMetrics(stockWithMarketData, usdToIdr);

      return {
        ...stockWithMarketData,
        ...metrics,
      };
    });

    // Cache the results (upsert into msci_snapshot_cache)
    const cacheRecords = enrichedStocks.map(stock => ({
      ticker: stock.ticker,
      price: stock.price,
      market_cap: stock.market_cap,
      free_float_mcap: stock.freeFloatMcap,
      last_updated_at: new Date().toISOString(),
    }));

    if (cacheRecords.length > 0) {
      const { error: cacheError } = await supabase
        .from('msci_snapshot_cache')
        .upsert(cacheRecords, { onConflict: 'ticker' });

      if (cacheError) {
        console.error('Cache error:', cacheError);
      }
    }

    // Calculate summary statistics by index type
    const standardStocks = enrichedStocks.filter(s => s.msci_index === 'standard');
    const smallCapStocks = enrichedStocks.filter(s => s.msci_index === 'small_cap');

    const summary = {
      standard: calculateSummaryStats(standardStocks),
      small_cap: calculateSummaryStats(smallCapStocks),
    };

    // Get last updated time from bibit_stocks
    const lastUpdated = bibitStocks && bibitStocks.length > 0
      ? bibitStocks[0].updated_at
      : new Date().toISOString();

    return NextResponse.json({
        payload: encodePayload({
            stocks: enrichedStocks,
            summary,
            lastUpdated,
            usdToIdr,
        })
    });

  } catch (error) {
    console.error('MSCI API error:', error);
    return NextResponse.json(
      { payload: encodePayload({ error: 'Internal server error', details: error.message }) },
      { status: 500 }
    );
  }
}
