import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildChartUrl,
  buildMarketDetectorUrl,
  buildMoneyFlowReport,
  buildScreenerTemplateUrl,
  buildStockbitHeaders,
  buildTopPicks,
  getISODate,
  getStockbitDateRange,
  parseScreenerTemplatePayload,
  toNumber,
} from "@/lib/money-flow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_SCREENER_TEMPLATE_ID = "5986773";

function buildErrorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getWeekStartISO(date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - day);
  return weekStart.toISOString().split("T")[0];
}

const TIMEFRAMES = [
  { key: "weekly", days: 7 },
  { key: "monthly", days: 30 },
  { key: "quarterly", days: 90 }
];

async function fetchStockbitChart(symbol, headers) {
  const chartRes = await fetch(buildChartUrl(symbol), { headers });
  if (!chartRes.ok) throw new Error(`Chart fetch failed for ${symbol}`);
  return chartRes.json();
}

async function fetchStockbitMarketDetector(symbol, headers, days) {
  const { from, to } = getStockbitDateRange(days);
  const [netRes, grossRes] = await Promise.all([
    fetch(buildMarketDetectorUrl(symbol, from, to, "TRANSACTION_TYPE_NET"), { headers }),
    fetch(buildMarketDetectorUrl(symbol, from, to, "TRANSACTION_TYPE_GROSS"), { headers }),
  ]);
  if (!netRes.ok || !grossRes.ok) {
    throw new Error(`Stockbit MD failed (${symbol}): net=${netRes.status}, gross=${grossRes.status}`);
  }
  const [netData, grossData] = await Promise.all([netRes.json(), grossRes.json()]);
  return { netData, grossData };
}

async function runInBatches(items, worker, concurrency = 4) {
  const queue = [...items];

  const runWorker = async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) continue;
      await worker(next);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
}

async function fetchScreenerUniverse(headers, templateId) {
  const snapshots = {};
  const symbolsSet = new Set();

  let page = 1;
  let totalPages = 1;
  let metadata = {
    screener_id: toNumber(templateId, 0),
    screen_name: "",
    total_rows: 0,
    current_page: 1,
    per_page: 0,
  };

  while (page <= totalPages && page <= 20) {
    const response = await fetch(buildScreenerTemplateUrl(templateId, page), { headers });
    if (!response.ok) {
      throw new Error(`Screener API failed on page ${page} with status ${response.status}`);
    }

    const payload = await response.json();
    const parsed = parseScreenerTemplatePayload(payload);

    metadata = {
      ...metadata,
      ...parsed.metadata,
    };

    const sizeBefore = symbolsSet.size;
    for (const symbol of parsed.symbols) {
      symbolsSet.add(symbol);
      snapshots[symbol] = parsed.snapshots[symbol];
    }

    const totalRows = toNumber(parsed.metadata.total_rows, parsed.symbols.length);
    const perPage = toNumber(parsed.metadata.per_page, parsed.symbols.length || 1);
    totalPages = Math.max(1, Math.ceil(totalRows / Math.max(perPage, 1)));

    if (page > 1 && symbolsSet.size === sizeBefore) {
      break;
    }

    if (page >= totalPages) {
      break;
    }

    page += 1;
  }

  return {
    symbols: Array.from(symbolsSet),
    snapshots,
    metadata,
  };
}

