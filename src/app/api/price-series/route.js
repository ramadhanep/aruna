import yahooFinance from '@/lib/yahoo-finance';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const TIMEFRAME_CONFIG = {
  '15M': { interval: '15m', lookbackDays: 30 },
  '1H': { interval: '1h', lookbackDays: 180 },
  '2H': { interval: '1h', lookbackDays: 180, groupSize: 2 },
  '4H': { interval: '1h', lookbackDays: 240, groupSize: 4 },
  D: { interval: '1d', lookbackDays: 365 * 2 },
  W: { interval: '1wk', lookbackDays: 365 * 7 },
  M: { interval: '1mo', lookbackDays: 365 * 15 },
};

const INTERVAL_TO_MS = {
  '1m': 60 * 1000,
  '2m': 2 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '60m': 60 * 60 * 1000,
  '90m': 90 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': DAY_IN_MS,
  '5d': 5 * DAY_IN_MS,
  '1wk': 7 * DAY_IN_MS,
  '1mo': 30 * DAY_IN_MS,
  '3mo': 90 * DAY_IN_MS,
};

function aggregateCandles(points = [], groupSize = 1, interval) {
  if (!Array.isArray(points) || !Number.isInteger(groupSize) || groupSize <= 1) {
    return points;
  }
  const chunk = [];
  const aggregated = [];
  const intervalMs = INTERVAL_TO_MS[interval] || null;
  let lastTimestamp = null;

  const flushChunk = () => {
    if (chunk.length === 0) return;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    let high = null;
    let low = null;
    let volumeSum = 0;

    chunk.forEach((point) => {
      if (typeof point.high === 'number' && Number.isFinite(point.high)) {
        high = high == null ? point.high : Math.max(high, point.high);
      }
      if (typeof point.low === 'number' && Number.isFinite(point.low)) {
        low = low == null ? point.low : Math.min(low, point.low);
      }
      if (typeof point.volume === 'number' && Number.isFinite(point.volume)) {
        volumeSum += point.volume;
      }
    });

    const open =
      typeof first.open === 'number' && Number.isFinite(first.open)
        ? first.open
        : typeof first.price === 'number' && Number.isFinite(first.price)
          ? first.price
          : last.close;
    const close =
      typeof last.close === 'number' && Number.isFinite(last.close)
        ? last.close
        : typeof last.price === 'number' && Number.isFinite(last.price)
          ? last.price
          : open;

    aggregated.push({
      timestamp: last.timestamp,
      date: last.date ?? new Date(last.timestamp).toISOString(),
      price: close,
      open,
      high: high ?? Math.max(open, close),
      low: low ?? Math.min(open, close),
      close,
      volume: Number.isFinite(volumeSum) ? volumeSum : null,
    });
    chunk.length = 0;
  };

  points.forEach((point) => {
    if (
      chunk.length > 0 &&
      intervalMs &&
      lastTimestamp != null &&
      point.timestamp - lastTimestamp > intervalMs * 1.5
    ) {
      flushChunk();
    }
    chunk.push(point);
    lastTimestamp = point.timestamp;
    if (chunk.length === groupSize) {
      flushChunk();
    }
  });

  flushChunk();
  return aggregated;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const timeframeParam = (
    searchParams.get('timeframe') ||
    searchParams.get('range') ||
    'D'
  ).toUpperCase();

  if (!symbol) {
    return Response.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  const config = TIMEFRAME_CONFIG[timeframeParam];
  if (!config) {
    return Response.json(
      { error: `Unsupported timeframe. Use one of ${Object.keys(TIMEFRAME_CONFIG).join(', ')}` },
      { status: 400 }
    );
  }

  const now = new Date();
  const lookbackDays = config.lookbackDays ?? 365;
  let period1 = new Date(now.getTime() - lookbackDays * DAY_IN_MS);

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
        { error: 'No price data for requested timeframe' },
        { status: 404 }
      );
    }

    const rawPoints = quotes
      .map((quote) => {
        if (!quote?.date) return null;
        const timestamp = quote.date.getTime();
        const close =
          (typeof quote.adjclose === 'number' && Number.isFinite(quote.adjclose)
            ? quote.adjclose
            : null) ??
          (typeof quote.close === 'number' && Number.isFinite(quote.close)
            ? quote.close
            : null) ??
          (typeof quote.open === 'number' && Number.isFinite(quote.open)
            ? quote.open
            : null);
        if (close == null) return null;
        const open =
          typeof quote.open === 'number' && Number.isFinite(quote.open) ? quote.open : close;
        const high =
          typeof quote.high === 'number' && Number.isFinite(quote.high)
            ? quote.high
            : Math.max(open, close);
        const low =
          typeof quote.low === 'number' && Number.isFinite(quote.low) ? quote.low : Math.min(open, close);
        const volume =
          typeof quote.volume === 'number' && Number.isFinite(quote.volume) ? quote.volume : null;

        return {
          timestamp,
          date: quote.date.toISOString(),
          price: close,
          open,
          high,
          low,
          close,
          volume,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);
    const processedPoints = aggregateCandles(rawPoints, config.groupSize ?? 1, config.interval);
    const data = processedPoints.length > 0 ? processedPoints : rawPoints;

    return Response.json({
      data,
      meta: {
        symbol: result?.meta?.symbol ?? symbol,
        currency: result?.meta?.currency,
        interval: config.interval,
        timeframe: timeframeParam,
        range: timeframeParam,
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
