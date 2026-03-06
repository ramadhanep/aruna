"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Zap,
  ArrowUpDown,
  Check,
  Lock
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fetchEncodedJson } from "@/lib/api-client";
import { TickerAvatar } from "@/components/ticker-avatar";

// Color maps for status-based styling
const statusColorMap = {
  success: {
    badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    cardGradient: "from-emerald-500/5 dark:from-emerald-500/10"
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    cardGradient: "from-amber-500/5 dark:from-amber-500/10"
  },
  danger: {
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
    cardGradient: "from-red-500/5 dark:from-red-500/10"
  }
};

function formatMarketCap(value) {
  if (!value) return "-";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString();
}

function formatPrice(value) {
  if (!value) return "-";
  return value.toLocaleString("id-ID");
}

function formatPercent(value) {
  if (value === null || value === undefined) return "-";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function SegmentControl({ value, onChange, sortBy, onSortChange }) {
  return (
    <div className="sticky top-14 z-30 glass border-b border-border/30 -mx-4 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 p-1 bg-muted/40 rounded-2xl min-w-max">
            {[
              { key: "all", label: "All" },
              { key: "bullish", label: "Bullish" },
              { key: "bearish", label: "Bearish" },
              { key: "gainers", label: "Gainers" },
              { key: "losers", label: "Losers" },
            ].map((tab) => (
              <Button
                key={tab.key}
                type="button"
                variant="ghost"
                className={`rounded-xl text-xs font-semibold transition-all px-4 py-2 h-auto ${value === tab.key
                  ? "bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                  : "hover:bg-muted/60"
                  }`}
                onClick={() => onChange(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-0 flex-shrink-0"
              aria-label="Sort stocks"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => onSortChange('momentum')}
              className="text-xs flex items-center gap-2"
            >
              <Check className={`h-3 w-3 ${sortBy === 'momentum' ? 'opacity-100' : 'opacity-0'}`} />
              Momentum Score
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('market')}
              className="text-xs flex items-center gap-2"
            >
              <Check className={`h-3 w-3 ${sortBy === 'market' ? 'opacity-100' : 'opacity-0'}`} />
              Market Cap
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('week')}
              className="text-xs flex items-center gap-2"
            >
              <Check className={`h-3 w-3 ${sortBy === 'week' ? 'opacity-100' : 'opacity-0'}`} />
              Weekly Change
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('month')}
              className="text-xs flex items-center gap-2"
            >
              <Check className={`h-3 w-3 ${sortBy === 'month' ? 'opacity-100' : 'opacity-0'}`} />
              Monthly Change
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${statusColorMap[status.variant]?.badge || statusColorMap.danger.badge
        }`}
    >
      {status.label}
    </span>
  );
}

function SummaryCard({ summary }) {
  const sentimentColor = summary.marketSentiment === 'Bullish'
    ? 'text-emerald-500'
    : summary.marketSentiment === 'Bearish'
      ? 'text-red-500'
      : 'text-yellow-500';

  return (
    <Card className="border-none bg-gradient-to-br from-teal-600/20 to-emerald-800/10 dark:from-teal-900/40 dark:to-emerald-950/40 text-foreground dark:text-white shadow-lg border border-white/[0.08] rounded-2xl">
      <CardContent className="p-3 space-y-3">
        {/* Market Sentiment */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground dark:text-white/70" />
            <span className="text-xs text-muted-foreground dark:text-white/70">Market Sentiment</span>
          </div>
          <span className={`text-xs font-bold ${sentimentColor}`}>
            {summary.marketSentiment}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-black/5 dark:bg-white/5 rounded-xl">
            <p className="text-xs text-muted-foreground dark:text-white/50">Total</p>
            <p className="text-xs font-bold">{summary.totalStocks}</p>
          </div>
          <div className="text-center p-2 bg-emerald-900/20 rounded-xl">
            <p className="text-xs text-emerald-500/70">Bullish</p>
            <p className="text-xs font-bold text-emerald-500">{summary.bullishCount}</p>
          </div>
          <div className="text-center p-2 bg-yellow-900/20 rounded-xl">
            <p className="text-xs text-yellow-500/70">Neutral</p>
            <p className="text-xs font-bold text-yellow-500">{summary.neutralCount}</p>
          </div>
          <div className="text-center p-2 bg-red-900/20 rounded-xl">
            <p className="text-xs text-red-500/70">Bearish</p>
            <p className="text-xs font-bold text-red-500">{summary.bearishCount}</p>
          </div>
        </div>

        {/* Avg Momentum */}
        <div className="flex items-center justify-between p-2 bg-black/5 dark:bg-white/5 rounded-xl">
          <span className="text-xs text-muted-foreground dark:text-white/70">Avg Momentum Score</span>
          <span className={`text-xs font-bold ${summary.avgMomentum >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {summary.avgMomentum > 0 ? '+' : ''}{summary.avgMomentum}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StockCard({ stock, isLocked = false }) {
  const gradientFrom = statusColorMap[stock.status?.variant]?.cardGradient || statusColorMap.danger.cardGradient;

  return (
    <Card className={`bg-gradient-to-br ${gradientFrom} to-transparent border-white/[0.08] dark:border-white/[0.08] text-foreground dark:text-white overflow-hidden relative rounded-2xl shadow-lg`}>
      <CardContent className={`p-3 space-y-2 ${isLocked ? "blur-[2px] opacity-60" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-xs font-bold truncate">{stock.code}</h3>
              <StatusBadge status={stock.status} />
            </div>
            <p className="text-xs text-muted-foreground dark:text-white/70 truncate">{stock.name}</p>
          </div>
          {stock.logo_url && (
            <div className="flex-shrink-0 ml-2">
              <TickerAvatar symbol={`${stock.code}.JK`} logo={stock.logo_url} size="sm" />
            </div>
          )}
        </div>

        {/* Price & Market Cap */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Price</p>
            <p className="text-[11px] font-semibold">Rp {formatPrice(stock.price)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Market Cap</p>
            <p className="text-[11px] font-semibold">{formatMarketCap(stock.marketCap)}</p>
          </div>
        </div>

        {/* Momentum Score */}
        <div className="flex items-center justify-between p-1.5 bg-black/5 dark:bg-white/5 rounded-xl">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-muted-foreground dark:text-white/70" />
            <span className="text-[9px] text-muted-foreground dark:text-white/70">Momentum Score</span>
          </div>
          <span className={`text-[11px] font-bold ${stock.momentumScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stock.momentumScore > 0 ? '+' : ''}{stock.momentumScore}
          </span>
        </div>

        {/* Price Changes */}
        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-black/10 dark:border-white/10">
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">1 Week</p>
            <p className={`text-[11px] font-semibold flex items-center gap-0.5 ${stock.weekChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stock.weekChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(stock.weekChange)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">1 Month</p>
            <p className={`text-[11px] font-semibold flex items-center gap-0.5 ${stock.monthChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stock.monthChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(stock.monthChange)}
            </p>
          </div>
        </div>
      </CardContent>
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/05 backdrop-blur-xs px-4 text-center pointer-events-none">
          <Lock className="h-3.5 w-3.5 text-foreground/90 dark:text-white/90" />
          <p className="text-xs font-semibold text-foreground/90 dark:text-white/90">Sign in to unlock</p>
        </div>
      )}
    </Card>
  );
}

function MiniStockCard({ stock }) {
  const isPositive = stock.weekChange >= 0;

  return (
    <div className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/5 rounded-xl min-w-[140px]">
      <TickerAvatar symbol={`${stock.code}.JK`} logo={stock.logo_url} size="xs" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{stock.code}</p>
        <p className={`text-[9px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPercent(stock.weekChange)}
        </p>
      </div>
    </div>
  );
}

function TopMoversSection({ topGainers, topLosers }) {
  return (
    <div className="space-y-3">
      {/* Top Gainers */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-semibold text-foreground/80 dark:text-white/80">Top Gainers</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {topGainers.slice(0, 5).map((stock) => (
            <MiniStockCard key={stock.code} stock={stock} />
          ))}
        </div>
      </div>

      {/* Top Losers */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          <span className="text-xs font-semibold text-foreground/80 dark:text-white/80">Top Losers</span>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {topLosers.slice(0, 5).map((stock) => (
            <MiniStockCard key={stock.code} stock={stock} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Summary Skeleton */}
      <Card className="border-white/[0.08] dark:border-white/[0.08] rounded-2xl">
        <CardContent className="p-3 space-y-3">
          <Skeleton className="h-4 w-32 bg-black/10 dark:bg-white/10" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg bg-black/10 dark:bg-white/10" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cards Skeleton */}
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-white/[0.08] dark:border-white/[0.08] rounded-2xl">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-2.5 w-24 bg-black/10 dark:bg-white/10" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-8 w-full bg-black/10 dark:bg-white/10" />
              <Skeleton className="h-8 w-full bg-black/10 dark:bg-white/10" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MomentumPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("momentum");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Infinite scroll state
  const [displayedStocks, setDisplayedStocks] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = useRef(null);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEncodedJson(`/api/momentum?filter=${filter}`);
        setData(result.data);

        // Sort stocks
        const sorted = result.data?.stocks ? [...result.data.stocks].sort((a, b) => {
          if (sortBy === 'momentum') return b.momentumScore - a.momentumScore;
          if (sortBy === 'market') return (b.marketCap || 0) - (a.marketCap || 0);
          if (sortBy === 'week') return (b.weekChange || 0) - (a.weekChange || 0);
          if (sortBy === 'month') return (b.monthChange || 0) - (a.monthChange || 0);
          return 0;
        }) : [];

        // Reset pagination and load first page
        setPage(1);
        setDisplayedStocks(sorted.slice(0, ITEMS_PER_PAGE));
        setHasMore(sorted.length > ITEMS_PER_PAGE);
      } catch (err) {
        console.error("Failed to fetch momentum data:", err);
        setError(err.message || "Failed to load momentum data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filter, sortBy]);

  // Load more items
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !data?.stocks) return;

    setLoadingMore(true);

    // Simulate a small delay for smooth UX
    setTimeout(() => {
      const sorted = [...data.stocks].sort((a, b) => {
        if (sortBy === 'momentum') return b.momentumScore - a.momentumScore;
        if (sortBy === 'market') return (b.marketCap || 0) - (a.marketCap || 0);
        if (sortBy === 'week') return (b.weekChange || 0) - (a.weekChange || 0);
        if (sortBy === 'month') return (b.monthChange || 0) - (a.monthChange || 0);
        return 0;
      });

      const nextPage = page + 1;
      const startIndex = 0;
      const endIndex = nextPage * ITEMS_PER_PAGE;

      setDisplayedStocks(sorted.slice(startIndex, endIndex));
      setPage(nextPage);
      setHasMore(endIndex < sorted.length);
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, hasMore, data, page, sortBy]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loadingMore, loadMore]);

  return (
    <div className="space-y-3 pb-4">
      {/* Info Card */}
      <Card className="border-none bg-gradient-to-br from-teal-600/90 to-emerald-800/90 text-white shadow-xl shadow-emerald-900/20 p-3 rounded-2xl">
        <CardContent className="pt-0">
          <p className="text-xs leading-relaxed text-white/90 font-semibold">
            IDX Momentum & Price Trend Analysis
          </p>
        </CardContent>
      </Card>

      {/* Segment Control */}
      <SegmentControl
        value={filter}
        onChange={setFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Error State */}
      {error && (
        <Card className="bg-red-600/10 border-red-600/30">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-600">Failed to load data</p>
              <p className="text-[9px] text-red-600/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !error && <LoadingSkeleton />}

      {/* Data Display */}
      {!loading && !error && data && (
        <div className="space-y-3">
          {/* Summary */}
          <SummaryCard summary={data.summary} />

          {/* Top Movers - only show on "all" filter */}
          {filter === "all" && (
            <TopMoversSection
              topGainers={data.topGainers}
              topLosers={data.topLosers}
            />
          )}

          {/* Stock Cards */}
          {displayedStocks.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Showing {displayedStocks.length} of {data.stocks?.length || 0} stocks
              </p>
              {displayedStocks.map((stock, index) => (
                <StockCard
                  key={stock.code}
                  stock={stock}
                  isLocked={index >= 5 && !isAuthenticated}
                />
              ))}

              {/* Loading More Indicator */}
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-white/50" />
                </div>
              )}

              {/* Intersection Observer Target */}
              {hasMore && !loadingMore && (
                <div ref={observerTarget} className="h-4" />
              )}

              {/* End of List */}
              {!hasMore && displayedStocks.length > ITEMS_PER_PAGE && (
                <p className="text-[9px] text-center text-muted-foreground py-4">
                  No more stocks to load
                </p>
              )}
            </div>
          ) : (
            <Card className="bg-muted/20">
              <CardContent className="p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No stocks found with this filter.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-[9px] text-center text-muted-foreground">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
