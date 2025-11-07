"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";

const CATEGORY_LABELS = {
  idx: "Top Picks IDX",
  us: "Top Picks US",
  crypto: "Top Picks Crypto",
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

function PickItem({ pick }) {
  const change = pick?.change ?? 0;
  const changePercent = pick?.changePercent ?? 0;
  const isPositive = change >= 0;
  const color = isPositive ? "text-green-600" : "text-red-600";
  const price = pick?.lastClose ?? 0;
  const formattedPrice = typeof price === "number"
    ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";

  return (
    <Link
      href={`/election-cycle?symbol=${encodeURIComponent(pick.symbol)}`}
      className="flex items-center gap-3 py-3 hover:bg-accent/30 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{pick.symbol}</div>
        <div className="text-xs text-muted-foreground truncate">{pick.name}</div>
      </div>
      <div className={`flex items-center ${Array.isArray(pick.sparkline) ? color : "text-muted-foreground"}`}>
        <MiniChart data={pick.sparkline} isPositive={isPositive} />
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
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);
  const [manualStatus, setManualStatus] = useState({ idx: null, us: null, crypto: null });
  const [manualLoading, setManualLoading] = useState({ idx: false, us: false, crypto: false });

  const loadSnapshots = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("screening_snapshots")
      .select("*")
      .in("category", CATEGORY_ORDER);
    if (error) {
      console.warn("Failed to load screening snapshots", error);
      setLoading(false);
      return;
    }
    const mapped = {};
    data?.forEach((item) => {
      mapped[item.category] = item;
    });
    setSnapshots(mapped);
    setLoading(false);
  }, [supabase]);

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
          setSnapshots((prev) => ({
            ...prev,
            [payload.new.category]: payload.new,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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
        setManualStatus((prev) => ({ ...prev, [category]: message }));
        await loadSnapshots();
      } catch (error) {
        console.warn("Trigger failed", error);
        alert(`${category.toUpperCase()} → error`);
        setManualStatus((prev) => ({ ...prev, [category]: "Error triggering batch" }));
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
            <Loader2 className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader title="Manual screening trigger" />
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
        <div className="space-y-1 text-[11px] text-muted-foreground">
          {CATEGORY_ORDER.map((category) => (
            <p key={category}>
              {category.toUpperCase()}: {manualStatus[category] ?? "Idle"}
            </p>
          ))}
        </div>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const picks = (snapshots[category]?.results ?? []).slice(0, 8);
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
                  <PickItem key={pick.symbol} pick={pick} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
