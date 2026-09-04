import { NextResponse } from "next/server";
import { encodePayload } from "@/lib/secure-payload";
import { getSupabaseServiceRoleClient } from "@/lib/supabase-server";
import {
  MONEY_FLOW_TIMEFRAMES,
  buildTopPicks,
  dedupeLatestBySymbol,
  getISODate,
  getTimeframeStartDate,
  sortMoneyFlowReports,
  toNumber,
} from "@/lib/money-flow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MONEY_FLOW_ENABLED = process.env.MONEY_FLOW_ENABLED !== "false";

function getSummaryStats(reports) {
  if (!reports.length) {
    return {
      total_stocks: 0,
      average_score: 0,
      average_absorption: 0,
      strong_accumulation: 0,
      accumulation: 0,
      neutral: 0,
      distribution: 0,
      high_risk_count: 0,
    };
  }

  const summary = {
    total_stocks: reports.length,
    average_score: 0,
    average_absorption: 0,
    strong_accumulation: 0,
    accumulation: 0,
    neutral: 0,
    distribution: 0,
    high_risk_count: 0,
  };

  let totalScore = 0;
  let totalAbsorption = 0;

  for (const report of reports) {
    const score = toNumber(report.money_flow_score, 0);
    totalScore += score;
    totalAbsorption += toNumber(report?.absorption_strength?.value, 0);

    const riskLevel = String(report?.manipulation_risk?.level || "LOW").toUpperCase();
    if (riskLevel === "MEDIUM" || riskLevel === "HIGH" || riskLevel === "CRITICAL") {
      summary.high_risk_count += 1;
    }

    if (score >= 80) {
      summary.strong_accumulation += 1;
    } else if (score >= 60) {
      summary.accumulation += 1;
    } else if (score >= 40) {
      summary.neutral += 1;
    } else {
      summary.distribution += 1;
    }
  }

  summary.average_score = Number((totalScore / reports.length).toFixed(2));
  summary.average_absorption = Number((totalAbsorption / reports.length).toFixed(2));

  return summary;
}

export async function GET(request) {
  if (!MONEY_FLOW_ENABLED) {
    return NextResponse.json(
      { payload: encodePayload({ error: "Money flow is currently disabled" }) },
      { status: 404 }
    );
  }

  try {
    const supabase = getSupabaseServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { payload: encodePayload({ error: "Supabase configuration missing" }) },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const timeframe = (searchParams.get("timeframe") || "weekly").toLowerCase();
    const sortBy = (searchParams.get("sort") || "score").toLowerCase();
    const order = (searchParams.get("order") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
    const minScoreParam = Number.parseFloat(searchParams.get("min_score") || "0");

    const timeframeKey = MONEY_FLOW_TIMEFRAMES[timeframe] ? timeframe : "weekly";
    const timeframeConfig = MONEY_FLOW_TIMEFRAMES[timeframeKey];
    const startDate = getISODate(getTimeframeStartDate(timeframeKey));
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 50;
    const minScore = Number.isFinite(minScoreParam) ? minScoreParam : 0;

    // Run both queries in parallel — they are independent.
    const [reportsResult, weeklyResult] = await Promise.all([
      supabase
        .from("money_flow_reports")
        .select(
          "id,symbol,report_date,money_flow_score,broker_accdist,top1_percent,top3_percent,top5_percent,total_buyer,total_seller,value,volume,today_volume,avg_volume_20,volume_spike,current_price,price_1m_ago,price_change_1m,price_change_5d,price_change_10d,price_change_20d,price_change_3m,price_range_10d,signal,score_breakdown,broker_summary,broker_inventory,broker_cost_analysis,broker_concentration,absorption_strength,accumulation_persistence,market_phase,manipulation_risk,analysis_summary,screener_id,screener_name,screener_snapshot,created_at"
        )
        .gte("report_date", startDate)
        .eq("timeframe", timeframeKey)
        .order("report_date", { ascending: false })
        .limit(5000),
      supabase
        .from("weekly_reports")
        .select("week_start,top_picks,created_at,source_count,min_score,screener_id,screener_name,screener_total_rows,metadata")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const { data, error } = reportsResult;
    const { data: latestWeeklyReport, error: weeklyError } = weeklyResult;

    if (error) {
      console.error("Money-flow query failed", error);
      return NextResponse.json(
        { payload: encodePayload({ error: "Failed to fetch money flow reports" }) },
        { status: 500 }
      );
    }

    let reports = dedupeLatestBySymbol(data || []);

    if (minScore > 0) {
      reports = reports.filter((report) => toNumber(report.money_flow_score, 0) >= minScore);
    }

    const sortedReports = sortMoneyFlowReports(reports, sortBy, order);
    const limitedReports = sortedReports.slice(0, limit);

    if (weeklyError) {
      console.error("Failed to fetch weekly report", weeklyError);
    }

    const topPicks = buildTopPicks(sortedReports, 20);

    return NextResponse.json({
      payload: encodePayload({
        timeframe: timeframeKey,
        timeframe_label: timeframeConfig.label,
        start_date: startDate,
        sort: sortBy,
        order,
        count: reports.length,
        summary: getSummaryStats(reports),
        reports: limitedReports,
        top_picks: topPicks,
        latest_weekly_report: latestWeeklyReport || null,
        screener: latestWeeklyReport
          ? {
            id: latestWeeklyReport.screener_id,
            name: latestWeeklyReport.screener_name,
            total_rows: latestWeeklyReport.screener_total_rows,
          }
          : null,
        updated_at: latestWeeklyReport.created_at,
      }),
    });
  } catch (error) {
    console.error("Money-flow API error", error);
    return NextResponse.json(
      {
        payload: encodePayload({
          error: "Internal server error",
          details: error?.message || "Unknown error",
        }),
      },
      { status: 500 }
    );
  }
}
