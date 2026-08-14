import yahooFinance from '@/lib/yahoo-finance';
import { encodePayload } from '@/lib/secure-payload';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return Response.json(
      { payload: encodePayload({ error: 'Missing symbol parameter' }) },
      { status: 400 }
    );
  }

  try {
    const result = await yahooFinance.search(symbol, { newsCount: 10 });
    const newsItems = result.news || [];

    return Response.json({ payload: encodePayload({ news: newsItems }) });
  } catch (error) {
    console.error('Error fetching Yahoo Finance news for', symbol, error);
    return Response.json(
      { payload: encodePayload({ error: 'Failed to fetch news' }) },
      { status: 500 }
    );
  }
}