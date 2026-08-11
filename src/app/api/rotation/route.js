import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/rotation
 * Fetches top 50 IDX stocks by market cap for rotation analysis
 * Returns price change data for weekly and monthly timeframes
 */
export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { payload: encodePayload({ error: 'Supabase configuration missing' }) },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch top 50 stocks by market cap
    const { data: stocks, error } = await supabase
      .from('ajaib_stocks')
      .select('code, name, price, market_cap, volume, price_1_week_pct_change, price_1_month_pct_change')
      .not('market_cap', 'is', null)
      .order('market_cap', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { payload: encodePayload({ error: 'Failed to fetch stocks' }) },
        { status: 500 }
      );
    }

    // Process stocks into rotation quadrants
    // Using weekly change for momentum (x-axis) and monthly change for trend (y-axis)
    const processedStocks = (stocks || []).map(stock => {
      const weeklyChange = stock.price_1_week_pct_change || 0;
      const monthlyChange = stock.price_1_month_pct_change || 0;

      // Determine quadrant based on momentum and trend
      // Quadrant 1 (Leading): positive weekly, positive monthly
      // Quadrant 2 (Weakening): negative weekly, positive monthly
      // Quadrant 3 (Lagging): negative weekly, negative monthly
      // Quadrant 4 (Improving): positive weekly, negative monthly
      let quadrant;
      if (weeklyChange >= 0 && monthlyChange >= 0) {
        quadrant = 'leading';
      } else if (weeklyChange < 0 && monthlyChange >= 0) {
        quadrant = 'weakening';
      } else if (weeklyChange < 0 && monthlyChange < 0) {
        quadrant = 'lagging';
      } else {
        quadrant = 'improving';
      }

      return {
        code: stock.code,
        name: stock.name,
        price: stock.price,
        marketCap: stock.market_cap,
        volume: stock.volume,
        weeklyChange,
        monthlyChange,
        quadrant,
        // Normalized values for chart positioning (-100 to 100 range)
        x: Math.max(-100, Math.min(100, weeklyChange * 5)), // momentum
        y: Math.max(-100, Math.min(100, monthlyChange * 3)), // trend
      };
    });

    // Group by quadrant for summary
    const quadrantSummary = {
      leading: processedStocks.filter(s => s.quadrant === 'leading'),
      weakening: processedStocks.filter(s => s.quadrant === 'weakening'),
      lagging: processedStocks.filter(s => s.quadrant === 'lagging'),
      improving: processedStocks.filter(s => s.quadrant === 'improving'),
    };

    const payload = {
      stocks: processedStocks,
      summary: {
        leading: quadrantSummary.leading.length,
        weakening: quadrantSummary.weakening.length,
        lagging: quadrantSummary.lagging.length,
        improving: quadrantSummary.improving.length,
        total: processedStocks.length,
      },
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      payload: encodePayload(payload),
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { payload: encodePayload({ error: 'Internal server error' }) },
      { status: 500 }
    );
  }
}
