import yahooFinance from '@/lib/yahoo-finance';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const RANGE_CONFIG = {
  '1D': { interval: '15m', lookbackMs: 2 * DAY_IN_MS, filterMs: 1 * DAY_IN_MS },
  '1W': { interval: '60m', lookbackMs: 14 * DAY_IN_MS, filterMs: 7 * DAY_IN_MS },
  '1M': { interval: '1d', lookbackMs: 60 * DAY_IN_MS, filterMs: 31 * DAY_IN_MS },
  '3M': { interval: '1d', lookbackMs: 150 * DAY_IN_MS, filterMs: 92 * DAY_IN_MS },
  'YTD': { interval: '1d', type: 'ytd' },
  '1Y': { interval: '1d', lookbackMs: 370 * DAY_IN_MS, filterMs: 365 * DAY_IN_MS },
  '3Y': { interval: '1d', lookbackMs: 4 * 365 * DAY_IN_MS, filterMs: 3 * 365 * DAY_IN_MS },
  '5Y': { interval: '1d', lookbackMs: 6 * 365 * DAY_IN_MS, filterMs: 5 * 365 * DAY_IN_MS },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const rangeParam = (searchParams.get('range') || 'YTD').toUpperCase();

  if (!symbol) {
    return Response.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const config = RANGE_CONFIG[rangeParam];
  if (!config) {
    return Response.json(
      { error: `Unsupported range. Use one of ${Object.keys(RANGE_CONFIG).join(', ')}` },
      { status: 400 }
    );
  }

  const now = new Date();
  let period1;

  if (config.type === 'ytd') {
    period1 = new Date(now.getFullYear(), 0, 1);
  } else if (config.lookbackMs) {
    period1 = new Date(now.getTime() - config.lookbackMs);
  } else {
    // Fallback: 1 year
    period1 = new Date(now.getTime() - 365 * DAY_IN_MS);
  }

  // Intraday intervals cannot exceed 60 days on Yahoo Finance
  // Clamp the lookback if needed
  if (config.interval && ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'].includes(config.interval)) {
    const maxLookback = 60 * DAY_IN_MS;
    const minPeriod1 = new Date(now.getTime() - maxLookback);
    if (period1 < minPeriod1) {
      period1 = minPeriod1;
    }
  }

  try {
    const result = await yahooFinance.chart(symbol, {
      period1,
      period2: now,
      interval: config.interval,
      includePrePost: true,
    });

    const quotes = result?.quotes ?? [];
    if (quotes.length === 0) {
      return Response.json(
        { error: 'No price data for requested range' },
        { status: 404 }
      );
    }

    const rawPoints = quotes
      .map((quote) => {
        if (!quote?.date) return null;
        const price =
          quote.adjclose ??
          quote.close ??
          quote.open ??
          null;
        if (price == null) return null;
        return {
          timestamp: quote.date.getTime(),
          date: quote.date.toISOString(),
          price,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);

    const filterWindowMs =
      config.type === 'ytd'
        ? now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()
        : config.filterMs ?? config.lookbackMs;
    const cutoffTimestamp =
      config.type === 'ytd'
        ? new Date(now.getFullYear(), 0, 1).getTime()
        : now.getTime() - (filterWindowMs || 0);

    const data = rawPoints.filter((point) => {
      if (!cutoffTimestamp) return true;
      return point.timestamp >= cutoffTimestamp;
    });

    return Response.json({
      data: data.length > 0 ? data : rawPoints,
      meta: {
        symbol: result?.meta?.symbol ?? symbol,
        currency: result?.meta?.currency,
        interval: config.interval,
        range: rangeParam,
        provider: 'yahoo-finance2',
      },
    });
  } catch (error) {
    console.error('[price-series] Failed to fetch data:', error);
    const message = error?.message || 'Failed to fetch price data';
    const status = message.includes('No data') ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
