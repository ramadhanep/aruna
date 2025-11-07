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

const EMA_PERIOD = 32;
const VOLUME_MA_PERIOD = 32;
const EMA_SLOPE_PERIOD = 5;
const CANDLE_LOOKBACK = 5;
const MIN_DAILY_VALUE = 10_000_000_000;
const BATCH_TIME_LIMIT_MS = 50000;
const SPARKLINE_POINTS = 30;

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

function mergeResults(existing = [], incoming = []) {
  const map = new Map(existing.map((item) => [item.symbol, item]));
  for (const item of incoming) {
    map.set(item.symbol, item);
  }
  return Array.from(map.values());
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

function evaluateSymbol(symbol, meta, quotes) {
  if (!Array.isArray(quotes) || quotes.length < 50) {
    return null;
  }

  const cleaned = quotes
    .map((row) => {
      const closeRaw = row?.adjclose ?? row?.close ?? null;
      const volumeRaw = row?.volume ?? null;
      const close = typeof closeRaw === "number" ? closeRaw : closeRaw != null ? Number(closeRaw) : null;
      const volume =
        typeof volumeRaw === "number" ? volumeRaw : volumeRaw != null ? Number(volumeRaw) : null;
      if (close == null || volume == null) return null;
      return {
        date: row.date,
        close,
        volume,
      };
    })
    .filter(Boolean);

  if (cleaned.length < 50) {
    return null;
  }

  const closes = cleaned.map((row) => row.close);
  const volumes = cleaned.map((row) => row.volume);
  const ema32 = computeEMA(closes, EMA_PERIOD);
  const volumeMA20 = computeSMA(volumes, VOLUME_MA_PERIOD);

  const candidates = [];
  for (let i = 1; i < cleaned.length; i++) {
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

    const dailyValue = Math.abs(price * volume);

    if (
      touchBreak &&
      (emaSlope ?? 0) > 0 &&
      volume > volumeAvg &&
      dailyValue >= MIN_DAILY_VALUE
    ) {
      candidates.push({
        index: i,
        emaValue,
        emaSlope,
        volume,
        volumeAvg,
        dailyValue,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const recentWindow = candidates.filter(
    (entry) => entry.index >= cleaned.length - CANDLE_LOOKBACK
  );
  const selected = (recentWindow.length ? recentWindow : candidates).at(-1);

  if (!selected) return null;

  const row = cleaned[selected.index];
  const prevRow = cleaned[selected.index - 1] ?? cleaned[selected.index];
  const prevClose = prevRow?.close ?? row.close ?? 0;
  const change = row.close != null && prevClose != null ? row.close - prevClose : 0;
  const changePercent =
    prevClose && prevClose !== 0 ? (change / prevClose) * 100 : 0;
  const sparkline = cleaned.slice(-SPARKLINE_POINTS).map((entry) => entry.close);
  const signalDate = row.date?.toISOString
    ? row.date.toISOString()
    : new Date(row.date).toISOString();

  return {
    symbol,
    name: meta?.longName || meta?.shortName || symbol,
    currency: meta?.currency || null,
    lastClose: row.close,
    previousClose: prevClose,
    change,
    changePercent,
    ema32: selected.emaValue,
    ema32Slope: selected.emaSlope,
    volume: selected.volume,
    volumeMA20: selected.volumeAvg,
    dailyValue: selected.dailyValue,
    signalDate,
    exchange: meta?.exchangeName || meta?.fullExchangeName || meta?.exchange,
    sparkline,
  };
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
  let existingResults = [];

  if (snapshot && !shouldReset) {
    existingResults = Array.isArray(snapshot.results) ? snapshot.results : [];
    if (overrideCursor != null && !Number.isNaN(overrideCursor)) {
      cursor = Math.max(0, Math.min(totalCount - 1, overrideCursor));
    } else {
      cursor = snapshot.next_cursor ?? 0;
    }
    if (cursor >= totalCount) {
      cursor = 0;
    }
    if (snapshot.status === "idle" && cursor === 0 && overrideCursor == null) {
      existingResults = [];
    }
  }

  if (shouldReset) {
    cursor = 0;
    existingResults = [];
  }

  const startedAt = Date.now();
  let index = cursor;
  let processedCount = 0;
  const batchResults = [];

  while (index < totalCount) {
    if (Date.now() - startedAt >= BATCH_TIME_LIMIT_MS && processedCount > 0) {
      break;
    }

    const symbol = universe[index];
    const { quotes, meta } = await fetchDailySeries(symbol);
    if (quotes) {
      const signal = evaluateSymbol(symbol, meta, quotes);
      if (signal) {
        batchResults.push({ ...signal, category: SCREENER_CONFIG[category].label });
      }
    }
    processedCount += 1;
    index += 1;
  }

  const finished = index >= totalCount;
  const merged = mergeResults(existingResults, batchResults).sort(
    (a, b) => (b.dailyValue ?? 0) - (a.dailyValue ?? 0)
  );

  const payload = {
    category,
    results: merged.slice(0, 100),
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
