"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Check, FilterX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchEncodedJson } from "@/lib/api-client";
import { MoneyFlowCard } from "@/components/money-flow-card";
import { Accordion } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MONEY_FLOW_ENABLED = process.env.NEXT_PUBLIC_MONEY_FLOW_ENABLED !== "false";

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((key) => (
        <Card key={key}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
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

function ReportList({ reports }) {
  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-border bg-muted/20">
        <div className="h-12 w-12 flex items-center justify-center mb-4">
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
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!MONEY_FLOW_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          timeframe,
          sort: sortBy,
          order: sortOrder,
          min_score: "0",
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
  }, [timeframe, sortBy, sortOrder]);

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

  if (!MONEY_FLOW_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-sm font-semibold">Money Flow is not available</p>
        <p className="text-1xs text-muted-foreground">This feature is temporarily disabled.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-foreground/85 leading-relaxed">
              Smart-money breakdown based on broker flow, market phase, absorption, and screener-synced symbols.
            </p>
            {payload?.start_date && <p className="text-2xs text-muted-foreground">Window start: {payload.start_date}</p>}
          </CardContent>
        </Card>

        <div className="sticky top-14 z-30 bg-background border-b border-border -mx-4 lg:mx-0 px-4 lg:px-0 py-3 lg:py-2 lg:border-none lg:bg-background space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-1.5 p-1 bg-muted/40 rounded-2xl">
              {timeframeOptions.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  variant="ghost"
                  className={`flex-1 rounded-xl text-xs font-semibold transition-all h-9 ${timeframe === option.key
                    ? "bg-foreground text-background"
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
        <aside className="hidden xl:block sticky top-20 space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">Reports</p>
                  <p className="text-lg font-semibold">{reports.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">Accumulation</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{positiveSignals}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">Avg Vol Spike</p>
                  <p className="text-lg font-semibold">{avgVolumeSpike.toFixed(2)}x</p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">Timeframe</p>
                  <p className="text-sm font-semibold capitalize">{timeframe}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="max-w-5xl mx-auto w-full">
        {error && (
          <Card className="bg-red-600/10 border-red-600/30 mb-4">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-600">Failed to load money-flow data</p>
                <p className="text-xs text-red-600/80">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && !error && <LoadingState />}
        {!loading && !error && <ReportList reports={reports} />}

        {payload?.updated_at && (
          <p className="text-2xs text-center text-muted-foreground mt-4">
            Last updated: {new Date(payload.updated_at).toLocaleString()}
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
