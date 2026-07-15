"use server";

import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo-finance";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { encodePayload } from "@/lib/secure-payload";
import {
  IDX_SYMBOLS,
  US_SP500_SYMBOLS,
  CRYPTO_TOP100_SYMBOLS,
} from "@/lib/stock-universe";

const SCREENER_CONFIG = {
  idx: {
    label: "IDX",
    fallback: IDX_SYMBOLS,
  },
  us: {
    label: "US",
    fallback: US_SP500_SYMBOLS,
  },
  crypto: {
    label: "CRYPTO",
    fallback: CRYPTO_TOP100_SYMBOLS,
  },
};
const MIN_DAILY_VALUE_CONFIG = {
  idx: 10_000_000_000,   // 10B IDR
  us: 500_000_000,       // 500M USD
  crypto: 1_000_000_000, // 1B USD
};

const TRADING_PLAN_ACCOUNT_SIZE = {
  idx: 150_000_000,  // ≈IDR 150M
  us: 50_000,        // USD
  crypto: 25_000,    // USD
};

const DEFAULT_RISK_PERCENT = 1;
const STOP_EMA_BUFFER = 0.98;
const DEFAULT_STOP_BUFFER = 0.97;
const SWING_LOOKBACK = 5;
const RESISTANCE_LOOKBACK = 90;
const RESISTANCE_MIN_GAP = 0.01; // resistance must clear entry by at least 1%
const ATR_PERIOD = 14;

const EMA_PERIOD = 31;
const VOLUME_MA_PERIOD = 31;
const EMA_SLOPE_PERIOD = 5;
const CANDLE_LOOKBACK = 5;
const BATCH_TIME_LIMIT_MS = 50000;

const STOCK_UNIVERSE_COLUMNS = {
  idx: "idx_stocks",
  us: "us_stocks",
  crypto: "crypto_stocks",
};

function computeEMA(values, period) {
  const result = new Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let ema = null;

  for (let i = 0; i < values.length; i++) {
    const price = values[i];
    if (price == null) continue;

    if (ema === null) {
      const window = values.slice(0, i + 1).slice(-period);
      if (window.length < period || window.some((v) => v == null)) {
        continue;
      }
      ema = window.reduce((sum, v) => sum + v, 0) / period;
    } else {
      ema = price * multiplier + ema * (1 - multiplier);
    }
    result[i] = ema;
  }

  return result;
}

function computeSMA(values, period) {
  const result = new Array(values.length).fill(null);
  const window = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i] ?? null;
    window.push(value);
    sum += value ?? 0;

    if (window.length > period) {
      const removed = window.shift();
      sum -= removed ?? 0;
    }

    if (window.length === period && window.every((v) => v != null)) {
      result[i] = sum / period;
    }
  }

  return result;
}

function formatPlanPrice(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(4));
}

function resolveAccountSize(category) {
  return TRADING_PLAN_ACCOUNT_SIZE[category] ?? 50_000;
}

/**
 * Builds rationale-driven take-profit targets instead of arbitrary percentage steps.
 * TP1 = prior resistance (or 1.5R fallback), TP2 = measured move off the base (or 2.5R fallback),
 * TP3 = fibonacci extension of the base range (or ATR-based fallback). Each target is floored
 * to a minimum 0.5R separation from the previous one so the ladder always progresses.
 */
