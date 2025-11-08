"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

const CATEGORY_LABELS = {
  idx: "BREAKOUT IN IDX 🇮🇩",
  us: "BREAKOUT IN US 🇺🇸",
  crypto: "BREAKOUT IN CRYPTOD",
};

const CATEGORY_ORDER = ["idx", "us", "crypto"];

function SectionHeader({ title }) {
  return (
    <div className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
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
  const formattedPrice = typeof price === "number"
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
      href={`/election-cycle?symbol=${encodeURIComponent(symbol)}&cycle=normal`}
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

export default function SearchPage() {
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
        ? snapshotMap[category].results
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

  if (loading) {
    return (
      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => (
          <div key={category}>
            <SectionHeader title={CATEGORY_LABELS[category]} />
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
            <Loader2 className={`h-6 w-6 text-muted-foreground ${pullDistance > 80 || isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader title="Screening Now" />
        <div className="grid grid-cols-3 gap-2">
          {CATEGORY_ORDER.map((category) => (
            <Button
              key={category}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() => triggerBatch(category)}
              disabled={manualLoading[category]}
            >
              {manualLoading[category] ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                category.toUpperCase()
              )}
            </Button>
          ))}
        </div>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const picks = (snapshots[category]?.results ?? [])
          .map((item) =>
            typeof item === "string"
              ? { symbol: item }
              : item && typeof item.symbol === "string"
                ? item
                : null
          )
          .filter(Boolean);
        return (
          <div key={category}>
            <SectionHeader title={CATEGORY_LABELS[category]} />
            {picks.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No breakout candidates yet. Trigger a batch to refresh this list.
              </p>
            ) : (
              <div className="divide-y">
                {picks.map((pick) => (
                  <PickItem key={pick.symbol} pick={pick} quote={quotes[pick.symbol]} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
