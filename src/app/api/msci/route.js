import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';
import { calculateMSCIMetrics } from '@/lib/msci-calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/msci
 * Fetches MSCI stocks with real-time data from Ajaib API (via ajaib_stocks table)
 */
export async function GET(request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

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
        { error: 'Failed to fetch MSCI stocks' },
        { status: 500 }
      );
    }

    if (!msciStocks || msciStocks.length === 0) {
      return NextResponse.json({
        stocks: [],
        summary: {
          standard: { totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 },
          small_cap: { totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 },
        },
        lastUpdated: new Date().toISOString(),
      });
    }

    // Fetch real-time market data from ajaib_stocks table
    const tickers = msciStocks.map(stock => stock.ticker.replace('.JK', ''));
    
    const { data: ajaibStocks, error: ajaibError } = await supabase
      .from('ajaib_stocks')
      .select('*')
      .in('code', tickers);

    if (ajaibError) {
      console.error('Ajaib data fetch error:', ajaibError);
      return NextResponse.json(
        { error: 'Failed to fetch market data' },
        { status: 500 }
      );
    }

    // Create map for easy lookup
    const ajaibMap = {};
    (ajaibStocks || []).forEach(stock => {
      ajaibMap[stock.code] = stock;
    });

    // Merge data and calculate MSCI metrics
    const enrichedStocks = msciStocks.map(stock => {
      const code = stock.ticker.replace('.JK', '');
      const ajaibData = ajaibMap[code] || {};
      
      const stockWithMarketData = {
        ...stock,
        price: ajaibData.price || 0,
        market_cap: ajaibData.market_cap || 0,
        volume: ajaibData.volume || 0,
        logo_url: `https://yjygsxwzkkjhvigedvdy.supabase.co/storage/v1/object/public/idx/${code}.png`,
        price_1_week: ajaibData.price_1_week_pct_change || 0,
        price_1_month: ajaibData.price_1_month_pct_change || 0,
      };

      const metrics = calculateMSCIMetrics(stockWithMarketData);

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

    const calculateStats = (stocks) => {
      if (!stocks.length) return { totalStocks: 0, nearestProgress: 0, averageFreeFloat: 0 };
      return {
        totalStocks: stocks.length,
        nearestProgress: Math.max(...stocks.map(s => s.progress || 0)),
        averageFreeFloat: stocks.reduce((sum, s) => sum + (s.free_float_percent || 0), 0) / stocks.length,
      };
    };

    const summary = {
      standard: calculateStats(standardStocks),
      small_cap: calculateStats(smallCapStocks),
    };

    // Get last updated time from ajaib_stocks
    const lastUpdated = ajaibStocks && ajaibStocks.length > 0
      ? ajaibStocks[0].updated_at
      : new Date().toISOString();

    return NextResponse.json({
        HIDUP_JOKOWI: encodePayload({
            stocks: enrichedStocks,
            summary,
            lastUpdated,
        })
    });

  } catch (error) {
    console.error('MSCI API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