function computeTakeProfitLadder({ entryPrice, stopLoss, swingLow, swingHigh, atr }) {
  const riskDistance = entryPrice - stopLoss;
  const safeAtr = Number.isFinite(atr) && atr > 0 ? atr : (riskDistance > 0 ? riskDistance / 1.5 : entryPrice * 0.02);

  let tp1Price;
  let tp1Reason;
  if (Number.isFinite(swingHigh) && swingHigh > entryPrice * (1 + RESISTANCE_MIN_GAP)) {
    tp1Price = swingHigh;
    tp1Reason = 'Previous Resistance';
  } else {
    tp1Price = entryPrice + riskDistance * 1.5;
    tp1Reason = '1.5R Target';
  }

  const baseHeight = Number.isFinite(swingLow) && swingLow < entryPrice
    ? entryPrice - swingLow
    : riskDistance * 2;
  let tp2Price = entryPrice + baseHeight;
  let tp2Reason = 'Measured Move';
  const tp2Floor = tp1Price + riskDistance * 0.5;
  if (!(tp2Price > tp2Floor)) {
    tp2Price = tp2Floor;
    tp2Reason = '2.5R Target';
  }

  let tp3Price;
  let tp3Reason;
  if (Number.isFinite(swingHigh) && Number.isFinite(swingLow) && swingHigh > swingLow) {
    const range = swingHigh - swingLow;
    tp3Price = swingHigh + range * 0.618;
    tp3Reason = 'Fibonacci Extension (1.618)';
  } else {
    tp3Price = entryPrice + safeAtr * 4;
    tp3Reason = 'ATR Extension Target';
  }
  const tp3Floor = tp2Price + riskDistance * 0.5;
  if (!(tp3Price > tp3Floor)) {
    tp3Price = tp3Floor;
    tp3Reason = '4R Target';
  }

  return [
    {
      label: 'TP1',
      price: formatPlanPrice(tp1Price),
      reason: tp1Reason,
      sell_percent: 30,
      action: 'Move Stop Loss to Breakeven',
    },
    {
      label: 'TP2',
      price: formatPlanPrice(tp2Price),
      reason: tp2Reason,
      sell_percent: 40,
      action: 'Trail Stop to EMA20',
    },
    {
      label: 'TP3',
      price: formatPlanPrice(tp3Price),
      reason: tp3Reason,
      sell_percent: 30,
      action: 'Exit Remaining Position',
    },
  ];
}

function resolveQualityTier(primaryRiskReward) {
  if (!Number.isFinite(primaryRiskReward)) return 'fair';
  if (primaryRiskReward >= 3) return 'excellent';
  if (primaryRiskReward >= 2) return 'good';
  if (primaryRiskReward >= 1.2) return 'fair';
  return 'poor';
}