export async function GET(request) {
  const authorization = request.headers.get("Authorization");
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return buildErrorResponse("Unauthorized", 401);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return buildErrorResponse("Supabase configuration missing", 500);
  }

  const stockbitBearer = process.env.STOCKBIT_AUTHORIZATION_BEARER;
  if (!stockbitBearer) {
    return buildErrorResponse("Stockbit authorization token missing", 500);
  }

  const screenerTemplateId = process.env.STOCKBIT_SCREENER_TEMPLATE_ID || DEFAULT_SCREENER_TEMPLATE_ID;
  const headers = buildStockbitHeaders(stockbitBearer);

  let screenerUniverse;
  try {
    screenerUniverse = await fetchScreenerUniverse(headers, screenerTemplateId);
  } catch (error) {
    console.error("Failed to fetch screener template", error);
    return buildErrorResponse("Failed to sync stock universe from screener", 502);
  }

  if (!screenerUniverse.symbols.length) {
    return buildErrorResponse("Screener template returned empty symbol list", 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const reportDate = getISODate(new Date());

  const failures = [];
  const reports = [];

  await runInBatches(
    screenerUniverse.symbols,
    async (symbol) => {
      try {
        const chartData = await fetchStockbitChart(symbol, headers);

        for (const tf of TIMEFRAMES) {
          const { netData, grossData } = await fetchStockbitMarketDetector(symbol, headers, tf.days);
          const report = buildMoneyFlowReport({
            symbol,
            netData,
            grossData,
            chartData,
            reportDate,
            screenerSnapshot: screenerUniverse.snapshots[symbol] || null,
            screenerId: screenerUniverse.metadata.screener_id,
            screenerName: screenerUniverse.metadata.screen_name,
          });
          reports.push({ ...report, timeframe: tf.key });
        }
      } catch (error) {
        console.error(`Money-flow cron failed for ${symbol}`, error);
        failures.push({ symbol, error: error?.message || "Unknown error" });
      }
    },
    4
  );

  if (!reports.length) {
    return buildErrorResponse("Failed to generate money-flow reports", 502);
  }

  const rows = reports.map((report) => ({
    symbol: report.symbol,
    report_date: report.report_date,
    money_flow_score: report.money_flow_score,
    broker_accdist: report.broker_accdist,
    top1_percent: report.top1_percent,
    top3_percent: report.top3_percent,
    top5_percent: report.top5_percent,
    total_buyer: report.total_buyer,
    total_seller: report.total_seller,
    value: report.value,
    volume: report.volume,
    today_volume: report.today_volume,
    avg_volume_20: report.avg_volume_20,
    volume_spike: report.volume_spike,
    current_price: report.current_price,
    price_1m_ago: report.price_1m_ago,
    price_change_1m: report.price_change_1m,
    price_change_5d: report.price_change_5d,
    price_change_10d: report.price_change_10d,
    price_change_20d: report.price_change_20d,
    price_change_3m: report.price_change_3m,
    price_range_10d: report.price_range_10d,
    signal: report.signal,
    score_breakdown: report.score_breakdown,
    broker_summary: report.broker_summary,
    broker_inventory: report.broker_inventory,
    broker_cost_analysis: report.broker_cost_analysis,
    broker_concentration: report.broker_concentration,
    absorption_strength: report.absorption_strength,
    accumulation_persistence: report.accumulation_persistence,
    market_phase: report.market_phase,
    manipulation_risk: report.manipulation_risk,
    analysis_summary: report.analysis_summary,
    timeframe: report.timeframe,
    screener_id: report.screener_id,
    screener_name: report.screener_name,
    screener_snapshot: report.screener_snapshot,
  }));

  const { error: upsertError } = await supabase
    .from("money_flow_reports")
    .upsert(rows, { onConflict: "symbol,report_date,timeframe" });

  if (upsertError) {
    console.error("Failed to upsert money_flow_reports", upsertError);
    return buildErrorResponse("Failed to persist money-flow reports", 500);
  }

  const weeklyReports = reports.filter(r => r.timeframe === "weekly");
  const topPicks = buildTopPicks(weeklyReports, 20);
  const weekStart = getWeekStartISO(new Date());

  const { error: weeklyError } = await supabase.from("weekly_reports").upsert(
    {
      week_start: weekStart,
      top_picks: topPicks,
      source_count: weeklyReports.length,
      min_score: toNumber(topPicks[topPicks.length - 1]?.score, 0),
      screener_id: toNumber(screenerUniverse.metadata.screener_id, 0),
      screener_name: screenerUniverse.metadata.screen_name || "",
      screener_total_rows: toNumber(screenerUniverse.metadata.total_rows, screenerUniverse.symbols.length),
      metadata: screenerUniverse.metadata,
    },
    { onConflict: "week_start" }
  );

  if (weeklyError) {
    console.error("Failed to upsert weekly_reports", weeklyError);
    return buildErrorResponse("Reports stored but weekly picks failed", 500);
  }

  return NextResponse.json({
    success: true,
    report_date: reportDate,
    week_start: weekStart,
    screener_template_id: screenerTemplateId,
    screener_name: screenerUniverse.metadata.screen_name,
    screener_total_rows: screenerUniverse.metadata.total_rows,
    processed_symbols: screenerUniverse.symbols.length,
    success_count: rows.length,
    failed_count: failures.length,
    failures: failures.slice(0, 20),
    top_picks: topPicks,
  });
}
