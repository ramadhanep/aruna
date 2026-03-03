"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, TrendingUp, AlertTriangle, ArrowUpDown, Check, Lock } from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";
import {
  formatMarketCap,
  formatPrice,
  formatPercent,
} from "@/lib/msci-calculations";
import { TickerAvatar } from "@/components/ticker-avatar";

// Color maps for status-based styling
const statusColorMap = {
  success: {
    badge: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-500 border-emerald-200 dark:border-emerald-900/30",
    cardGradient: "from-emerald-50 dark:from-emerald-950"
  },
  warning: {
    badge: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-900/30",
    cardGradient: "from-yellow-50 dark:from-yellow-950"
  },
  danger: {
    badge: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-900/30",
    cardGradient: "from-red-50 dark:from-red-950"
  }
};

function SegmentControl({ value, onChange, sortBy, onSortChange }) {
  return (
    <div className="sticky top-14 z-30 glass border-b border-border/30 -mx-4 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1.5 p-1 bg-muted/40 rounded-2xl">
          <Button
            type="button"
            variant="ghost"
            className={`flex-1 rounded-xl text-xs font-semibold transition-all h-9 ${value === "standard"
              ? "bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
              : "hover:bg-muted/60"
              }`}
            onClick={() => onChange("standard")}
          >
            MSCI Standard
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`flex-1 rounded-xl text-xs font-semibold transition-all h-9 ${value === "small_cap"
              ? "bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
              : "hover:bg-muted/60"
              }`}
            onClick={() => onChange("small_cap")}
          >
            MSCI Small Cap
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label="Sort stocks"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => onSortChange('alpha')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'alpha' ? 'opacity-100' : 'opacity-0'}`}
              />
              A to Z
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('market')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'market' ? 'opacity-100' : 'opacity-0'}`}
              />
              Market Value
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('strong')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'strong' ? 'opacity-100' : 'opacity-0'}`}
              />
              Strong Candidate
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('borderline')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'borderline' ? 'opacity-100' : 'opacity-0'}`}
              />
              Borderline
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('early')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'early' ? 'opacity-100' : 'opacity-0'}`}
              />
              Early Stage
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColorMap[status.variant]?.badge || statusColorMap.danger.badge
        }`}
    >
      {status.label}
    </span>
  );
}

