import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encodePayload } from '@/lib/secure-payload';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/bubbles
 * Fetches all IDX stocks from ajaib_stocks for bubble visualization
 */
export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ALL stocks with price change data
    const { data: stocks, error } = await supabase
      .from('ajaib_stocks')
      .select('code, name, price, market_cap, volume, price_1_week_pct_change, price_1_month_pct_change')
      .not('price_1_week_pct_change', 'is', null)
      .not('market_cap', 'is', null)
      .order('market_cap', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stocks' },
        { status: 500 }
      );
    }

    const payload = {
      stocks: stocks || [],
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