function buildTradingPlan({ price, emaValue, swingLow, swingHigh, atr, volumeRatio, emaSlopePct, category }) {
  const entryPrice = formatPlanPrice(price) ?? price ?? null;
  if (entryPrice == null) {
    return null;
  }

  const stopCandidates = [];
  if (Number.isFinite(swingLow)) {
    stopCandidates.push({ value: swingLow, reason: 'Below Swing Low' });
  }
  if (Number.isFinite(emaValue)) {
    stopCandidates.push({ value: emaValue * STOP_EMA_BUFFER, reason: 'Below EMA20' });
  }
  const numericStops = stopCandidates.filter((candidate) => Number.isFinite(candidate.value));
  let chosenStop = numericStops.length
    ? numericStops.reduce((min, candidate) => (candidate.value < min.value ? candidate : min))
    : null;
  let stopLoss = chosenStop?.value ?? null;
  let stopLossReason = chosenStop?.reason ?? 'Technical Stop';
  if (!Number.isFinite(stopLoss) || stopLoss <= 0 || stopLoss >= entryPrice) {
    stopLoss = entryPrice * DEFAULT_STOP_BUFFER;
    stopLossReason = 'Technical Stop (3% Buffer)';
  }
  stopLoss = formatPlanPrice(stopLoss);

  const accountSize = resolveAccountSize(category);
  const riskPercent = DEFAULT_RISK_PERCENT;
  const riskAmount = (accountSize * riskPercent) / 100;
  const stopDistance = entryPrice - stopLoss;
  const positionSize = stopDistance > 0 ? Math.max(Math.floor(riskAmount / stopDistance), 0) : 0;
  const capitalAtRisk = stopDistance > 0 ? Number((positionSize * stopDistance).toFixed(2)) : 0;

  const tpTargets = computeTakeProfitLadder({ entryPrice, stopLoss, swingLow, swingHigh, atr });

  const riskReward = stopDistance > 0
    ? tpTargets.reduce((acc, target, index) => {
      const key = `tp${index + 1}`;
      acc[key] = target.price != null ? Number(((target.price - entryPrice) / stopDistance).toFixed(2)) : null;
      return acc;
    }, {})
    : { tp1: null, tp2: null, tp3: null };
  riskReward.primary = riskReward.tp2 ?? null;

  // Entry zone: pullback toward EMA20 up to the confirmed breakout price.
  const zoneLow = Number.isFinite(emaValue) && emaValue < entryPrice
    ? formatPlanPrice(emaValue)
    : formatPlanPrice(entryPrice * 0.995);
  const entryType = zoneLow != null && zoneLow < entryPrice ? 'Limit' : 'Market';

  return {
    entry_price: entryPrice,
    entry_zone_low: zoneLow,
    entry_zone_high: entryPrice,
    entry_type: entryType,
    entry_reason: 'EMA20 breakout confirmed by above-average volume',
    stop_loss: stopLoss,
    stop_loss_reason: stopLossReason,
    account_size: accountSize,
    risk_percent: riskPercent,
    risk_amount: Number(riskAmount.toFixed(2)),
    position_size: positionSize,
    capital_at_risk: capitalAtRisk,
    tp_targets: tpTargets,
    risk_reward: riskReward,
    quality_tier: resolveQualityTier(riskReward.primary),
    volume_ratio: Number.isFinite(volumeRatio) ? Number(volumeRatio.toFixed(2)) : null,
    ema_slope_pct: Number.isFinite(emaSlopePct) ? Number(emaSlopePct.toFixed(2)) : null,
    basis: {
      swing_low: swingLow ?? null,
      swing_high: swingHigh ?? null,
      ema20: formatPlanPrice(emaValue) ?? null,
      atr: Number.isFinite(atr) ? formatPlanPrice(atr) : null,
    },
  };
}

function findRecentSwingLow(points, index) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  const start = Math.max(0, index - SWING_LOOKBACK);
  const window = points.slice(start, index + 1);
  const lows = window
    .map((point) => (Number.isFinite(point.low) ? point.low : Number.isFinite(point.close) ? point.close : null))
    .filter((value) => value != null);
  if (!lows.length) {
    return null;
  }
  return Math.min(...lows);
}

/** Nearest meaningful resistance: the highest high in the lookback window before the breakout bar. */
function findPriorResistance(points, index) {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  const start = Math.max(0, index - RESISTANCE_LOOKBACK);
  const end = Math.max(start, index - SWING_LOOKBACK);
  const window = points.slice(start, end);
  const highs = window
    .map((point) => (Number.isFinite(point.high) ? point.high : Number.isFinite(point.close) ? point.close : null))
    .filter((value) => value != null);
  if (!highs.length) {
    return null;
  }
  return Math.max(...highs);
}

/** Wilder-style true range series, smoothed with a simple moving average. */
function computeATRSeries(points, period = ATR_PERIOD) {
  const trueRanges = points.map((point, i) => {
    if (i === 0) return null;
    const prevClose = points[i - 1].close;
    const high = Number.isFinite(point.high) ? point.high : point.close;
    const low = Number.isFinite(point.low) ? point.low : point.close;
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(prevClose)) {
      return null;
    }
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  });
  return computeSMA(trueRanges, period);
}

function toNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[, ]/g, "");
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (value && typeof value === "object") {
    if (typeof value.raw === "number") return value.raw;
    if (typeof value.fmt === "string") return toNumeric(value.fmt);
  }
  return null;
}

function normalizeResultEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return {
      symbol: entry,
      signal_date: null,
      is_warning: false,
    };
  }

  if (typeof entry !== "object") return null;
  const symbol = typeof entry.symbol === "string" ? entry.symbol : null;
  if (!symbol) return null;

  const signalDateValue = entry.signal_date;
  const signalDate =
    typeof signalDateValue === "string"
      ? signalDateValue
      : signalDateValue instanceof Date
        ? signalDateValue.toISOString()
        : null;

  return {
    symbol,
    signal_date: signalDate,
    is_warning: Boolean(entry.is_warning),
    trading_plan:
      entry.trading_plan && typeof entry.trading_plan === "object"
        ? entry.trading_plan
        : null,
  };
}

