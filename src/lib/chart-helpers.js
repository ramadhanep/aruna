export const CURRENT_LINE_COLOR = 'oklch(59.6% 0.145 163.225)';

export const SCREENING_CATEGORIES = ['idx', 'us', 'crypto'];

export function areWatchlistsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].symbol !== b[i].symbol || (a[i].order ?? i) !== (b[i].order ?? i)) {
      return false;
    }
  }
  return true;
}

export function matchScreeningEntry(results, targetSymbol) {
  if (!Array.isArray(results) || !targetSymbol) return null;
  const normalizedTarget = targetSymbol.trim().toUpperCase();
  if (!normalizedTarget) return null;
  for (const candidate of results) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      if (candidate.trim().toUpperCase() === normalizedTarget) {
        return { symbol: candidate, signal_date: null, is_warning: false, trading_plan: null };
      }
      continue;
    }
    if (
      typeof candidate === 'object' &&
      typeof candidate.symbol === 'string' &&
      candidate.symbol.trim().toUpperCase() === normalizedTarget
    ) {
      return {
        symbol: candidate.symbol,
        signal_date: candidate.signal_date ?? null,
        is_warning: Boolean(candidate.is_warning),
        trading_plan: candidate.trading_plan ?? null,
      };
    }
  }
  return null;
}

