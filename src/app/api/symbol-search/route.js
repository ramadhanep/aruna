import { NextResponse } from 'next/server';
import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';

// Symbol search using yahoo-finance2 search endpoint
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json({ mainnya_kejauhan_adek____jangan_ke_sini_lagi_ya_nanti_dimarahin_mamah_loh: encodePayload({ symbols: [] }) });
  }

  try {
    const result = await yahooFinance.search(query, {
      quotesCount: 10,
      newsCount: 0,
    });
    const symbols = (result?.quotes || [])
      .filter((q) => q?.symbol && (q.shortname || q.longname))
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange,
        type: q.quoteType,
      }));
    return NextResponse.json({
      mainnya_kejauhan_adek____jangan_ke_sini_lagi_ya_nanti_dimarahin_mamah_loh: encodePayload({ symbols, source: { provider: 'yahoo-finance2' } }),
    });
  } catch (error) {
    console.error('Symbol search failed', error);
    return NextResponse.json(
      { mainnya_kejauhan_adek____jangan_ke_sini_lagi_ya_nanti_dimarahin_mamah_loh: encodePayload({ error: error?.message || 'Search failed', symbols: [] }) },
      { status: 500 }
    );
  }
}
