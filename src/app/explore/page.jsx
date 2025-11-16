"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useId } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Lock } from "lucide-react";

const CATEGORY_LABELS = {
  idx: "IDX 🇮🇩",
  us: "US 🇺🇸",
  crypto: "Crypto ⚡",
};

const CATEGORY_ORDER = ["idx", "us", "crypto"];

const HIGHLIGHT_SYMBOLS = [
  { symbol: "^SPX", label: "S&P 500", badge: "500", group: "US", accent: "bg-rose-500" },
  { symbol: "^IXIC", label: "Nasdaq 100", badge: "100", group: "US", accent: "bg-sky-500" },
  { symbol: "^JKSE", label: "IDX Composite", badge: "JK", group: "ID", accent: "bg-amber-500" },
  { symbol: "BTC-USD", label: "Bitcoin", badge: "BTC", group: "Crypto", accent: "bg-emerald-500" },
];

function formatPercent(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(digits)}%`;
}

function formatLocalDateTimeLabel(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLocalTimeLabel(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameCalendarDay(dateA, dateB = new Date()) {
  if (!dateA) return false;
  const a = typeof dateA === "string" ? new Date(dateA) : dateA;
  if (Number.isNaN(a.getTime())) return false;
  return (
    a.getFullYear() === dateB.getFullYear() &&
    a.getMonth() === dateB.getMonth() &&
    a.getDate() === dateB.getDate()
  );
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizePick(item) {
  if (!item) return null;
  if (typeof item === "string") {
    return { symbol: item };
  }
  if (typeof item.symbol === "string" && item.symbol.trim().length > 0) {
    return item;
  }
  return null;
}

function resolveChangePercent(pick, quote) {
  if (quote && typeof quote.changePercent === "number") {
    return quote.changePercent;
  }
  if (pick && typeof pick.changePercent === "number") {
    return pick.changePercent;
  }
  return null;
}

function resolvePrice(pick, quote) {
  if (quote && typeof quote.price === "number") {
    return quote.price;
  }
  if (pick && typeof pick.lastClose === "number") {
    return pick.lastClose;
  }
  return null;
}

function resolveName(pick, quote) {
  if (quote && typeof quote.name === "string" && quote.name.trim().length > 0) {
    return quote.name;
  }
  if (pick && typeof pick.name === "string" && pick.name.trim().length > 0) {
    return pick.name;
  }
  return pick?.symbol || "";
}

function ShimmerItem() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 w-16 rounded-full shimmer"></div>
        <div className="h-3 w-32 rounded-full shimmer"></div>
      </div>
      <div className="w-[72px] h-[36px] rounded-xl shimmer"></div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-3 w-20 rounded-full shimmer"></div>
        <div className="h-3 w-16 rounded-full shimmer"></div>
      </div>
    </div>
  );
}

function MiniChart({ data, isPositive, width = 72, height = 36, chartId }) {
  const generatedId = useId();
  const gradientKey = chartId ?? generatedId;
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className="rounded-full bg-muted/40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coordinates = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const linePath = coordinates
    .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${coordinates[coordinates.length - 1].x.toFixed(2)},${height} L0,${height} Z`;
  const strokeColor = isPositive ? "#10b981" : "#ef4444";
  const gradientId = `${gradientKey}-fill`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} opacity="0.9" />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coordinates[coordinates.length - 1].x}
        cy={coordinates[coordinates.length - 1].y}
        r={2.4}
        fill={strokeColor}
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
  const color = isPositive ? "text-emerald-600" : "text-red-600";
  const formattedPrice = typeof price === "number"
    ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";
  const displayName = quote?.name || pickData?.name || symbol;
  const isWarning = Boolean(pickData?.is_warning);
  const chartData =
    Array.isArray(quote?.chartData) && quote.chartData.length > 0
      ? quote.chartData
      : Array.isArray(pickData?.sparkline)
        ? pickData.sparkline
        : [];

  return (
    <Link
      href={`/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal`}
      className="flex items-center gap-3 py-3 hover:bg-accent/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate flex items-center gap-1">
          <span>{symbol}</span>
          {isWarning ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title="High volume vs market cap" />
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground truncate">{displayName}</div>
      </div>
      <div className={`flex items-center ${Array.isArray(chartData) ? color : "text-muted-foreground"}`}>
        <MiniChart data={chartData} isPositive={isPositive} chartId={`explore-${symbol}`} />
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
  const { supabase, user } = useAuth();
  const [snapshots, setSnapshots] = useState({});
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [manualLoading, setManualLoading] = useState({ idx: false, us: false, crypto: false });
  const touchStartY = useRef(0);
  const containerRef = useRef(null);
  const quoteRequestRef = useRef(0);

  const loadQuotesForSnapshots = useCallback(async (snapshotMap) => {
    const requestId = ++quoteRequestRef.current;

    const symbolSet = new Set();
    CATEGORY_ORDER.forEach((category) => {
      const picks = Array.isArray(snapshotMap?.[category]?.results)
        ? snapshotMap[category].results
        : [];
      picks.forEach((pick) => {
        const symbol = typeof pick === "string" ? pick : pick?.symbol;
        if (symbol) {
          symbolSet.add(symbol);
        }
      });
    });
    HIGHLIGHT_SYMBOLS.forEach(({ symbol }) => symbolSet.add(symbol));

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

  const loadSnapshots = useCallback(async () => {
    if (!supabase) {
      setSnapshots({});
      setQuotes({});
      setLoading(false);
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
  }, [supabase, loadQuotesForSnapshots]);

  useEffect(() => {
    loadSnapshots();
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

  const isAuthenticated = Boolean(user);

  const breakoutInsights = useMemo(() => {
    const categories = [];
    const allSignals = [];
    let totalChange = 0;
    let changers = 0;
    let latestTimestamp = null;

    CATEGORY_ORDER.forEach((category) => {
      const snapshot = snapshots[category];
      const rawResults = Array.isArray(snapshot?.results) ? snapshot.results : [];
      const normalized = rawResults
        .map((item) => normalizePick(item))
        .filter(Boolean);
      if (normalized.length === 0) {
        return;
      }
      const lastScreened = snapshot?.updated_at ? new Date(snapshot.updated_at) : null;
      if (lastScreened && (!latestTimestamp || lastScreened > latestTimestamp)) {
        latestTimestamp = lastScreened;
      }

      let categoryChangeSum = 0;
      let categoryChangeCount = 0;

      const enriched = normalized.map((pick) => {
        const symbol = pick.symbol;
        const quote = quotes[symbol];
        const changePercent = resolveChangePercent(pick, quote);
        if (typeof changePercent === "number") {
          totalChange += changePercent;
          changers += 1;
          categoryChangeSum += changePercent;
          categoryChangeCount += 1;
        }
        const detail = {
          symbol,
          pick,
          quote,
          changePercent,
          price: resolvePrice(pick, quote),
        };
        allSignals.push(detail);
        return detail;
      });

      categories.push({
        category,
        title: CATEGORY_LABELS[category] ?? category,
        snapshot,
        picks: normalized,
        enriched,
        lastScreened,
        averageChange:
          categoryChangeCount > 0 ? categoryChangeSum / categoryChangeCount : null,
      });
    });

    const averageChange = changers > 0 ? totalChange / changers : null;

    const bestGainer = allSignals.reduce((best, signal) => {
      if (typeof signal.changePercent !== "number") return best;
      if (!best || signal.changePercent > best.changePercent) {
        return signal;
      }
      return best;
    }, null);

    const bestLoser = allSignals.reduce((worst, signal) => {
      if (typeof signal.changePercent !== "number") return worst;
      if (!worst || signal.changePercent < worst.changePercent) {
        return signal;
      }
      return worst;
    }, null);

    return {
      categories,
      totalBreakouts: allSignals.length,
      averageChange,
      lastUpdated: latestTimestamp,
      bestGainer,
      bestLoser,
    };
  }, [quotes, snapshots]);

  const highlightClusters = useMemo(
    () =>
      HIGHLIGHT_SYMBOLS.map((meta) => ({
        ...meta,
        quote: quotes[meta.symbol],
      })),
    [quotes]
  );

  const categoriesWithSignals = breakoutInsights.categories;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg bg-background/80">
          <div className="mt-4 grid grid-cols-2 gap-3">
            {HIGHLIGHT_SYMBOLS.map((symbol) => (
              <div key={symbol.symbol} className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  {/* <div className="h-8 w-8 rounded-full shimmer" /> */}
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-16 rounded-full shimmer" />
                    <div className="h-3 w-20 rounded-full shimmer" />
                  </div>
                </div>
                <div className="h-12 rounded-2xl shimmer" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl">
          <div className="h-5 w-32 rounded-full shimmer" />
          <div className="mt-4 divide-y">
            {[...Array(4)].map((_, idx) => (
              <ShimmerItem key={idx} />
            ))}
          </div>
        </div>
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
            <Loader2 className={`h-6 w-6 text-muted-foreground ${pullDistance > 80 || isRefreshing ? "animate-spin" : ""}`} />
          </div>
        </div>
      )}

      <div className="space-y-6">
        <section className="bg-background/80">
          <div className="grid grid-cols-2 gap-3">
            {highlightClusters.map((item) => {
              const changeValue = item.quote?.change ?? 0;
              const isPositive = changeValue >= 0;
              return (
                <Link
                  key={item.symbol}
                  href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
                  className="rounded-lg py-4 overflow-hidden border border-transparent hover:border-border/60 transition-colors block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-base font-semibold text-foreground">{item.label}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground mr-3">
                      {item.quote ? "Live" : "Syncing"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {item.quote ? formatPrice(item.quote.price) : "—"}
                      </p>
                      <p className={`text-xs font-semibold ${isPositive ? "text-emerald-500" : "text-red-600"}`}>
                        {item.quote && typeof item.quote.changePercent === "number"
                          ? `${isPositive ? "+" : ""}${item.quote.changePercent.toFixed(2)}% today`
                          : "Fetching data"}
                      </p>
                    </div>
                    <div className={`flex items-center ${isPositive ? "text-emerald-500" : "text-red-600"}`}>
                      <MiniChart
                        data={item.quote?.chartData || []}
                        isPositive={isPositive}
                        width={80}
                        height={48}
                        chartId={`highlight-${item.symbol}`}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-5 bg-background/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Screening Now
              </p>
              <p className="text-[11px] text-muted-foreground">
                Run a fresh pass whenever you need fresh signals.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {CATEGORY_ORDER.map((category) => {
              const snapshot = snapshots[category];
              const lastScreened = snapshot?.updated_at ? new Date(snapshot.updated_at) : null;
              const screenedToday = isSameCalendarDay(lastScreened);
              const label = category.toUpperCase();
              return (
                <div key={category} className="space-y-1 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-full text-xs border-border/70 bg-background/80"
                    onClick={() => triggerBatch(category)}
                    disabled={manualLoading[category]}
                  >
                    {manualLoading[category] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      label
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {lastScreened
                      ? `Last ${screenedToday ? "today" : formatLocalDateTimeLabel(lastScreened)}`
                      : "Never screened"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {categoriesWithSignals.map((section) => {
          const gatedPicks = section.picks.slice(2);
          const firstPicks = section.picks.slice(0, 2);
          const shouldGate = !isAuthenticated && gatedPicks.length > 0;
          return (
            <section key={section.category} className="bg-background/70 py-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    BUY SIGNALS IN {section.title}
                  </p>
                  {section.lastScreened && (
                    <p className="text-[11px] text-muted-foreground">
                      Last screened {formatLocalDateTimeLabel(section.lastScreened)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{section.picks.length} signals</span>
                  <span className="rounded-full border border-muted/80 px-3 py-1 uppercase tracking-wider">
                    {section.snapshot?.status ?? "idle"}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-1 divide-y divide-border/70">
                {firstPicks.map((pick) => (
                  <PickItem key={pick.symbol} pick={pick} quote={quotes[pick.symbol]} />
                ))}
              </div>
              {gatedPicks.length > 0 && (
                <div className="mt-1 relative">
                  <div
                    className={`space-y-1 divide-y divide-border/70 border-t border-border/70 pt-1 ${shouldGate ? "pointer-events-none select-none blur-[1.5px] opacity-60" : ""}`}
                  >
                    {gatedPicks.map((pick) => (
                      <PickItem key={pick.symbol} pick={pick} quote={quotes[pick.symbol]} />
                    ))}
                  </div>
                  {shouldGate && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-xs px-6 text-center">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Sign in to explore all signals
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {typeof section.averageChange === "number" ? (
                  <span>Average move {formatPercent(section.averageChange)}</span>
                ) : null}
                {section.snapshot?.metadata?.batchProcessed != null && (
                  <span>Batch {section.snapshot.metadata.batchProcessed} symbols</span>
                )}
                {section.snapshot?.metadata?.lastBatchDurationMs != null && (
                  <span>Last run {(section.snapshot.metadata.lastBatchDurationMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
