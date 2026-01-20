import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Calculate momentum score based on price changes
 * Momentum = weighted combination of short and medium term returns
 */
function calculateMomentumScore(stock) {
  const weekChange = stock.price_1_week_pct_change || 0;
  const monthChange = stock.price_1_month_pct_change || 0;
  
  // Weighted momentum: 40% weekly, 60% monthly
  const momentum = (weekChange * 0.4) + (monthChange * 0.6);
  
  return momentum;
}

/**
 * Determine momentum status based on score
 */
function getMomentumStatus(score) {
  if (score >= 5) return { label: 'Strong Bullish', variant: 'success' };
  if (score >= 2) return { label: 'Bullish', variant: 'success' };
  if (score >= 0) return { label: 'Neutral', variant: 'warning' };
  if (score >= -3) return { label: 'Bearish', variant: 'danger' };
  return { label: 'Strong Bearish', variant: 'danger' };
}

/**
 * GET /api/momentum
 * Fetches momentum analysis data from ajaib_stocks
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
    const filter = searchParams.get('filter') || 'all'; // all, bullish, bearish, gainers, losers

    // Fetch all stocks with price data
    const { data: stocks, error } = await supabase
      .from('ajaib_stocks')
      .select('*')
      .not('price_1_week_pct_change', 'is', null)
      .not('price_1_month_pct_change', 'is', null)
      .not('market_cap', 'is', null)
      .order('market_cap', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stocks' },
        { status: 500 }
      );
    }

    // Process stocks with momentum calculations
    let processedStocks = (stocks || []).map(stock => {
      const momentumScore = calculateMomentumScore(stock);
      const status = getMomentumStatus(momentumScore);

      return {
        code: stock.code,
        name: stock.name,
        price: stock.price,
        marketCap: stock.market_cap,
        volume: stock.volume,
        weekChange: stock.price_1_week_pct_change,
        monthChange: stock.price_1_month_pct_change,
        momentumScore: parseFloat(momentumScore.toFixed(2)),
        status,
        logo_url: `https://yjygsxwzkkjhvigedvdy.supabase.co/storage/v1/object/public/idx/${stock.code}.png`,
      };
    });

    // Apply filters
    if (filter === 'bullish') {
      processedStocks = processedStocks.filter(s => s.momentumScore >= 2);
    } else if (filter === 'bearish') {
      processedStocks = processedStocks.filter(s => s.momentumScore < 0);
    } else if (filter === 'gainers') {
      processedStocks = processedStocks
        .filter(s => s.weekChange > 0)
        .sort((a, b) => b.weekChange - a.weekChange);
    } else if (filter === 'losers') {
      processedStocks = processedStocks
        .filter(s => s.weekChange < 0)
        .sort((a, b) => a.weekChange - b.weekChange);
    }

    // Calculate summary stats
    const totalStocks = processedStocks.length;
    const bullishCount = processedStocks.filter(s => s.momentumScore >= 2).length;
    const bearishCount = processedStocks.filter(s => s.momentumScore < 0).length;
    const neutralCount = totalStocks - bullishCount - bearishCount;
    
    const avgMomentum = totalStocks > 0 
      ? processedStocks.reduce((sum, s) => sum + s.momentumScore, 0) / totalStocks 
      : 0;

    // Top gainers and losers (top 10 each)
    const sortedByWeek = [...processedStocks].sort((a, b) => b.weekChange - a.weekChange);
    const topGainers = sortedByWeek.slice(0, 10);
    const topLosers = sortedByWeek.slice(-10).reverse();

    const payload = {
      stocks: processedStocks,
      summary: {
        totalStocks,
        bullishCount,
        bearishCount,
        neutralCount,
        avgMomentum: parseFloat(avgMomentum.toFixed(2)),
        marketSentiment: avgMomentum >= 2 ? 'Bullish' : avgMomentum >= 0 ? 'Neutral' : 'Bearish',
      },
      topGainers,
      topLosers,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      HIDUP_JOKOWI: encodePayload(payload),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
