"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TickerAvatar } from "@/components/ticker-avatar";
import { formatTickerDisplay } from "@/lib/utils";

const signalStyles = {
  "Strong Accumulation": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Accumulation: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  Neutral: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Distribution: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const riskStyles = {
  LOW: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  HIGH: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  CRITICAL: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

function formatCompactNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
}

function formatPercent(value, fractionDigits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0.00%";
  return `${numeric.toFixed(fractionDigits)}%`;
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function SignalBadge({ signal }) {
  const className = signalStyles[signal] || signalStyles.Neutral;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${className}`}>
      {signal}
    </span>
  );
}

function RiskBadge({ level }) {
  const risk = String(level || "LOW").toUpperCase();
  const className = riskStyles[risk] || riskStyles.LOW;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${className}`}>
      {risk}
    </span>
  );
}

export function MoneyFlowCard({ report, isExpandedView = false }) {
  const [isNetView, setIsNetView] = useState(true);

  const score = Number(report.money_flow_score || 0);
  const riskLevel = report?.manipulation_risk?.level || "LOW";
  const screenerSnapshot = report?.screener_snapshot || null;
  const logo = screenerSnapshot?.icon_url || null;

  const timeframe = report?.timeframe || "weekly";
  let changeLabel = "1W Change";
  let changeValue = report?.price_change_5d;
  let changeFormatted = "";

  if (timeframe === "monthly") {
    changeLabel = "1M Change";
    changeValue = report?.price_change_1m;
    const numeric = Number(changeValue || 0) * 100;
    changeFormatted = `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
  } else if (timeframe === "quarterly") {
    changeLabel = "3M Change";
    changeValue = report?.price_change_3m;
    const numeric = Number(changeValue || 0);
    changeFormatted = `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
  } else {
    // Weekly fallback (price_change_5d is already pre-multiplied by 100 in the backend)
    const numeric = Number(changeValue || 0);
    changeFormatted = `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
  }

  const isPositive = Number(changeValue || 0) >= 0;

  // Let's decide on card style based on signal
  let cardGradient = "from-neutral-500/5 dark:from-neutral-500/10";
  if (report.signal?.includes("Accumulation")) cardGradient = "from-emerald-500/5 dark:from-emerald-500/10";
  else if (report.signal?.includes("Distribution")) cardGradient = "from-rose-500/5 dark:from-rose-500/10";
  else if (report.signal === "Neutral") cardGradient = "from-amber-500/5 dark:from-amber-500/10";

  // Broker calculation logic
  const brokers = useMemo(() => {
    const rawBrokers = Array.isArray(report.broker_summary) ? report.broker_summary : [];

    // Sort logic depends on Net/Gross View
    const getSortValue = (b, type) => {
      if (isNetView) {
        return type === "buy" ? Number(b.buy_value || 0) - Number(b.sell_value || 0) : Number(b.sell_value || 0) - Number(b.buy_value || 0);
      } else {
        return type === "buy" ? Number(b.gross_buy || 0) : Number(b.gross_sell || 0);
      }
    }

    const buyers = [...rawBrokers].sort((a, b) => getSortValue(b, 'buy') - getSortValue(a, 'buy'));
    const sellers = [...rawBrokers].sort((a, b) => getSortValue(b, 'sell') - getSortValue(a, 'sell'));

    // Pair them up up to max 10 rows
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const buyer = buyers[i];
      const seller = sellers[i];
      if (!buyer && !seller) break;

      const bVal = isNetView ? Math.max(0, Number(buyer?.buy_value || 0) - Number(buyer?.sell_value || 0)) : Number(buyer?.gross_buy || 0);
      const sVal = isNetView ? Math.max(0, Number(seller?.sell_value || 0) - Number(seller?.buy_value || 0)) : Number(seller?.gross_sell || 0);

      if (bVal === 0 && sVal === 0) continue; // Skip empty rows

      rows.push({
        bCode: buyer?.broker_code || "-",
        bVal: bVal,
        bAvg: buyer?.avg_buy_price || 0,
        sCode: seller?.broker_code || "-",
        sVal: sVal,
        sAvg: seller?.avg_sell_price || 0
      });
    }

    return rows;
  }, [report.broker_summary, isNetView]);


  return (
    <AccordionItem value={`${report.symbol}-${report.report_date}`} className="border-none">
      <Card className={`bg-gradient-to-br ${cardGradient} to-transparent border-white/[0.08] dark:border-white/[0.08] text-foreground dark:text-white overflow-hidden relative rounded-2xl shadow-lg`}>
        <AccordionTrigger className={`px-4 py-3 hover:no-underline [&[data-state=open]>div>svg]:rotate-180 ${!isExpandedView && 'px-3 py-3'}`}>
          <div className="flex-1 min-w-0 space-y-3 text-left">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold truncate">{formatTickerDisplay(report.symbol)}</h3>
                  <SignalBadge signal={report.signal} />
                </div>
                <p className="text-[11px] text-muted-foreground dark:text-white/70 truncate">
                  {screenerSnapshot?.company_name || screenerSnapshot?.name || report.market_phase || "Indeterminate Phase"}
                </p>
              </div>
              {logo && (
                <div className="flex-shrink-0 ml-2">
                  <TickerAvatar symbol={report.symbol} logo={logo} />
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Price</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPrice(report.current_price || 0)}
                  </p>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Flow Score</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {score.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">{changeLabel}</p>
                <p className={`text-sm font-semibold flex items-center gap-1 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                  {changeFormatted}
                </p>
              </div>
            </div>

            {/* Phase & Risk (Only in expanded view) */}
            {isExpandedView && (
              <>
                <div className="flex items-center justify-between p-2 bg-black/5 dark:bg-white/5 rounded-lg">
                  <span className="text-[10px] text-muted-foreground dark:text-white/70">Top 3 Buy</span>
                  <span className="text-xs font-semibold">{formatPercent(report.top3_percent)}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground dark:text-white/70">Vol Spike</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Number(report.volume_spike || 0).toFixed(2)}x</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground dark:text-white/70">Absorption Strength</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPercent(report?.absorption_strength?.value)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 dark:border-white/10">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Manipulation Risk</p>
                    <div className="mt-1">
                      <RiskBadge level={riskLevel} />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Phase</p>
                    <p className="text-xs font-semibold text-foreground dark:text-white">
                      {report.market_phase || "Indeterminate"}
                    </p>
                  </div>
                </div>
              </>
            )}
            {!isExpandedView && (
              <div className="flex items-center justify-between p-1.5 bg-black/5 dark:bg-white/5 rounded-lg mt-1">
                <span className="text-[10px] text-muted-foreground dark:text-white/70">Top 3 Buy</span>
                <span className="text-xs font-semibold">{Number(report.top3_percent || 0).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent className={`px-4 pb-4 ${!isExpandedView && 'px-3 pb-3'}`}>
          <div className="space-y-3 pt-1">
            {/* Expanded view only extras */}
            {isExpandedView && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg px-2 py-1.5">
                  <p className="text-muted-foreground">Broker Cost</p>
                  <p className="font-semibold">{formatCompactNumber(report?.broker_cost_analysis?.estimated_cost)}</p>
                  <p className="text-[10px] text-muted-foreground">{report?.broker_cost_analysis?.interpretation || "-"}</p>
                </div>
                <div className="rounded-lg px-2 py-1.5">
                  <p className="text-muted-foreground">Concentration</p>
                  <p className="font-semibold">{formatPercent(report?.broker_concentration?.top3_buy_percent)}</p>
                  <p className="text-[10px] text-muted-foreground">{report?.broker_concentration?.interpretation || "-"}</p>
                </div>
              </div>
            )}
            {!isExpandedView && (
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-md px-2 py-1.5">
                  <p className="text-muted-foreground">Phase</p>
                  <p className="font-semibold">{report.market_phase || "Indeterminate"}</p>
                </div>
                <div className="rounded-md px-2 py-1.5">
                  <p className="text-muted-foreground">Risk</p>
                  <p className={`font-semibold ${riskLevel === "LOW" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>{riskLevel}</p>
                </div>
              </div>
            )}

            {/* Smart Money Summary */}
            {Array.isArray(report?.manipulation_risk?.reasons) && report.manipulation_risk.reasons.length > 0 && (
              <Card className="rounded-xl bg-amber-500/5 shadow-none">
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold mb-1">Risk notes</p>
                  <ul className="text-[11px] text-muted-foreground space-y-1">
                    {report.manipulation_risk.reasons.map((reason, index) => (
                      <li key={`${report.symbol}-risk-${index}`}>• {reason}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {report.analysis_summary && (
              <Card className="rounded-xl shadow-none">
                <CardContent className="p-3 space-y-2">
                  <p className="text-[11px] font-semibold">Smart Money Summary</p>
                  {String(report.analysis_summary)
                    .split("\n\n")
                    .filter(Boolean)
                    .map((paragraph, index) => (
                      <p key={`${report.symbol}-summary-${index}`} className="text-[11px] text-muted-foreground leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                </CardContent>
              </Card>
            )}

            {isExpandedView && screenerSnapshot && (
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg px-2 py-1.5">
                  <p className="text-muted-foreground">Price vs MA20</p>
                  <p className={`font-semibold ${Number(screenerSnapshot?.derived?.price_vs_ma20_pct || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                    {formatPercent(screenerSnapshot?.derived?.price_vs_ma20_pct)}
                  </p>
                </div>
                <div className="rounded-lg px-2 py-1.5">
                  <p className="text-muted-foreground">Volume Ratio</p>
                  <p className="font-semibold">{Number(screenerSnapshot?.derived?.volume_ratio || 0).toFixed(2)}x</p>
                </div>
                <div className="rounded-lg px-2 py-1.5">
                  <p className="text-muted-foreground">Bandar Delta</p>
                  <p className={`font-semibold ${Number(screenerSnapshot?.derived?.bandar_delta || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                    {formatCompactNumber(screenerSnapshot?.derived?.bandar_delta)}
                  </p>
                </div>
              </div>
            )}

            {/* Modern Broker Summary Board */}
            <div className="rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b flex items-center justify-between bg-black/5 dark:bg-white/5">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold">Broker Action</p>
                </div>

                <div className="flex items-center bg-background rounded-lg border border-border/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setIsNetView(false)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${!isNetView ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Gross
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNetView(true)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${isNetView ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Net
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {/* Visual Indicator Line (Big Dist -> Big Acc) */}
                <div className="w-full h-1 bg-gradient-to-r from-rose-500 via-neutral-500 to-emerald-500" />

                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b-border/40">
                      <TableHead className="text-[10px] h-8 px-2">BY</TableHead>
                      <TableHead className="text-[10px] h-8 px-2 text-right">B.val</TableHead>
                      <TableHead className="text-[10px] h-8 px-2 text-right">B.avg</TableHead>
                      <TableHead className="text-[10px] h-8 px-2 text-center border-l border-border/20">SL</TableHead>
                      <TableHead className="text-[10px] h-8 px-2 text-right">S.val</TableHead>
                      <TableHead className="text-[10px] h-8 px-2 text-right">S.avg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brokers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-[11px] text-center text-muted-foreground h-24">
                          No broker data available
                        </TableCell>
                      </TableRow>
                    )}
                    {brokers.map((row, idx) => (
                      <TableRow key={`broker-${report.symbol}-${idx}`} className="hover:bg-muted/30 border-b-border/20">
                        {/* Buy Side */}
                        <TableCell className="text-[11px] font-bold px-2 text-emerald-600 dark:text-emerald-400">{row.bCode}</TableCell>
                        <TableCell className="text-[11px] text-right px-2">{row.bVal === 0 ? '-' : formatCompactNumber(row.bVal)}</TableCell>
                        <TableCell className="text-[11px] text-right px-2 font-medium text-emerald-600 dark:text-emerald-400">{row.bAvg > 0 ? formatPrice(row.bAvg) : '-'}</TableCell>

                        {/* Sell Side */}
                        <TableCell className="text-[11px] font-bold text-center px-2 border-l border-border/20 text-rose-500 dark:text-rose-400">{row.sCode}</TableCell>
                        <TableCell className="text-[11px] text-right px-2 text-rose-500 dark:text-rose-400">{row.sVal === 0 ? '-' : formatCompactNumber(row.sVal)}</TableCell>
                        <TableCell className="text-[11px] text-right px-2 font-medium text-rose-600 dark:text-rose-400">{row.sAvg > 0 ? formatPrice(row.sAvg) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
