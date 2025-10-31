/**
 * Yahoo Finance API proxy route
 * Fetches historical price data for a given symbol
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const startDate = searchParams.get('startDate'); // Unix timestamp
  const endDate = searchParams.get('endDate'); // Unix timestamp

  if (!symbol || !startDate || !endDate) {
    return Response.json(
      { error: 'Missing required parameters: symbol, startDate, endDate' },
      { status: 400 }
    );
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${startDate}&period2=${endDate}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return Response.json(
        { error: `Yahoo Finance API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const adjclose = result.indicators.adjclose[0].adjclose;
    const meta = result.meta;

    const prices = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString(),
      adjclose: adjclose[i],
    }));

    return Response.json({ 
      data: prices,
      meta: {
        symbol: meta.symbol,
        name: meta.longName || meta.shortName || meta.symbol,
        currency: meta.currency,
        exchangeName: meta.exchangeName,
      }
    });
  } catch (error) {
    console.error('Error fetching Yahoo Finance data:', error);
    return Response.json(
      { error: 'Failed to fetch data from Yahoo Finance' },
      { status: 500 }
    );
  }
}
