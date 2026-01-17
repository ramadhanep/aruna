import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';
import yahooFinance from '@/lib/yahoo-finance';
import { calculateMSCIMetrics } from '@/lib/msci-calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Fetch real-time quote data from Yahoo Finance
 */
async function fetchYahooQuote(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    return {
      ticker,
      price: quote.regularMarketPrice || 0,
      marketCap: quote.marketCap || 0,
      success: true,
    };
  } catch (error) {
    console.error(`Failed to fetch quote for ${ticker}:`, error.message);
    return {
      ticker,
      price: 0,
      marketCap: 0,
      success: false,
    };
  }
}

/**
 * Fetch quotes for multiple tickers in batches
 */
async function fetchMultipleQuotes(tickers, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(ticker => fetchYahooQuote(ticker))
    );
    results.push(...batchResults);
    
    // Small delay between batches to be respectful
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * GET /api/msci
 * Fetches MSCI stocks with real-time data and calculations
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

    // Fetch real-time market data from Yahoo Finance
    const tickers = msciStocks.map(stock => stock.ticker);
    const quotes = await fetchMultipleQuotes(tickers);
    
    // Create quote map for easy lookup
    const quoteMap = {};
    quotes.forEach(q => {
      quoteMap[q.ticker] = q;
    });

    // Merge data and calculate MSCI metrics
    const enrichedStocks = msciStocks.map(stock => {
      const quote = quoteMap[stock.ticker] || { price: 0, marketCap: 0 };
      const idxSymbol = stock.ticker.replace('.JK', '');
      
      const stockWithMarketData = {
        ...stock,
        price: quote.price,
        market_cap: quote.marketCap,
        logo_url: `https://assets.stockbit.com/logos/companies/${idxSymbol}.png`,
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

    return NextResponse.json({
        HIDUP_JOKOWI: encodePayload({
            stocks: enrichedStocks,
            summary,
            lastUpdated: new Date().toISOString(),
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
