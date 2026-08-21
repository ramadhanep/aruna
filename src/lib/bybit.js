// Bybit v5 public market data — no API key needed for market endpoints.
// Used as a fast provider for crypto symbols (Yahoo-style `BTC-USD`), with
// callers falling back to Yahoo on any failure. Spot prices are USDT-quoted;
// USD and USDT are close enough for retail display purposes.
//
// ponytail: kline limit capped at 1000 candles (Bybit max, no pagination) —
// crypto intraday history is shorter than stock equivalents; paginate when
// someone actually scrolls that far back.

import { computeTimeframeChange, downsampleSeries } from '@/lib/chart-helpers';

const BYBIT_BASE = 'https://api.bybit.com';

// Accepts both conventions:
//   Yahoo style:  BTC-USD, SOL-USDT
//   Native style: BTCUSDT (stored/displayed form)
const CRYPTO_YAHOO_RE = /^[A-Z0-9]{2,20}-USD(T)?$/i;
const CRYPTO_NATIVE_RE = /^[A-Z0-9]{2,20}USDT$/i;

export function isCryptoSymbol(symbol) {
  if (typeof symbol === 'string') {
    const s = symbol.trim();
    if (CRYPTO_YAHOO_RE.test(s) || CRYPTO_NATIVE_RE.test(s)) return true;
  }
  return false;
}

// BTC-USD -> BTCUSDT; BTCUSDT passes through unchanged.
export function toBybitSymbol(symbol) {
  return symbol.trim().replace(/-USD(T)?$/i, 'USDT').toUpperCase();
}