function buildResultMap(results) {
  const map = new Map();
  if (!Array.isArray(results)) {
    return map;
  }
  results.forEach((entry) => {
    const normalized = normalizeResultEntry(entry);
    if (normalized?.symbol && !map.has(normalized.symbol)) {
      map.set(normalized.symbol, normalized);
    }
  });
  return map;
}

function shouldFlagWarning(price, volume, marketCap) {
  if (
    typeof price !== "number" ||
    typeof volume !== "number" ||
    typeof marketCap !== "number"
  ) {
    return false;
  }
  if (price <= 0 || volume <= 0 || marketCap <= 0) {
    return false;
  }
  const tradeValue = price * volume;
  if (!Number.isFinite(tradeValue) || tradeValue <= 0) {
    return false;
  }
  const ratio = tradeValue / marketCap;
  return Number.isFinite(ratio) && ratio >= 0.1;
}

async function fetchUniverseSymbols(supabase, category) {
  const column = STOCK_UNIVERSE_COLUMNS[category];
  if (!column) {
    return [];
  }

  const { data, error } = await supabase
    .from("stock_universes")
    .select(`${column}`)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load stock universe from Supabase:", error.message);
    return SCREENER_CONFIG[category].fallback;
  }

  const symbols = data?.[column];
  if (Array.isArray(symbols) && symbols.length > 0) {
    return symbols;
  }
  return SCREENER_CONFIG[category].fallback;
}

async function fetchDailySeries(symbol) {
  const now = new Date();
  const period1 = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365 * 5);
  try {
    const chart = await yahooFinance.chart(symbol, {
      interval: "1d",
      period1,
      period2: now,
    });
    return {
      quotes: chart?.quotes ?? [],
      meta: chart?.meta ?? {},
    };
  } catch (error) {
    console.warn(`Failed to fetch chart for ${symbol}:`, error.message);
    return { quotes: null, meta: {} };
  }
}