function StockCard({ stock, isLocked = false }) {
  const progressPercent = Math.min(stock.progress, 100);
  const isNearInclusion = stock.progress >= 90;
  const gradientFrom = statusColorMap[stock.status?.variant]?.cardGradient || statusColorMap.danger.cardGradient;

  return (
    <Card className={`bg-gradient-to-br ${gradientFrom} via-slate-100 to-slate-50 dark:via-[#0f172a] dark:to-[#020617] border-border/20 text-foreground dark:text-white overflow-hidden relative rounded-2xl shadow-xl`}>
      <CardContent className={`p-4 space-y-3 ${isLocked ? "blur-[2px] opacity-60" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold truncate">{stock.ticker.replace('.JK', '')}</h3>
              <StatusBadge status={stock.status} />
            </div>
            <p className="text-[11px] text-muted-foreground dark:text-white/70 truncate">
              {stock.company_name}
            </p>
          </div>
          {stock.logo_url && (
            <div className="flex-shrink-0 ml-2">
              <TickerAvatar symbol={stock.ticker} logo={stock.logo_url} />
            </div>
          )}
        </div>

        {/* Price & Market Cap */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Price</p>
            <p className="text-sm font-semibold">Rp {formatPrice(stock.price)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Market Cap</p>
            <p className="text-sm font-semibold">{formatMarketCap(stock.market_cap)}</p>
          </div>
        </div>

        {/* Free Float */}
        <div className="flex items-center justify-between p-2 bg-black/5 dark:bg-white/5 rounded-lg">
          <span className="text-[10px] text-muted-foreground dark:text-white/70">Free Float</span>
          <span className="text-xs font-semibold">{formatPercent(stock.free_float_percent)}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground dark:text-white/70">Progress to MSCI</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatPercent(stock.progress)}
            </span>
          </div>
          <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isNearInclusion
                ? "bg-gradient-to-r from-emerald-800 to-emerald-900"
                : stock.progress >= 70
                  ? "bg-gradient-to-r from-yellow-800 to-yellow-900"
                  : "bg-gradient-to-r from-red-800 to-red-900"
                }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Target Price & Upside */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/10 dark:border-white/10">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Target Price</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Rp {formatPrice(stock.targetPrice)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wide">Potential Upside</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatPercent(stock.upside)}
            </p>
          </div>
        </div>
      </CardContent>
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/05 backdrop-blur-xs px-6 text-center pointer-events-none">
          <Lock className="h-4 w-4 text-foreground/90 dark:text-white/90" />
          <p className="text-xs font-semibold text-foreground/90 dark:text-white/90">
            Sign in to unlock
          </p>
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-[#0f172a] dark:via-[#111827] dark:to-[#020617] border-border/20">
          <CardContent className="p-4 space-y-3">
            {/* Header with ticker and badge */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 space-y-1">
                <Skeleton className="h-4 w-20 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-3 w-40 bg-black/10 dark:bg-white/10" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            {/* Price & Market Cap */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-4 w-20 bg-black/10 dark:bg-white/10" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-4 w-16 bg-black/10 dark:bg-white/10" />
              </div>
            </div>
            {/* Free Float */}
            <Skeleton className="h-8 w-full rounded-lg bg-black/10 dark:bg-white/10" />
            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-3 w-12 bg-black/10 dark:bg-white/10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10" />
            </div>
            {/* Target Price & Upside */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/10 dark:border-white/10">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-3 w-20 bg-black/10 dark:bg-white/10" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-20 bg-black/10 dark:bg-white/10" />
                <Skeleton className="h-3 w-16 bg-black/10 dark:bg-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MSCIPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [selectedIndex, setSelectedIndex] = useState("standard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('strong');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEncodedJson(`/api/msci?index=${selectedIndex}`);
        setData(result);
      } catch (err) {
        console.error("Failed to fetch MSCI data:", err);
        setError(err.message || "Failed to load MSCI data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedIndex]);

  const filteredStocks = data?.data?.stocks?.filter(
    (s) => s.msci_index === selectedIndex
  ) || [];

  // Sort stocks based on selected sort option
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (sortBy === 'alpha') {
      // A to Z alphabetically by ticker
      const tickerA = a.ticker.replace('.JK', '').toLowerCase();
      const tickerB = b.ticker.replace('.JK', '').toLowerCase();
      return tickerA.localeCompare(tickerB);
    } else if (sortBy === 'market') {
      // Market Value descending
      return (b.market_cap || 0) - (a.market_cap || 0);
    } else if (sortBy === 'strong') {
      // Strong Candidate priority: Strong Candidate > Borderline > Early Stage
      const order = { 'Strong Candidate': 0, 'Borderline': 1, 'Early Stage': 2 };
      const orderA = order[a.status?.label] ?? 999;
      const orderB = order[b.status?.label] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by progress descending
      return (b.progress || 0) - (a.progress || 0);
    } else if (sortBy === 'borderline') {
      // Borderline priority: Borderline > Early Stage > Strong Candidate
      const order = { 'Borderline': 0, 'Early Stage': 1, 'Strong Candidate': 2 };
      const orderA = order[a.status?.label] ?? 999;
      const orderB = order[b.status?.label] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by progress descending
      return (b.progress || 0) - (a.progress || 0);
    } else if (sortBy === 'early') {
      // Early Stage priority: Early Stage > Borderline > Strong Candidate
      const order = { 'Early Stage': 0, 'Borderline': 1, 'Strong Candidate': 2 };
      const orderA = order[a.status?.label] ?? 999;
      const orderB = order[b.status?.label] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      // Secondary sort by progress descending
      return (b.progress || 0) - (a.progress || 0);
    }
    return 0;
  });

  return (
    <div className="space-y-4 pb-4">
      {/* Info Card */}
      <Card className="border-none bg-gradient-to-br from-emerald-950 via-[#0f172a] to-[#020617] text-white shadow-xl p-4 rounded-2xl">
        <CardContent className="pt-0">
          <p className="text-xs leading-relaxed text-white/90 font-medium">
            Indonesian stocks with potential inclusion in the MSCI Global and Small Cap indices, considering key market criteria.
          </p>
        </CardContent>
      </Card>

      {/* Segment Control */}
      <SegmentControl
        value={selectedIndex}
        onChange={setSelectedIndex}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Error State */}
      {error && (
        <Card className="bg-red-600/10 border-red-600/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-600">Failed to load data</p>
              <p className="text-xs text-red-600/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !error && <LoadingSkeleton />}

      {/* Empty State */}
      {!loading && !error && sortedStocks.length === 0 && (
        <Card className="bg-muted/20">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No stocks found for this MSCI index.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stock Cards List */}
      {!loading && !error && sortedStocks.length > 0 && (
        <div className="space-y-3">
          {sortedStocks.map((stock, index) => (
            <StockCard
              key={stock.id}
              stock={stock}
              isLocked={index >= 2 && !isAuthenticated}
            />
          ))}
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-[10px] text-center text-muted-foreground">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