async function bybitGet(path, params) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${BYBIT_BASE}${path}?${query}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Bybit HTTP ${response.status}`);
  }
  const body = await response.json();
  if (body?.retCode !== 0) {
    throw new Error(`Bybit ${body.retCode}: ${body.retMsg}`);
  }
  return body.result;
}

// Bybit interval tokens for /v5/market/kline.
const KLINE_INTERVAL_BY_TIMEFRAME = {
  '15M': '15',
  '1H': '60',
  '2H': '60',
  '4H': '60',
  D: 'D',
  W: 'W',
  M: 'M',
};

// Candles per trading day per timeframe — used to size the `limit` param.
const CANDLES_PER_DAY = {
  '15M': 96,
  '1H': 24,
  '2H': 12,
  '4H': 6,
  D: 1,
  W: 1 / 7,
  M: 1 / 30,
};

export function bybitKlineInterval(timeframe) {
  return KLINE_INTERVAL_BY_TIMEFRAME[timeframe] ?? null;
}

// Raw rows are [startMs, open, high, low, close, volume, turnover] strings,
// newest first. Returns ascending normalized points matching the shape used
// by /api/price-series.
export function normalizeKlineRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const timestamp = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      if (!Number.isFinite(timestamp) || !Number.isFinite(close)) return null;
      return {
        timestamp,
        date: new Date(timestamp).toISOString(),
        price: close,
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : Math.max(open, close),
        low: Number.isFinite(low) ? low : Math.min(open, close),
        close,
        volume: Number.isFinite(volume) ? volume : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchKlines(symbol, timeframe, lookbackDays) {
  const interval = bybitKlineInterval(timeframe);
  if (!interval) {
    throw new Error(`Bybit: unsupported timeframe ${timeframe}`);
  }
  const limit = Math.max(2, Math.min(1000, Math.ceil(lookbackDays * (CANDLES_PER_DAY[timeframe] ?? 1))));
  const result = await bybitGet('/v5/market/kline', {
    category: 'spot',
    symbol,
    interval,
    limit: String(limit),
  });
  const points = normalizeKlineRows(result?.list);
  if (points.length === 0) {
    throw new Error(`Bybit: no klines for ${symbol}`);
  }
  return points;
}

/**
 * Full quote payload for a crypto symbol, shaped like fetchSymbolQuote()
 * output in /api/quotes so the UI needs no branching.
 */
export async function fetchBybitQuotePayload(symbolRaw, timeframe, lookbackDays) {
  const symbol = symbolRaw.toUpperCase();
  const bybitSymbol = toBybitSymbol(symbol);
  // Quote mini-charts are built from daily candles for every timeframe
  // (matches the Yahoo path); only the lookback differs.
  const points = await fetchKlines(bybitSymbol, 'D', Math.min(lookbackDays, 1000));

  const validSeries = points.map((point) => ({ date: point.date, price: point.close }));
  const current = validSeries[validSeries.length - 1];
  const previous = validSeries[validSeries.length - 2];

  const price = current.price;
  const previousPrice = previous.price;
  const change = price - previousPrice;
  const changePercent = previousPrice === 0 ? 0 : (change / previousPrice) * 100;

  const downsampledSeries = downsampleSeries(validSeries);

  return {
    symbol,
    name: symbol,
    price,
    change,
    changePercent,
    timeframe,
    timeframeChange: computeTimeframeChange(timeframe, price, previousPrice, validSeries),
    chartData: downsampledSeries.map((point) => point.price),
    chartTimestamps: downsampledSeries.map((point) => point.date),
    logo: null,
    meta: {
      currency: 'USD',
      exchangeName: 'BYBIT',
      regularMarketPrice: price,
      previousClose: previousPrice,
      chartPreviousClose: previousPrice,
      marketState: 'REGULAR',
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
    },
  };
}

/**
 * Series payload for a crypto symbol, shaped like /api/price-series output.
 * `aggregate` maps raw points through the route's candle aggregation.
 */
export async function fetchBybitSeriesPayload(symbolRaw, timeframe, lookbackDays, aggregate) {
  const symbol = symbolRaw.toUpperCase();
  let points = await fetchKlines(toBybitSymbol(symbol), timeframe, lookbackDays);
  if (typeof aggregate === 'function') {
    points = aggregate(points);
  }

  return {
    data: points,
    meta: {
      symbol,
      currency: 'USD',
      interval: timeframe === 'D' || timeframe === 'W' || timeframe === 'M' ? '1d' : '60m',
      timeframe,
      range: timeframe,
      provider: 'bybit',
    },
  };
}

// Yahoo interval -> Bybit kline interval. '5d'/'90m' unsupported -> caller
// falls back to Yahoo.
const FINANCE_INTERVAL_MAP = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '60m': '60',
  '1h': '60',
  '1d': 'D',
  '1wk': 'W',
  '1mo': 'M',
};

const INTERVAL_SECONDS = {
  '1': 60,
  '5': 300,
  '15': 900,
  '30': 1800,
  '60': 3600,
  D: 86_400,
  W: 604_800,
  M: 2_592_000,
};

/**
 * Chart-page payload for a crypto symbol, shaped like buildFinancePayload()
 * output in /api/finance (data rows carry date/OHLCV + adjclose=close).
 */
export async function fetchBybitFinancePayload(symbolRaw, interval, startSec, endSec) {
  const symbol = symbolRaw.toUpperCase();
  const bybitInterval = FINANCE_INTERVAL_MAP[interval];
  if (!bybitInterval) {
    throw new Error(`Bybit: unsupported interval ${interval}`);
  }

  const limit = Math.min(1000, Math.max(2, Math.ceil((endSec - startSec) / INTERVAL_SECONDS[bybitInterval])));
  const result = await bybitGet('/v5/market/kline', {
    category: 'spot',
    symbol: toBybitSymbol(symbol),
    interval: bybitInterval,
    limit: String(limit),
  });
  const points = normalizeKlineRows(result?.list);
  if (points.length === 0) {
    throw new Error(`Bybit: no klines for ${symbol}`);
  }

  const nativeSymbol = toBybitSymbol(symbol);
  const data = points.map((point) => ({
    date: point.date,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    volume: point.volume,
    adjclose: point.close,
  }));
  const lastClose = points[points.length - 1].close;

  return {
    data,
    meta: {
      symbol: nativeSymbol,
      name: nativeSymbol,
      logo: null,
      currency: 'USD',
      exchangeName: 'BYBIT',
      fullExchangeName: 'Bybit Spot',
      instrumentType: 'CRYPTOCURRENCY',
      regularMarketPrice: lastClose,
      previousClose: points.length > 1 ? points[points.length - 2].close : null,
      marketState: 'REGULAR',
      dataGranularity: interval,
      provider: 'bybit',
    },
  };
}
