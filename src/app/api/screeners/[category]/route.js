"use server";

import { NextResponse } from "next/server";
import yahooFinance from "@/lib/yahoo-finance";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";
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

const EMA_PERIOD = 32;
const VOLUME_MA_PERIOD = 32;
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
    return { isBreakout: false, isWarning: false };
  }

  const cleaned = quotes
    .map((row) => {
      const closeRaw = row?.adjclose ?? row?.close ?? null;
      const volumeRaw = row?.volume ?? null;
      const close = typeof closeRaw === "number" ? closeRaw : closeRaw != null ? Number(closeRaw) : null;
      const volume =
        typeof volumeRaw === "number" ? volumeRaw : volumeRaw != null ? Number(volumeRaw) : null;
      if (close == null || volume == null) return null;
      const dateValue = row.date ? new Date(row.date) : null;
      return dateValue && !Number.isNaN(dateValue.valueOf())
        ? {
            date: dateValue,
            close,
            volume,
          }
        : null;
    })
    .filter(Boolean);

  if (cleaned.length < 50) {
    return { isBreakout: false, isWarning: false };
  }

  const closes = cleaned.map((row) => row.close);
  const volumes = cleaned.map((row) => row.volume);
  const ema32 = computeEMA(closes, EMA_PERIOD);
  const volumeMA20 = computeSMA(volumes, VOLUME_MA_PERIOD);

  const startIndex = Math.max(1, cleaned.length - CANDLE_LOOKBACK);
  let hasValidBreakout = false;
  const marketCap = toNumeric(meta?.marketCap);
  let warningFlagged = false;

  for (let i = startIndex; i < cleaned.length; i++) {
    const price = cleaned[i].close;
    const prevPrice = cleaned[i - 1].close;
    const emaValue = ema32[i];
    const prevEma = ema32[i - 1];
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
    if (slopeSourceIndex >= 0 && ema32[slopeSourceIndex] != null) {
      emaSlope = (emaValue - ema32[slopeSourceIndex]) / EMA_SLOPE_PERIOD;
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
    }
  }

  return { isBreakout: hasValidBreakout, isWarning: warningFlagged };
}

export async function GET(request, context) {
  const params = await context.params;
  const category = params?.category?.toLowerCase();
  if (!SCREENER_CONFIG[category]) {
    return NextResponse.json(
      { error: "Unknown screener category" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role key is not configured" },
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
      { error: "Symbol universe is empty", category },
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
    if (snapshot.status === "idle" && cursor === 0 && overrideCursor == null) {
      existingResultsMap = new Map();
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

  while (index < totalCount) {
    if (Date.now() - startedAt >= BATCH_TIME_LIMIT_MS && processedCount > 0) {
      break;
    }

    const symbol = universe[index];
    const { quotes, meta } = await fetchDailySeries(symbol);
    if (quotes) {
      const evaluation = evaluateSymbol(quotes, category, meta);
      if (evaluation.isBreakout) {
        const existingEntry = existingResultsMap.get(symbol);
        const signalDate = existingEntry?.signal_date ?? new Date().toISOString();
        const entry = {
          symbol,
          signal_date: signalDate,
          is_warning: Boolean(evaluation.isWarning),
        };
        existingResultsMap.set(symbol, entry);
        batchResults.push(symbol);
        batchEntries.push(entry);
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
      { error: "Failed to persist screening snapshot", category },
      { status: 500 }
    );
  }

  return NextResponse.json({
    category,
    status: finished ? "done" : "continue",
    processedThisBatch: processedCount,
    nextCursor: finished ? null : index,
    totalSymbols: totalCount,
    appendedSignals: batchResults.length,
    durationMs: Date.now() - startedAt,
  });
}
