"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
} from "lucide-react";

const CATEGORY_HEADERS = {
  idx: "Daily recommendations for IDX",
  us: "Daily recommendations for US",
  crypto: "Daily recommendations for Crypto",
};

const CATEGORY_SHORT = {
  idx: "IDX",
  us: "US",
  crypto: "Crypto",
};

const CATEGORY_EMOJIS = {
  idx: "🇮🇩",
  us: "🇺🇸",
  crypto: "🪙",
};

const CATEGORY_ORDER = ["idx", "us", "crypto"];

function isSameDay(a, b) {
  if (!(a instanceof Date) || Number.isNaN(a) || !(b instanceof Date) || Number.isNaN(b)) {
    return false;
  }
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (error) {
    return date.toLocaleTimeString();
  }
}

function formatDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  } catch (error) {
    return date.toLocaleDateString();
  }
}

function formatLastScreened(date) {
  if (!(date instanceof Date) || Number.isNaN(date)) {
    return "Never screened";
  }
  const now = new Date();
  if (isSameDay(date, now)) {
    return `Last screened at ${formatTime(date)}`;
  }
  return `Last screened ${formatDay(date)} • ${formatTime(date)}`;
}

function formatRelativeTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date)) {
    return "No recent screening";
  }
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return "Just now";
  }
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) {
    return "Just now";
  }
  if (diffMs < hour) {
    const mins = Math.round(diffMs / minute);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diffMs < day) {
    const hours = Math.round(diffMs / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.round(diffMs / day);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatPercent(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const rounded = value.toFixed(digits);
  return `${value >= 0 ? "+" : ""}${rounded}%`;
}

function SectionHeader({ title, subtitle, children }) {
  return (
    <div className="space-y-1.5 py-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      {children}
    </div>
  );
}

function ShimmerItem() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-16 rounded bg-muted animate-pulse"></div>
        <div className="h-3 w-32 rounded bg-muted/80 animate-pulse"></div>
      </div>
      <div className="w-[60px] h-[30px] rounded bg-muted animate-pulse"></div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-4 w-20 rounded bg-muted animate-pulse"></div>
        <div className="h-3 w-16 rounded bg-muted/80 animate-pulse"></div>
      </div>
    </div>
  );
}

