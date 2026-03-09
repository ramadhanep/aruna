"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Check, ChevronRight, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchEncodedJson } from "@/lib/api-client";
import { TickerAvatar } from "@/components/ticker-avatar";
const timeframeOptions = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
];

const sortOptions = [
  { key: "score", label: "Money Flow Score" },
  { key: "volume_spike", label: "Volume Spike" },
  { key: "price_change", label: "Price Change" },
];

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
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatPercent(value, fractionDigits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0.00%";
  return `${numeric.toFixed(fractionDigits)}%`;
}

function formatDecimalPercent(value, fractionDigits = 2) {
  const numeric = Number(value || 0) * 100;
  if (!Number.isFinite(numeric)) return "0.00%";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(fractionDigits)}%`;
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "Rp 0";
  return `Rp ${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(numeric)}`;
}

function SignalBadge({ signal }) {
  const className = signalStyles[signal] || signalStyles.Neutral;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>
      {signal}
    </span>
  );
}

function RiskBadge({ level }) {
  const risk = String(level || "LOW").toUpperCase();
  const className = riskStyles[risk] || riskStyles.LOW;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>
      {risk}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((key) => (
        <Card key={key} className="rounded-2xl border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-3 w-28 bg-black/10 dark:bg-white/10" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-10 rounded-xl bg-black/10 dark:bg-white/10" />
              <Skeleton className="h-10 rounded-xl bg-black/10 dark:bg-white/10" />
              <Skeleton className="h-10 rounded-xl bg-black/10 dark:bg-white/10" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ScoreSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Score</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{Number(summary.average_score || 0).toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Stocks</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{summary.total_stocks || 0}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Absorption</p>
          <p className="text-sm font-semibold">{Number(summary.average_absorption || 0).toFixed(2)}%</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">High Risk</p>
          <p className="text-sm font-semibold">{summary.high_risk_count || 0}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MoneyFlowCard({ report }) {
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

  const brokerRows = Array.isArray(report.broker_summary) ? report.broker_summary.slice(0, 6) : [];
  const inventoryRows = Array.isArray(report.broker_inventory) ? report.broker_inventory.slice(0, 5) : [];

  // Let's decide on card style based on signal
  let cardGradient = "from-neutral-500/5 dark:from-neutral-500/10";
  if (report.signal?.includes("Accumulation")) cardGradient = "from-emerald-500/5 dark:from-emerald-500/10";
  else if (report.signal?.includes("Distribution")) cardGradient = "from-rose-500/5 dark:from-rose-500/10";
  else if (report.signal === "Neutral") cardGradient = "from-amber-500/5 dark:from-amber-500/10";

  return (
    <AccordionItem value={`${report.symbol}-${report.report_date}`} className="border-none">
      <Card className={`bg-gradient-to-br ${cardGradient} to-transparent border-white/[0.08] dark:border-white/[0.08] text-foreground dark:text-white overflow-hidden relative rounded-2xl shadow-lg`}>
        <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>div>svg]:rotate-180">
          <div className="flex-1 min-w-0 space-y-3 text-left">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold truncate">{report.symbol}</h3>
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
                  <p className="text-sm font-semibold">
                    Rp {Number(report.current_price || 0).toLocaleString("id-ID")}
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

            {/* Phase & Risk */}
            <div className="flex items-center justify-between p-2 bg-black/5 dark:bg-white/5 rounded-lg">
              <span className="text-[10px] text-muted-foreground dark:text-white/70">Top 3 Buy</span>
              <span className="text-xs font-semibold">{formatPercent(report.top3_percent)}</span>
            </div>

            {/* Progress-like row for absorption/volume spike */}
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

            {/* Analysis & Risk */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/10 dark:border-white/10">
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
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4">
          <div className="space-y-3 pt-1 border-t border-black/10 dark:border-white/10">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-border/60 px-2 py-1.5">
                <p className="text-muted-foreground">Broker Cost</p>
                <p className="font-semibold">{formatCompactNumber(report?.broker_cost_analysis?.estimated_cost)}</p>
                <p className="text-[10px] text-muted-foreground">{report?.broker_cost_analysis?.interpretation || "-"}</p>
              </div>
              <div className="rounded-lg border border-border/60 px-2 py-1.5">
                <p className="text-muted-foreground">Concentration</p>
                <p className="font-semibold">{formatPercent(report?.broker_concentration?.top3_buy_percent)}</p>
                <p className="text-[10px] text-muted-foreground">{report?.broker_concentration?.interpretation || "-"}</p>
              </div>
            </div>

            {Array.isArray(report?.manipulation_risk?.reasons) && report.manipulation_risk.reasons.length > 0 && (
              <Card className="rounded-xl border-border/60 bg-amber-500/5 shadow-none">
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
              <Card className="rounded-xl border-border/60 shadow-none">
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

            {screenerSnapshot && (
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg border border-border/60 px-2 py-1.5">
                  <p className="text-muted-foreground">Price vs MA20</p>
                  <p className={`font-semibold ${Number(screenerSnapshot?.derived?.price_vs_ma20_pct || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                    {formatPercent(screenerSnapshot?.derived?.price_vs_ma20_pct)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 px-2 py-1.5">
                  <p className="text-muted-foreground">Volume Ratio</p>
                  <p className="font-semibold">{Number(screenerSnapshot?.derived?.volume_ratio || 0).toFixed(2)}x</p>
                </div>
                <div className="rounded-lg border border-border/60 px-2 py-1.5">
                  <p className="text-muted-foreground">Bandar Delta</p>
                  <p className={`font-semibold ${Number(screenerSnapshot?.derived?.bandar_delta || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                    {formatCompactNumber(screenerSnapshot?.derived?.bandar_delta)}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/60">
              <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                <p className="text-xs font-semibold">Broker Inventory</p>
                <span className="text-[10px] text-muted-foreground">Top net buyers</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Broker</TableHead>
                    <TableHead className="text-[11px] text-right">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-[11px] text-muted-foreground">
                        Inventory data unavailable.
                      </TableCell>
                    </TableRow>
                  )}
                  {inventoryRows.map((row) => (
                    <TableRow key={`${report.symbol}-${row.broker}`}>
                      <TableCell className="text-[11px] font-semibold">{row.broker}</TableCell>
                      <TableCell className="text-[11px] text-right text-emerald-600 dark:text-emerald-400">
                        {formatCompactNumber(row.position)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border border-border/60">
              <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                <p className="text-xs font-semibold">Broker Summary</p>
                <span className="text-[10px] text-muted-foreground">Gross &amp; Net Activity</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Broker</TableHead>
                    <TableHead className="text-[11px] text-right">Buy</TableHead>
                    <TableHead className="text-[11px] text-right">Sell</TableHead>
                    <TableHead className="text-[11px] text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brokerRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-[11px] text-muted-foreground">
                        Broker summary unavailable.
                      </TableCell>
                    </TableRow>
                  )}
                  {brokerRows.map((row) => (
                    <TableRow key={`${report.symbol}-${row.broker_code}`}>
                      <TableCell className="text-[11px] font-semibold">{row.broker_code}</TableCell>
                      <TableCell className="text-[11px] text-right">{formatCompactNumber(row.gross_buy)}</TableCell>
                      <TableCell className="text-[11px] text-right">{formatCompactNumber(row.gross_sell)}</TableCell>
                      <TableCell className={`text-[11px] text-right font-semibold ${Number(row.net_value || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                        {formatCompactNumber(row.net_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}

function ReportList({ reports }) {
  if (!reports.length) {
    return (
      <Card className="bg-muted/20 rounded-2xl">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No money flow report found for current timeframe.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-3">
      {reports.map((report) => (
        <MoneyFlowCard key={`${report.symbol}-${report.report_date}`} report={report} />
      ))}
    </Accordion>
  );
}

export default function MoneyFlowPage() {
  const [timeframe, setTimeframe] = useState("weekly");
  const [sortBy, setSortBy] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [minScoreInput, setMinScoreInput] = useState("0");
  const [minScore, setMinScore] = useState(0);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          timeframe,
          sort: sortBy,
          order: sortOrder,
          min_score: String(minScore),
          limit: "150",
        });

        const { response, data } = await fetchEncodedJson(`/api/money-flow?${params.toString()}`);
        if (!response.ok || data?.error) {
          throw new Error(data?.error || "Failed to fetch money flow data");
        }

        if (!cancelled) {
          setPayload(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.message || "Failed to load money flow data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [timeframe, sortBy, sortOrder, minScore]);

  const reports = payload?.reports || [];
  const activeSortLabel = useMemo(
    () => sortOptions.find((option) => option.key === sortBy)?.label || "Money Flow Score",
    [sortBy]
  );

  return (
    <div className="space-y-4 pb-4">
      <Card className="border-none bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-white shadow-xl shadow-emerald-900/30 rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs text-white/85 leading-relaxed">
            Smart-money breakdown based on broker flow, market phase, absorption, and screener-synced symbols.
          </p>
          {/* {payload?.screener?.name && (
            <p className="text-[10px] text-white/80">
              Universe: {payload.screener.name} ({payload.screener.total_rows || 0} stocks)
            </p>
          )} */}
          {payload?.start_date && <p className="text-[10px] text-white/75">Window start: {payload.start_date}</p>}
        </CardContent>
      </Card>

      <div className="sticky top-14 z-30 glass border-b border-border/30 -mx-4 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1.5 p-1 bg-muted/40 rounded-2xl">
            {timeframeOptions.map((option) => (
              <Button
                key={option.key}
                type="button"
                variant="ghost"
                className={`flex-1 rounded-xl text-xs font-semibold transition-all h-9 ${timeframe === option.key
                  ? "bg-gradient-to-br from-emerald-700 to-teal-800 text-white shadow-lg shadow-emerald-500/20"
                  : "hover:bg-muted/60"
                  }`}
                onClick={() => setTimeframe(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label="Sort reports">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {sortOptions.map((option) => (
                <DropdownMenuItem
                  key={option.key}
                  onClick={() => setSortBy(option.key)}
                  className="text-xs flex items-center gap-2"
                >
                  <Check className={`h-3 w-3 ${sortBy === option.key ? "opacity-100" : "opacity-0"}`} />
                  {option.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setSortOrder("desc")} className="text-xs flex items-center gap-2">
                <Check className={`h-3 w-3 ${sortOrder === "desc" ? "opacity-100" : "opacity-0"}`} />
                Descending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("asc")} className="text-xs flex items-center gap-2">
                <Check className={`h-3 w-3 ${sortOrder === "asc" ? "opacity-100" : "opacity-0"}`} />
                Ascending
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error && (
        <Card className="bg-red-600/10 border-red-600/30 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-600">Failed to load money-flow data</p>
              <p className="text-xs text-red-600/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* {!error && <ScoreSummary summary={payload?.summary} />} */}

      {loading && !error && <LoadingState />}
      {!loading && !error && <ReportList reports={reports} />}

      {payload?.updated_at && (
        <p className="text-[10px] text-center text-muted-foreground">
          Last updated: {new Date(payload.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
