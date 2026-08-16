"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
    <div className="skeleton-stagger space-y-3">
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
  { key: "weekly", labelKey: "timeframe.weekly" },
  { key: "monthly", labelKey: "timeframe.monthly" },
  { key: "quarterly", labelKey: "timeframe.quarterly" },
];

const sortOptions = [
  { key: "score", labelKey: "sort.score" },
  { key: "volume_spike", labelKey: "sort.volumeSpike" },
  { key: "price_change", labelKey: "sort.priceChange" },
];

function ReportList({ reports }) {
  const t = useTranslations("moneyFlow");

  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-border bg-muted/20">
        <div className="h-12 w-12 flex items-center justify-center mb-4">
          <FilterX className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{t("noResults")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("noResultsHint")}</p>
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
  const t = useTranslations("moneyFlow");
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
          throw new Error(data?.error || t("fetchError"));
        }

        if (!cancelled) {
          setPayload(data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.message || t("loadError"));
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
  }, [timeframe, sortBy, sortOrder, t]);

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
        <p className="text-sm font-semibold">{t("disabledTitle")}</p>
        <p className="text-1xs text-muted-foreground">{t("disabledDescription")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-foreground/85 leading-relaxed">
              {t("intro")}
            </p>
            {payload?.start_date && <p className="text-2xs text-muted-foreground">{t("windowStart", { date: payload.start_date })}</p>}
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
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label={t("sortReports")}>
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
                  {t(option.labelKey)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={() => setSortOrder("desc")} className="text-xs flex items-center gap-2">
                  <Check className={`h-3 w-3 ${sortOrder === "desc" ? "opacity-100" : "opacity-0"}`} />
                  {t("descending")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("asc")} className="text-xs flex items-center gap-2">
                  <Check className={`h-3 w-3 ${sortOrder === "asc" ? "opacity-100" : "opacity-0"}`} />
                  {t("ascending")}
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
                  <p className="text-2xs text-muted-foreground">{t("statsReports")}</p>
                  <p className="text-lg font-semibold">{reports.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">{t("statsAccumulation")}</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{positiveSignals}</p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">{t("statsAvgVolSpike")}</p>
                  <p className="text-lg font-semibold">{avgVolumeSpike.toFixed(2)}x</p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
                  <p className="text-2xs text-muted-foreground">{t("statsTimeframe")}</p>
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
                <p className="text-xs font-semibold text-red-600">{t("errorTitle")}</p>
                <p className="text-xs text-red-600/80">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && !error && <LoadingState />}
        {!loading && !error && <ReportList reports={reports} />}

        {payload?.updated_at && (
          <p className="text-2xs text-center text-muted-foreground mt-4">
            {t("lastUpdated", { time: new Date(payload.updated_at).toLocaleString() })}
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