function MiniChart({ data, isPositive }) {
  if (!Array.isArray(data) || data.length === 0) return <div className="w-[60px]" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 30;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={isPositive ? "text-green-600" : "text-red-600"}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PickItem({ pick, quote }) {
  const symbol = typeof pick === "string" ? pick : pick?.symbol;
  if (!symbol) return null;
  const pickData = pick && typeof pick === "object" ? pick : {};
  const change =
    typeof quote?.change === "number"
      ? quote.change
      : typeof pickData?.change === "number"
        ? pickData.change
        : 0;
  const changePercent =
    typeof quote?.changePercent === "number"
      ? quote.changePercent
      : typeof pickData?.changePercent === "number"
        ? pickData.changePercent
        : 0;
  const price =
    typeof quote?.price === "number"
      ? quote.price
      : typeof pickData?.lastClose === "number"
        ? pickData.lastClose
        : null;
  const isPositive = change >= 0;
  const color = isPositive ? "text-green-600" : "text-red-600";
  const formattedPrice =
    typeof price === "number"
      ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "-";
  const displayName = quote?.name || pickData?.name || symbol;
  const chartData =
    Array.isArray(quote?.chartData) && quote.chartData.length > 0
      ? quote.chartData
      : Array.isArray(pickData?.sparkline)
        ? pickData.sparkline
        : [];

  return (
    <Link
      href={`/election-cycle?symbol=${encodeURIComponent(symbol)}`}
      className="flex items-center gap-3 py-3 hover:bg-accent/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{symbol}</div>
        <div className="text-xs text-muted-foreground truncate">{displayName}</div>
      </div>
      <div className={`flex items-center ${Array.isArray(chartData) ? color : "text-muted-foreground"}`}>
        <MiniChart data={chartData} isPositive={isPositive} />
      </div>
      <div className="flex flex-col items-end">
        <div className="font-semibold text-sm">{formattedPrice}</div>
        <div className={`text-xs font-medium flex items-center gap-1 ${color}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? "+" : ""}
          {changePercent?.toFixed ? changePercent.toFixed(2) : "0.00"}%
        </div>
      </div>
    </Link>
  );
}

export default function ExplorePage() {
  const { supabase } = useAuth();
  const [snapshots, setSnapshots] = useState({});
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);
  const [manualLoading, setManualLoading] = useState({ idx: false, us: false, crypto: false });
  const quoteRequestRef = useRef(0);

  const loadQuotesForSnapshots = useCallback(async (snapshotMap) => {
    const requestId = ++quoteRequestRef.current;

    const symbolSet = new Set();
    CATEGORY_ORDER.forEach((category) => {
      const picks = Array.isArray(snapshotMap?.[category]?.results)
        ? snapshotMap[category].results.slice(0, 8)
        : [];
      picks.forEach((pick) => {
        const symbol = typeof pick === "string" ? pick : pick?.symbol;
        if (symbol) {
          symbolSet.add(symbol);
        }
      });
    });

    if (symbolSet.size === 0) {
      if (quoteRequestRef.current === requestId) {
        setQuotes({});
      }
      return;
    }

    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 60 * 60 * 24 * 5;

    const symbolsArray = Array.from(symbolSet);

    const quoteResults = await Promise.all(
      symbolsArray.map(async (symbol) => {
        try {
          const url = `/api/finance?symbol=${encodeURIComponent(
            symbol
          )}&startDate=${startDate}&endDate=${endDate}`;
          const res = await fetch(url);
          if (!res.ok) return null;
          const json = await res.json();
          const data = Array.isArray(json?.data) ? json.data : [];
          if (data.length < 2) return null;

          const current = data[data.length - 1];
          const previous = data[data.length - 2];
          const currentRaw =
            typeof current?.adjclose === "number"
              ? current.adjclose
              : typeof current?.close === "number"
                ? current.close
                : null;
          const previousRaw =
            typeof previous?.adjclose === "number"
              ? previous.adjclose
              : typeof previous?.close === "number"
                ? previous.close
                : null;

          if (currentRaw == null || previousRaw == null) {
            return null;
          }

          const change = currentRaw - previousRaw;
          const changePercent = previousRaw === 0 ? 0 : (change / previousRaw) * 100;
          const chartData = data
            .slice(-30)
            .map((row) =>
              typeof row?.adjclose === "number"
                ? row.adjclose
                : typeof row?.close === "number"
                  ? row.close
                  : null
            )
            .filter((value) => typeof value === "number");

          return {
            symbol,
            name: json?.meta?.name || symbol,
            price: currentRaw,
            change,
            changePercent,
            chartData,
          };
        } catch (error) {
          console.warn(`Failed to fetch real-time quote for ${symbol}`, error);
          return null;
        }
      })
    );

    if (quoteRequestRef.current !== requestId) {
      return;
    }

    const mappedQuotes = {};
    quoteResults.forEach((quote) => {
      if (quote) {
        mappedQuotes[quote.symbol] = quote;
      }
    });

    setQuotes((prev) => {
      const next = {};
      symbolsArray.forEach((symbol) => {
        if (mappedQuotes[symbol]) {
          next[symbol] = mappedQuotes[symbol];
        } else if (prev[symbol]) {
          next[symbol] = prev[symbol];
        }
      });
      return next;
    });
  }, []);

  const loadSnapshots = useCallback(async (options = {}) => {
    const { showLoader = false } = options;
    if (!supabase) {
      setSnapshots({});
      setQuotes({});
      setLoading(false);
      return;
    }
    if (showLoader) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("screening_snapshots")
        .select("*")
        .in("category", CATEGORY_ORDER);
      if (error) {
        console.warn("Failed to load screening snapshots", error);
        setSnapshots({});
        setQuotes({});
        return;
      }
      const mapped = {};
      data?.forEach((item) => {
        mapped[item.category] = item;
      });
      setSnapshots(mapped);
      await loadQuotesForSnapshots(mapped);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [supabase, loadQuotesForSnapshots]);

  useEffect(() => {
    loadSnapshots({ showLoader: true });
  }, [loadSnapshots]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("screening_snapshots_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "screening_snapshots" },
        (payload) => {
          const record = payload?.new;
          if (!record?.category) {
            return;
          }
          setSnapshots((prev) => {
            const next = { ...prev, [record.category]: record };
            loadQuotesForSnapshots(next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadQuotesForSnapshots]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadSnapshots();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, loadSnapshots]);

  const handleTouchStart = useCallback((event) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = event.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (event) => {
      if (isRefreshing || touchStartY.current === 0 || !containerRef.current) return;
      if (containerRef.current.scrollTop > 0) {
        touchStartY.current = 0;
        setPullDistance(0);
        return;
      }
      const touchY = event.touches[0].clientY;
      const distance = touchY - touchStartY.current;
      if (distance > 0) {
        setPullDistance(Math.min(distance, 150));
      }
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 80) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [pullDistance, handleRefresh]);

  const triggerBatch = useCallback(
    async (category) => {
      if (manualLoading[category]) return;
      setManualLoading((prev) => ({ ...prev, [category]: true }));
      try {
        const res = await fetch(`/api/screeners/${category}`);
        const data = await res.json();
        const message = data?.status
          ? `${category.toUpperCase()} → ${data.status.toUpperCase()}`
          : `${category.toUpperCase()} → failed`;
        alert(message);
        await loadSnapshots();
      } catch (error) {
        console.warn("Trigger failed", error);
        alert(`${category.toUpperCase()} → error`);
      } finally {
        setManualLoading((prev) => ({ ...prev, [category]: false }));
      }
    },
    [manualLoading, loadSnapshots]
  );

  const derivedData = useMemo(() => {
    const now = new Date();
    const map = {};
    CATEGORY_ORDER.forEach((category) => {
      const snapshot = snapshots?.[category];
      const picks = Array.isArray(snapshot?.results)
        ? snapshot.results
            .map((item) =>
              typeof item === "string"
                ? { symbol: item }
                : item && typeof item.symbol === "string"
                  ? item
                  : null
            )
            .filter(Boolean)
            .slice(0, 8)
        : [];
      const updatedAt = snapshot?.updated_at ? new Date(snapshot.updated_at) : null;
      const quotesForCategory = picks
        .map((pick) => {
          const symbol = pick.symbol;
          const quote = quotes[symbol];
          if (!quote) return null;
          return { ...quote, category };
        })
        .filter(Boolean);
      const averageChange =
        quotesForCategory.length > 0
          ?
            quotesForCategory.reduce(
              (acc, quote) =>
                acc + (typeof quote.changePercent === "number" ? quote.changePercent : 0),
              0
            ) / quotesForCategory.length
          : null;
      const topGainer = quotesForCategory.reduce((best, quote) => {
        if (typeof quote.changePercent !== "number") return best;
        if (!best || quote.changePercent > best.changePercent) {
          return quote;
        }
        return best;
      }, null);
      const topLoser = quotesForCategory.reduce((worst, quote) => {
        if (typeof quote.changePercent !== "number") return worst;
        if (!worst || quote.changePercent < worst.changePercent) {
          return quote;
        }
        return worst;
      }, null);
      const positiveCount = quotesForCategory.filter(
        (quote) => typeof quote.change === "number" && quote.change >= 0
      ).length;
      const negativeCount = quotesForCategory.filter(
        (quote) => typeof quote.change === "number" && quote.change < 0
      ).length;

      map[category] = {
        picks,
        updatedAt,
        hasRunToday: updatedAt ? isSameDay(updatedAt, now) : false,
        averageChange,
        topGainer,
        topLoser,
        positiveCount,
        negativeCount,
        quotes: quotesForCategory,
      };
    });
    return map;
  }, [snapshots, quotes]);

  const aggregatedStats = useMemo(() => {
    const entries = CATEGORY_ORDER.map((category) => {
      const data = derivedData[category];
      if (!data) return null;
      return { category, ...data };
    }).filter(Boolean);

    const picksTotal = entries.reduce((sum, entry) => sum + entry.picks.length, 0);
    const quotesAll = entries.flatMap((entry) => entry.quotes);
    const averageChange =
      quotesAll.length > 0
        ?
          quotesAll.reduce(
            (acc, quote) => acc + (typeof quote.changePercent === "number" ? quote.changePercent : 0),
            0
          ) / quotesAll.length
        : null;
    const topOverall = quotesAll.reduce((best, quote) => {
      if (typeof quote.changePercent !== "number") return best;
      if (!best || quote.changePercent > best.changePercent) {
        return quote;
      }
      return best;
    }, null);
    const worstOverall = quotesAll.reduce((worst, quote) => {
      if (typeof quote.changePercent !== "number") return worst;
      if (!worst || quote.changePercent < worst.changePercent) {
        return quote;
      }
      return worst;
    }, null);
    const latestRun = entries.reduce((latest, entry) => {
      if (!entry.updatedAt) return latest;
      if (!latest || entry.updatedAt > latest) {
        return entry.updatedAt;
      }
      return latest;
    }, null);
    const categoriesRunToday = entries.filter((entry) => entry.hasRunToday).length;
    const positiveTotal = entries.reduce((sum, entry) => sum + entry.positiveCount, 0);
    const negativeTotal = entries.reduce((sum, entry) => sum + entry.negativeCount, 0);

    return {
      picksTotal,
      averageChange,
      topOverall,
      worstOverall,
      latestRun,
      categoriesRunToday,
      positiveTotal,
      negativeTotal,
    };
  }, [derivedData]);

  const categoryInsights = useMemo(() => {
    return CATEGORY_ORDER.map((category) => {
      const data = derivedData[category];
      if (!data || data.picks.length === 0) return null;
      return {
        category,
        averageChange: data.averageChange,
        updatedAt: data.updatedAt,
        hasRunToday: data.hasRunToday,
        picksCount: data.picks.length,
      };
    }).filter(Boolean);
  }, [derivedData]);

  const screeningLocks = useMemo(() => {
    const locks = {};
    CATEGORY_ORDER.forEach((category) => {
      locks[category] = Boolean(derivedData[category]?.hasRunToday);
    });
    return locks;
  }, [derivedData]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-40 rounded-2xl bg-muted animate-pulse"></div>
        <div className="space-y-3">
          <div className="h-3 w-32 rounded bg-muted animate-pulse"></div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-9 rounded-full bg-muted animate-pulse"></div>
            ))}
          </div>
        </div>
        {CATEGORY_ORDER.map((category) => (
          <div key={category} className="space-y-2">
            <div className="h-3 w-40 rounded bg-muted animate-pulse"></div>
            <div className="divide-y">
              {[...Array(4)].map((_, idx) => (
                <ShimmerItem key={idx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-6 pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center transition-all duration-200"
          style={{ height: `${Math.min(pullDistance, 120)}px` }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" /> Explore radar
              </span>
              <h1 className="text-xl font-bold text-foreground">Daily breakout intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Discover real-time opportunities across IDX, US, and Crypto universes. Signals are refreshed with live data from Yahoo Finance so you can act with confidence.
              </p>
            </div>
            <div className="rounded-xl border bg-background/80 px-4 py-3 text-xs shadow-sm space-y-1 min-w-[180px]">
              <div className="flex items-center gap-2 font-semibold text-muted-foreground uppercase tracking-wide">
                <BarChart3 className="h-3 w-3" /> Latest activity
              </div>
              <div className="text-sm font-semibold text-foreground">
                {formatRelativeTime(aggregatedStats.latestRun)}
              </div>
              <div className="text-muted-foreground">
                Screenings today: {aggregatedStats.categoriesRunToday}/{CATEGORY_ORDER.length}
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/80 p-4">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">Actionable ideas</div>
              <div className="mt-2 text-lg font-bold text-foreground">
                {aggregatedStats.picksTotal ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Unique symbols surfaced in the latest screening run.</p>
            </div>
            <div className="rounded-xl border bg-background/80 p-4">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">Average move</div>
              <div
                className={`mt-2 text-lg font-bold ${
                  aggregatedStats.averageChange != null
                    ? aggregatedStats.averageChange >= 0
                      ? "text-green-600"
                      : "text-red-600"
                    : "text-foreground"
                }`}
              >
                {aggregatedStats.averageChange != null ? formatPercent(aggregatedStats.averageChange) : "—"}
              </div>
              <p className="text-xs text-muted-foreground">Mean percentage change across tracked picks today.</p>
            </div>
            <div className="rounded-xl border bg-background/80 p-4">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide">Top mover</div>
              {aggregatedStats.topOverall ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {aggregatedStats.topOverall.symbol}
                    {aggregatedStats.topOverall.category ? (
                      <span className="text-xs">{CATEGORY_EMOJIS[aggregatedStats.topOverall.category]}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {aggregatedStats.topOverall.name}
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    {formatPercent(aggregatedStats.topOverall.changePercent)}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Awaiting fresh signals.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="Screening now"
            subtitle="Trigger a manual run when needed. We lock additional attempts once a category has been screened today."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {CATEGORY_ORDER.map((category) => {
              const locked = screeningLocks[category];
              const status = derivedData[category];
              return (
                <div key={category} className="space-y-2 rounded-xl border bg-background/60 p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-center gap-2 rounded-full text-xs"
                    onClick={() => triggerBatch(category)}
                    disabled={manualLoading[category] || locked}
                  >
                    {manualLoading[category] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : locked ? (
                      <CalendarClock className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {CATEGORY_SHORT[category]}
                  </Button>
                  <div className="text-[11px] text-muted-foreground">
                    {formatLastScreened(status?.updatedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(aggregatedStats.topOverall || aggregatedStats.worstOverall || aggregatedStats.picksTotal > 0) && (
          <div className="space-y-3">
            <SectionHeader
              title="Today's highlights"
              subtitle="Quick movers and breadth from the latest screen."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {aggregatedStats.topOverall && (
                <div className="rounded-xl border bg-background/60 p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ArrowUpRight className="h-4 w-4 text-green-600" />
                      {aggregatedStats.topOverall.symbol}
                      {aggregatedStats.topOverall.category ? (
                        <span className="text-xs">{CATEGORY_EMOJIS[aggregatedStats.topOverall.category]}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {aggregatedStats.topOverall.name}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    {formatPercent(aggregatedStats.topOverall.changePercent)}
                  </div>
                </div>
              )}
              {aggregatedStats.worstOverall && (
                <div className="rounded-xl border bg-background/60 p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                      {aggregatedStats.worstOverall.symbol}
                      {aggregatedStats.worstOverall.category ? (
                        <span className="text-xs">{CATEGORY_EMOJIS[aggregatedStats.worstOverall.category]}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {aggregatedStats.worstOverall.name}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-red-600">
                    {formatPercent(aggregatedStats.worstOverall.changePercent)}
                  </div>
                </div>
              )}
              {aggregatedStats.picksTotal > 0 && (
                <div className="rounded-xl border bg-background/60 p-4 sm:col-span-2 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      Market breadth
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {aggregatedStats.positiveTotal} gainers · {aggregatedStats.negativeTotal} laggards today
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {aggregatedStats.picksTotal} total tracked symbols
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {categoryInsights.length > 0 && (
          <div className="space-y-3">
            <SectionHeader
              title="Category snapshot"
              subtitle="Average move and freshness for each universe."
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {categoryInsights.map((item) => (
                <div key={item.category} className="rounded-xl border bg-background/60 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span className="flex items-center gap-2">
                      <span className="text-base">{CATEGORY_EMOJIS[item.category]}</span>
                      {CATEGORY_SHORT[item.category]}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        item.averageChange != null
                          ? item.averageChange >= 0
                            ? "text-green-600"
                            : "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.averageChange != null ? formatPercent(item.averageChange) : "—"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatLastScreened(item.updatedAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.picksCount} active ideas · {item.hasRunToday ? "Locked for today" : "Ready to rerun"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {CATEGORY_ORDER.map((category) => {
          const details = derivedData[category];
          if (!details || details.picks.length === 0) {
            return null;
          }
          return (
            <section key={category}>
              <SectionHeader
                title={`${CATEGORY_HEADERS[category]} ${CATEGORY_EMOJIS[category]}`}
                subtitle={formatLastScreened(details.updatedAt)}
              >
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{details.picks.length} candidates</span>
                  {details.averageChange != null ? (
                    <span className={details.averageChange >= 0 ? "text-green-600" : "text-red-600"}>
                      Avg {formatPercent(details.averageChange)}
                    </span>
                  ) : null}
                  <span>
                    {details.positiveCount} gainers · {details.negativeCount} laggards
                  </span>
                </div>
              </SectionHeader>
              <div className="divide-y rounded-xl border bg-background/60">
                {details.picks.map((pick) => (
                  <PickItem key={pick.symbol} pick={pick} quote={quotes[pick.symbol]} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
