"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Check, FilterX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchEncodedJson } from "@/lib/api-client";
import { TickerAvatar } from "@/components/ticker-avatar";
import { MoneyFlowCard } from "@/components/money-flow-card";
import { Accordion } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((key) => (
        <Card key={key} className="rounded-2xl border-border/30">
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


function ReportList({ reports }) {
  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-border/30 bg-black/5 dark:bg-white/5">
        <div className="h-12 w-12 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center mb-4">
          <FilterX className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No results found</p>
        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search query</p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-3">
      {reports.map((report) => (
        <MoneyFlowCard key={`${report.symbol}-${report.report_date}`} report={report} isExpandedView={true} />
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

  const reports = useMemo(() => payload?.reports || [], [payload]);
  const positiveSignals = useMemo(
    () => reports.filter((item) => String(item?.signal || "").includes("Accumulation")).length,
    [reports]
  );
  const avgVolumeSpike = useMemo(() => {
    if (!reports.length) return 0;
    const total = reports.reduce((sum, item) => sum + Number(item?.volume_spike || 0), 0);
    return total / reports.length;
  }, [reports]);
  const activeSortLabel = useMemo(
    () => sortOptions.find((option) => option.key === sortBy)?.label || "Money Flow Score",
    [sortBy]
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-4">
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

        <div className="sticky top-14 z-30 glass border-b border-border/30 -mx-4 lg:mx-0 px-4 lg:px-0 py-3 lg:py-2 lg:border-none lg:bg-transparent lg:backdrop-blur-none space-y-2">
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

          {/* <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-border/40 bg-background/80 p-2">
            <div className="w-36">
              <Input
                value={minScoreInput}
                onChange={(event) => setMinScoreInput(event.target.value)}
                placeholder="Min score"
                className="h-9 rounded-xl border-border/40 text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={() => setMinScore(Number(minScoreInput || 0))}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => {
                setMinScoreInput("0");
                setMinScore(0);
              }}
            >
              Reset
            </Button>
            <div className="ml-auto text-xs text-muted-foreground">
              Sort: <span className="font-semibold text-foreground">{activeSortLabel}</span>
            </div>
          </div> */}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
        <aside className="hidden xl:block sticky top-20 space-y-3">
          <Card className="rounded-2xl border-border/40 bg-gradient-to-b from-background to-muted/20">
            <CardContent className="p-4 space-y-3">
              {/* <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Desk Snapshot</p> */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Reports</p>
                  <p className="text-lg font-semibold">{reports.length}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Accumulation</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{positiveSignals}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Avg Vol Spike</p>
                  <p className="text-lg font-semibold">{avgVolumeSpike.toFixed(2)}x</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-background/70 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">Timeframe</p>
                  <p className="text-sm font-semibold capitalize">{timeframe}</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Desktop mode now separates controls from report stream for faster scanning.
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="max-w-5xl mx-auto w-full">
        {error && (
          <Card className="bg-red-600/10 border-red-600/30 rounded-2xl mb-4">
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
          <p className="text-[10px] text-center text-muted-foreground mt-4">
            Last updated: {new Date(payload.updated_at).toLocaleString()}
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