function evaluateSymbol(quotes, category, meta) {
  if (!Array.isArray(quotes) || quotes.length < 50) {
    return { isBreakout: false, isWarning: false, plan: null };
  }

  const cleaned = quotes
    .map((row) => {
      const closeRaw = row?.adjclose ?? row?.close ?? null;
      const volumeRaw = row?.volume ?? null;
      const lowRaw = row?.low ?? row?.adjclose ?? row?.close ?? null;
      const highRaw = row?.high ?? row?.adjclose ?? row?.close ?? null;
      const close = typeof closeRaw === "number" ? closeRaw : closeRaw != null ? Number(closeRaw) : null;
      const volume =
        typeof volumeRaw === "number" ? volumeRaw : volumeRaw != null ? Number(volumeRaw) : null;
      const low = typeof lowRaw === "number" ? lowRaw : lowRaw != null ? Number(lowRaw) : null;
      const high = typeof highRaw === "number" ? highRaw : highRaw != null ? Number(highRaw) : null;
      if (close == null || volume == null) return null;
      const dateValue = row.date ? new Date(row.date) : null;
      return dateValue && !Number.isNaN(dateValue.valueOf())
        ? {
            date: dateValue,
            close,
            volume,
            low: low ?? close,
            high: high ?? close,
          }
        : null;
    })
    .filter(Boolean);

  if (cleaned.length < 50) {
    return { isBreakout: false, isWarning: false };
  }

  const closes = cleaned.map((row) => row.close);
  const volumes = cleaned.map((row) => row.volume);
  const ema20 = computeEMA(closes, EMA_PERIOD);
  const volumeMA20 = computeSMA(volumes, VOLUME_MA_PERIOD);
  const atrSeries = computeATRSeries(cleaned, ATR_PERIOD);

  const startIndex = Math.max(1, cleaned.length - CANDLE_LOOKBACK);
  let hasValidBreakout = false;
  const marketCap = toNumeric(meta?.marketCap);
  let warningFlagged = false;
  let planPayload = null;

  for (let i = startIndex; i < cleaned.length; i++) {
    const price = cleaned[i].close;
    const prevPrice = cleaned[i - 1].close;
    const emaValue = ema20[i];
    const prevEma = ema20[i - 1];
    const volume = cleaned[i].volume;
    const volumeAvg = volumeMA20[i];
    if (
      emaValue == null ||
      prevEma == null ||
      volume == null ||
      volumeAvg == null ||
      price == null ||
      prevPrice == null
    ) {
      continue;
    }

    const touchBreak = price >= emaValue && prevPrice < prevEma;
    const slopeSourceIndex = i - EMA_SLOPE_PERIOD;
    let emaSlope = null;
    if (slopeSourceIndex >= 0 && ema20[slopeSourceIndex] != null) {
      emaSlope = (emaValue - ema20[slopeSourceIndex]) / EMA_SLOPE_PERIOD;
    }

    const dailyValue = price * volume;

    const minDailyValue = MIN_DAILY_VALUE_CONFIG[category] ?? 10_000_000_000;

    if (
      touchBreak &&
      emaSlope != null &&
      emaSlope > 0 &&
      volume > volumeAvg &&
      dailyValue >= minDailyValue
    ) {
      hasValidBreakout = true;
      if (!warningFlagged && shouldFlagWarning(price, volume, marketCap)) {
        warningFlagged = true;
      }
      if (!planPayload) {
        const swingLow = findRecentSwingLow(cleaned, i);
        const swingHigh = findPriorResistance(cleaned, i);
        const atr = atrSeries[i];
        const volumeRatio = volumeAvg > 0 ? volume / volumeAvg : null;
        const emaSlopePct = emaValue ? (emaSlope / emaValue) * 100 : null;
        planPayload = buildTradingPlan({
          price,
          emaValue,
          swingLow,
          swingHigh,
          atr,
          volumeRatio,
          emaSlopePct,
          category,
        });
      }
    }
  }

  return { isBreakout: hasValidBreakout, isWarning: warningFlagged, plan: planPayload };
}

