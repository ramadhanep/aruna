import { NextResponse } from 'next/server';

// Simple Yahoo Finance symbol search proxy using autocomplete endpoint
// Note: Public Yahoo endpoints may have CORS restrictions; this proxy allows client usage.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  if (!query || query.length < 1) {
    return NextResponse.json({ symbols: [] });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;    
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed upstream', symbols: [] }, { status: 502 });
    }
    const json = await res.json();
    const symbols = (json.quotes || [])
      .filter(q => q.symbol && q.shortname)
      .map(q => ({ symbol: q.symbol, name: q.shortname }));
    return NextResponse.json({ symbols });
  } catch (e) {
    return NextResponse.json({ error: e.message, symbols: [] }, { status: 500 });
  }
}
