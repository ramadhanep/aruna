import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/bubbles?timeframe=weekly|monthly
 * Fetches IDX stocks from ajaib_stocks for bubble visualization
 * Sorted by percent change (largest changes get largest bubbles)
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
    
    // Get timeframe from query string (default: weekly)
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'weekly';
    
    // Determine which field to use for sorting
    const changeField = timeframe === 'monthly' 
      ? 'price_1_month_pct_change' 
      : 'price_1_week_pct_change';

    // Fetch stocks sorted by absolute percent change (largest changes first)
    const { data: stocks, error } = await supabase
      .from('ajaib_stocks')
      .select('code, name, price, market_cap, volume, price_1_week_pct_change, price_1_month_pct_change')
      .not(changeField, 'is', null)
      .not('market_cap', 'is', null)
      .order(changeField, { ascending: false })
      .limit(100);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stocks' },
        { status: 500 }
      );
    }

    // Sort by absolute value of percent change (biggest movers)
    const sortedStocks = (stocks || []).sort((a, b) => {
      const changeA = Math.abs(a[changeField] || 0);
      const changeB = Math.abs(b[changeField] || 0);
      return changeB - changeA;
    });

    const payload = {
      stocks: sortedStocks.slice(0, 100),
      timeframe,
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
