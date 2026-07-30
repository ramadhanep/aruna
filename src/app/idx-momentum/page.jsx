"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { formatMarketCap, formatPercent, formatPrice } from "@/lib/utils";

function SegmentControl({ value, onChange, sortBy, onSortChange }) {
  return (
    <div className="sticky top-14 z-30 bg-background border-b border-border -mx-4 px-4 py-3">
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
                  ? "bg-foreground text-background"
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
  const variantMap = {
    success: "success",
    warning: "warning",
    danger: "danger",
  };
  return (
    <Badge variant={variantMap[status.variant] || "danger"}>
      {status.label}
    </Badge>
  );
}

function SummaryCard({ summary }) {
  const sentimentColor = summary.marketSentiment === 'Bullish'
    ? 'text-emerald-500'
    : summary.marketSentiment === 'Bearish'
      ? 'text-red-500'
      : 'text-yellow-500';

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Market Sentiment */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Market Sentiment</span>
          </div>
          <span className={`text-xs font-bold ${sentimentColor}`}>
            {summary.marketSentiment}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground">Total</p>
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
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-xl">
          <span className="text-xs text-muted-foreground">Avg Momentum Score</span>
          <span className={`text-xs font-bold ${summary.avgMomentum >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {summary.avgMomentum > 0 ? '+' : ''}{summary.avgMomentum}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StockCard({ stock, isLocked = false }) {
  return (
    <Card className="overflow-hidden relative">
      <CardContent className={`p-3 space-y-2 ${isLocked ? "opacity-40" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-xs font-bold truncate">{stock.code}</h3>
              <StatusBadge status={stock.status} />
            </div>
            <p className="text-xs text-muted-foreground truncate">{stock.name}</p>
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Price</p>
            <p className="text-xs font-semibold">Rp {formatPrice(stock.price)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Market Cap</p>
            <p className="text-xs font-semibold">{formatMarketCap(stock.marketCap)}</p>
          </div>
        </div>

        {/* Momentum Score */}
        <div className="flex items-center justify-between p-1.5 bg-muted/50 rounded-xl">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Momentum Score</span>
          </div>
          <span className={`text-xs font-bold ${stock.momentumScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stock.momentumScore > 0 ? '+' : ''}{stock.momentumScore}
          </span>
        </div>

        {/* Price Changes */}
        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">1 Week</p>
            <p className={`text-xs font-semibold flex items-center gap-0.5 ${stock.weekChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stock.weekChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(stock.weekChange, { fractionDigits: 2, fallback: "-", showPositiveSign: true })}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">1 Month</p>
            <p className={`text-xs font-semibold flex items-center gap-0.5 ${stock.monthChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stock.monthChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(stock.monthChange, { fractionDigits: 2, fallback: "-", showPositiveSign: true })}
            </p>
          </div>
        </div>
      </CardContent>
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background/90 px-4 text-center pointer-events-none">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground">Sign in to unlock</p>
        </div>
      )}
    </Card>
  );
}

function MiniStockCard({ stock }) {
  const isPositive = stock.weekChange >= 0;

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-xl min-w-[140px]">
      <TickerAvatar symbol={`${stock.code}.JK`} logo={stock.logo_url} size="xs" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate">{stock.code}</p>
        <p className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPercent(stock.weekChange, { fractionDigits: 2, fallback: "-", showPositiveSign: true })}
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
          <span className="text-xs font-semibold text-muted-foreground">Top Gainers</span>
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
          <span className="text-xs font-semibold text-muted-foreground">Top Losers</span>
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
    <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start space-y-3 lg:space-y-0">
      <div className="lg:col-span-4 flex flex-col gap-4 order-first lg:order-last">
        <Card>
          <CardContent className="p-3 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-[140px] rounded-xl shrink-0" />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-[140px] rounded-xl shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-8 w-full space-y-2">
        <Skeleton className="h-4 w-40 rounded-full" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
    <div className="space-y-3 pb-4 max-w-6xl mx-auto w-full">
      {/* Info Card */}
      <Card>
        <CardContent className="p-3">
          <p className="text-xs leading-relaxed text-foreground/90 font-semibold">
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
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start space-y-3 lg:space-y-0">
          {/* Summary and Top Movers - Sidebar on Desktop */}
          <div className="lg:col-span-4 flex flex-col gap-4 order-first lg:order-last">
            {/* Summary */}
            <SummaryCard summary={data.summary} />

            {/* Top Movers - only show on "all" filter */}
            {filter === "all" && (
              <TopMoversSection
                topGainers={data.topGainers}
                topLosers={data.topLosers}
              />
            )}
          </div>

          {/* Stock Cards - Main Content */}
          <div className="lg:col-span-8 w-full">
            {displayedStocks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground pb-2">
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
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-[9px] text-center text-muted-foreground pt-4">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