export async function GET(request, context) {
  const params = await context.params;
  const category = params?.category?.toLowerCase();
  if (!SCREENER_CONFIG[category]) {
    return NextResponse.json(
      { payload: encodePayload({ error: "Unknown screener category" }) },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { payload: encodePayload({ error: "Supabase service role key is not configured" }) },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const overrideCursorParam = searchParams.get("cursor");
  const shouldReset = searchParams.get("reset") === "true";
  const overrideCursor =
    overrideCursorParam != null ? Number.parseInt(overrideCursorParam, 10) : null;

  const universe = await fetchUniverseSymbols(supabase, category);
  const totalCount = universe.length;
  if (!totalCount) {
    return NextResponse.json(
      { payload: encodePayload({ error: "Symbol universe is empty", category }) },
      { status: 500 }
    );
  }

  const { data: snapshot } = await supabase
    .from("screening_snapshots")
    .select("*")
    .eq("category", category)
    .maybeSingle();

  let cursor = 0;
  let existingResultsMap = new Map();

  if (snapshot && !shouldReset) {
    existingResultsMap = buildResultMap(snapshot.results);
    if (overrideCursor != null && !Number.isNaN(overrideCursor)) {
      cursor = Math.max(0, Math.min(totalCount - 1, overrideCursor));
    } else {
      cursor = snapshot.next_cursor ?? 0;
    }
    if (cursor >= totalCount) {
      cursor = 0;
    }
  }

  if (shouldReset) {
    cursor = 0;
    existingResultsMap = new Map();
  }

  const startedAt = Date.now();
  let index = cursor;
  let processedCount = 0;
  const batchResults = [];
  const batchEntries = [];
  const tradingValueMap = new Map(); // Track trading value (volume * price) for trending stocks

  while (index < totalCount) {
    if (Date.now() - startedAt >= BATCH_TIME_LIMIT_MS && processedCount > 0) {
      break;
    }

    const symbol = universe[index];
    const { quotes, meta } = await fetchDailySeries(symbol);
    if (quotes) {
      // Calculate trading value for trending stocks (volume * price on latest day)
      if (quotes.length > 0) {
        const latest = quotes[quotes.length - 1];
        const price = latest?.adjclose ?? latest?.close ?? null;
        const volume = latest?.volume ?? null;
        if (price != null && volume != null && price > 0 && volume > 0) {
          const tradingValue = price * volume;
          if (Number.isFinite(tradingValue)) {
            tradingValueMap.set(symbol, tradingValue);
          }
        }
      }
      
      const evaluation = evaluateSymbol(quotes, category, meta);
      if (evaluation.isBreakout) {
        const existingEntry = existingResultsMap.get(symbol);
        if (existingEntry) {
          const nextEntry = {
            ...existingEntry,
            is_warning: Boolean(evaluation.isWarning),
          };
          if (!nextEntry.trading_plan && evaluation.plan) {
            nextEntry.trading_plan = evaluation.plan;
          }
          existingResultsMap.set(symbol, nextEntry);
        } else {
          const entry = {
            symbol,
            signal_date: new Date().toISOString(),
            is_warning: Boolean(evaluation.isWarning),
            trading_plan: evaluation.plan ?? null,
          };
          existingResultsMap.set(symbol, entry);
          batchResults.push(symbol);
          batchEntries.push(entry);
        }
      } else if (existingResultsMap.has(symbol)) {
        existingResultsMap.delete(symbol);
      }
    }
    processedCount += 1;
    index += 1;
  }

  const finished = index >= totalCount;
  const prioritizedSymbols = new Set(batchEntries.map((entry) => entry.symbol));
  const merged = [
    ...batchEntries,
    ...Array.from(existingResultsMap.values()).filter(
      (entry) => !prioritizedSymbols.has(entry.symbol)
    ),
  ];
  const trimmedResults = merged.slice(0, 100);

  const payload = {
    category,
    results: trimmedResults,
    status: finished ? "idle" : "running",
    next_cursor: finished ? 0 : index,
    processed_count: finished ? totalCount : index,
    total_count: totalCount,
    metadata: {
      lastBatchDurationMs: Date.now() - startedAt,
      batchProcessed: processedCount,
    },
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase.from("screening_snapshots").upsert(payload, {
    onConflict: "category",
  });

  if (upsertError) {
    console.error("Failed to persist screening snapshot:", upsertError.message);
    return NextResponse.json(
      { payload: encodePayload({ error: "Failed to persist screening snapshot", category }) },
      { status: 500 }
    );
  }

  // Update trending stocks when finished processing all symbols
  if (finished && tradingValueMap.size > 0) {
    const trendingLimit = category === 'crypto' ? 3 : 5;
    const sortedByValue = Array.from(tradingValueMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, trendingLimit)
      .map(([symbol], order) => ({ symbol, category, order }));

    if (sortedByValue.length > 0) {
      // Delete old trending stocks for this category
      await supabase
        .from("trending_stocks")
        .delete()
        .eq("category", category);

      // Insert new trending stocks
      const { error: trendingError } = await supabase
        .from("trending_stocks")
        .insert(sortedByValue);

      if (trendingError) {
        console.error("Failed to update trending stocks:", trendingError.message);
      }
    }
  }

  return NextResponse.json({
    payload: encodePayload({
      category,
      status: finished ? "done" : "continue",
      processedThisBatch: processedCount,
      nextCursor: finished ? null : index,
      totalSymbols: totalCount,
      appendedSignals: batchResults.length,
      durationMs: Date.now() - startedAt,
    }),
  });
}