export function formatScreeningTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTimestamp(v, { dateOnly = false } = {}) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    const datePart = d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (dateOnly) return datePart;
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${datePart}, ${timePart}`;
  } catch {
    return null;
  }
}

export const cycleMetaMap = {
  trump: { label: 'Trump Years', lineKey: 'trumpYears' },
  all: { label: 'All Years', lineKey: 'allYears' },
  pre: { label: 'Pre-Election Year', lineKey: 'preElection' },
  election: { label: 'Election Year', lineKey: 'election' },
  mid: { label: 'Mid-Term Year', lineKey: 'midTerm' },
  post: { label: 'Post-Election Year', lineKey: 'postElection' },
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const NORMAL_TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '2h', label: '2h' },
  { value: '4h', label: '4h' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
  { value: 'M', label: '1M' },
];

export const INTRADAY_TIMEFRAMES = new Set(['15m', '1h', '2h', '4h']);

export const BASE_INFO_TABS = [
  { value: 'news', label: 'NEWS' },
  { value: 'keystats', label: 'KEYSTATS' },
  { value: 'analysis', label: 'ANALYSIS' },
  { value: 'financials', label: 'FINANCIALS' },
  { value: 'seasonality', label: 'SEASONALITY' },
  { value: 'profile', label: 'ABOUT' },
];

export const TP_FALLBACK_META = [
  { reason: 'Momentum Target', sellPercent: 30, action: 'Move Stop Loss to Breakeven' },
  { reason: 'Momentum Target', sellPercent: 40, action: 'Trail Stop to EMA20' },
  { reason: 'Momentum Target', sellPercent: 30, action: 'Exit Remaining Position' },
];

const INFO_TAB_QUERY_LOOKUP = {
  tradingplan: 'trading-plan',
  keystats: 'keystats',
  analysis: 'analysis',
  financials: 'financials',
  seasonality: 'seasonality',
  profile: 'profile',
  about: 'profile',
  news: 'news',
};

export function normalizeInfoTabParam(value) {
  if (!value) return null;
  const sanitized = String(value).replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (!sanitized) return null;
  return INFO_TAB_QUERY_LOOKUP[sanitized] ?? null;
}

export function infoTabToQueryValue(value) {
  if (!value) return null;
  const str = String(value);
  if (str === 'trading-plan') return 'tradingPlan';
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export const EMA_PERIOD = 31;
export const EMA_COLOR = '#0ea5e9';
export const BUY_SIGNAL_COLOR = '#10b981';
export const LIVERMORE_LOOKBACK = 31;
export const LIVERMORE_UPPER_COLOR = '#f97316';
export const LIVERMORE_LOWER_COLOR = '#6b7380';

export function computeRSI(values = [], period = 14) {
  const output = new Array(values.length).fill(null);
  if (values.length <= period) {
    return output;
  }

  let gainSum = 0;
  let lossSum = 0;
  let avgGain = null;
  let avgLoss = null;

  for (let i = 1; i < values.length; i++) {
    const current = values[i];
    const prev = values[i - 1];
    if (!Number.isFinite(current) || !Number.isFinite(prev)) {
      continue;
    }
    const change = current - prev;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      gainSum += gain;
      lossSum += loss;
      if (i === period) {
        avgGain = gainSum / period;
        avgLoss = lossSum / period;
        output[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else if (avgGain != null && avgLoss != null) {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      if (avgLoss === 0) {
        output[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        output[i] = 100 - 100 / (1 + rs);
      }
    }
  }

  return output;
}

export function smoothSeries(values = [], period = 3) {
  const result = new Array(values.length).fill(null);
  const window = [];
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const numeric = Number.isFinite(value) ? value : null;
    window.push(numeric);
    if (numeric != null) {
      sum += numeric;
      count += 1;
    }
    if (window.length > period) {
      const removed = window.shift();
      if (removed != null) {
        sum -= removed;
        count -= 1;
      }
    }
    if (window.length === period && count === period) {
      result[i] = sum / period;
    }
  }

  return result;
}

export function computeStochasticRSI(values = [], stochasticLength = 14, rsiLength = 14, smoothK = 3, smoothD = 3) {
  const rsiValues = computeRSI(values, rsiLength);
  const rawK = new Array(values.length).fill(null);

  for (let i = 0; i < rsiValues.length; i++) {
    const currentRsi = rsiValues[i];
    if (!Number.isFinite(currentRsi)) continue;
    const start = i - stochasticLength + 1;
    if (start < 0) continue;
    let min = Infinity;
    let max = -Infinity;
    let valid = true;
    for (let j = start; j <= i; j++) {
      const value = rsiValues[j];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (!valid || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
      continue;
    }
    rawK[i] = ((currentRsi - min) / (max - min)) * 100;
  }

  const smoothKValues = smoothSeries(rawK, smoothK);
  const smoothDValues = smoothSeries(smoothKValues, smoothD);
  return { k: smoothKValues, d: smoothDValues };
}

export function calculateEMA(values = [], period = 13) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }
  const multiplier = 2 / (period + 1);
  let emaValue = null;
  return values.map((value) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    emaValue = emaValue == null ? value : value * multiplier + emaValue * (1 - multiplier);
    return emaValue;
  });
}

export function computeLivermoreKeyLevels(points = [], lookback = 31) {
  if (!Array.isArray(points) || points.length === 0) {
    return { upper: [], lower: [], lookup: {} };
  }
  const upper = [];
  const lower = [];
  const lookup = {};
  const highs = [];
  const lows = [];
  points.forEach((point) => {
    if (!point || typeof point.time !== 'number') return;
    const high = Number.isFinite(point.high) ? point.high : null;
    const low = Number.isFinite(point.low) ? point.low : null;
    if (high == null || low == null) {
      lookup[point.time] = { upper: null, lower: null };
      return;
    }
    highs.push(high);
    lows.push(low);
    if (highs.length > lookback) highs.shift();
    if (lows.length > lookback) lows.shift();
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const upperValue = Number.isFinite(highest) ? Number(highest.toFixed(6)) : null;
    const lowerValue = Number.isFinite(lowest) ? Number(lowest.toFixed(6)) : null;
    lookup[point.time] = { upper: upperValue, lower: lowerValue };
    if (upperValue != null) {
      upper.push({ time: point.time, value: upperValue });
    }
    if (lowerValue != null) {
      lower.push({ time: point.time, value: lowerValue });
    }
  });
  return { upper, lower, lookup };
}

export function isIdxLotSymbol(symbol = '') {
  return /\.JK$/i.test(symbol?.trim?.() ?? '');
}

export function toFiniteNumber(value) {
  if (value === '' || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function getDefaultCyclesForSymbol() {
  return ['normal'];
}

export function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000;
  return Math.floor(diff / DAY_IN_MS);
}

export function getReturnCellStyle(value) {
  if (value == null || isNaN(value)) return {};
  const abs = Math.abs(value);
  const t = Math.min(1, abs / 10);
  const alpha = (0.15 + t * 0.65).toFixed(2);
  if (value > 0) return { backgroundColor: `rgba(34, 197, 94, ${alpha})`, color: t > 0.3 ? 'white' : undefined };
  if (value < 0) return { backgroundColor: `rgba(239, 68, 68, ${alpha})`, color: t > 0.3 ? 'white' : undefined };
  return {};
}

export function getQuarterDateRange(quarter) {
  switch (quarter) {
    case 'Q1': return [1, 90];
    case 'Q2': return [91, 181];
    case 'Q3': return [182, 273];
    case 'Q4': return [274, 365];
    default: return [1, 365];
  }
}

// Max points kept for mini-chart sparklines.
export const MAX_CHART_POINTS = 180;

export function downsampleSeries(points, maxPoints = MAX_CHART_POINTS) {
  if (!Array.isArray(points) || points.length <= maxPoints) {
    return points;
  }
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled = [];
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round(i * step);
    sampled.push(points[index]);
  }
  return sampled;
}

// Percent change of `price` over the timeframe: vs previous close for 1D,
// vs the first point for ranges, vs all-time high for ATH.
export function computeTimeframeChange(timeframe, currentPrice, previousClosePrice, validSeries) {
  if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
    return null;
  }

  if (timeframe === '1D') {
    if (typeof previousClosePrice !== 'number' || previousClosePrice === 0) {
      return null;
    }
    return ((currentPrice - previousClosePrice) / previousClosePrice) * 100;
  }

  if (!Array.isArray(validSeries) || validSeries.length < 2) {
    return null;
  }

  if (timeframe === 'ATH') {
    const highest = Math.max(...validSeries.map((point) => point.price).filter((value) => Number.isFinite(value)));
    if (!Number.isFinite(highest) || highest <= 0) {
      return null;
    }
    return ((currentPrice - highest) / highest) * 100;
  }

  const basePrice = validSeries[0]?.price;
  if (typeof basePrice !== 'number' || basePrice <= 0) {
    return null;
  }
  return ((currentPrice - basePrice) / basePrice) * 100;
}
