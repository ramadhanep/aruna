"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TrendingUp, AlertTriangle, ArrowUpDown, Check, Lock } from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";
import {
  formatMarketCap,
  formatPrice,
  formatPercent,
} from "@/lib/msci-calculations";
import { TickerAvatar } from "@/components/ticker-avatar";
import { formatTickerDisplay } from "@/lib/utils";

function SegmentControl({ value, onChange, sortBy, onSortChange }) {
  const t = useTranslations("msci");
  return (
    <div className="sticky top-14 z-30 bg-background border-b border-border -mx-4 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1.5 p-1 bg-muted/40 rounded-2xl">
          <Button
            type="button"
            variant="ghost"
            className={`flex-1 rounded-xl text-xs font-semibold transition-all h-9 ${value === "standard"
              ? "bg-foreground text-background"
              : "hover:bg-muted/60"
              }`}
            onClick={() => onChange("standard")}
          >
            {t("msciStandard")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`flex-1 rounded-xl text-xs font-semibold transition-all h-9 ${value === "small_cap"
              ? "bg-foreground text-background"
              : "hover:bg-muted/60"
              }`}
            onClick={() => onChange("small_cap")}
          >
            {t("msciSmallCap")}
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 flex-shrink-0"
              aria-label={t("sortAria")}
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
              {t("sortAlpha")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('market')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'market' ? 'opacity-100' : 'opacity-0'}`}
              />
              {t("sortMarket")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('strong')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'strong' ? 'opacity-100' : 'opacity-0'}`}
              />
              {t("sortStrong")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('borderline')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'borderline' ? 'opacity-100' : 'opacity-0'}`}
              />
              {t("sortBorderline")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange('early')}
              className="text-xs flex items-center gap-2"
            >
              <Check
                className={`h-3 w-3 ${sortBy === 'early' ? 'opacity-100' : 'opacity-0'}`}
              />
              {t("sortEarly")}
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

function StockCard({ stock, isLocked = false }) {
  const t = useTranslations("msci");
  const progressPercent = Math.min(stock.progress, 100);
  return (
    <Card className="overflow-hidden relative">
      <CardContent className={`p-4 space-y-3 ${isLocked ? "opacity-40" : ""}`}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold truncate">{formatTickerDisplay(stock.ticker)}</h3>
              <StatusBadge status={stock.status} />
            </div>
            <p className="text-xs text-muted-foreground truncate">
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
            <p className="text-2xs text-muted-foreground uppercase tracking-wide">{t("price")}</p>
            <p className="text-sm font-semibold">Rp {formatPrice(stock.price)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-2xs text-muted-foreground uppercase tracking-wide">{t("marketCap")}</p>
            <p className="text-sm font-semibold">{formatMarketCap(stock.market_cap)}</p>
          </div>
        </div>

        {/* Free Float */}
        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
          <span className="text-2xs text-muted-foreground">{t("freeFloat")}</span>
          <span className="text-xs font-semibold">{formatPercent(stock.free_float_percent)}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs">
            <span className="text-muted-foreground">{t("progressToMSCI")}</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatPercent(stock.progress)}
            </span>
          </div>
          <div className="h-2 bg-muted/70 rounded-full overflow-hidden">
            <div
              className="h-full w-full rounded-full origin-left transition-transform bg-emerald-600 dark:bg-emerald-400"
              style={{ transform: `scaleX(${progressPercent / 100})` }}
            />
          </div>
        </div>

        {/* Target Price & Upside */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="space-y-0.5">
            <p className="text-2xs text-muted-foreground uppercase tracking-wide">{t("qualificationPrice")}</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Rp {formatPrice(stock.targetPrice)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-2xs text-muted-foreground uppercase tracking-wide">{t("potentialUpside")}</p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatPercent(stock.upside)}
            </p>
          </div>
        </div>
      </CardContent>
      {isLocked && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/90 px-6 text-center pointer-events-none">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground">
            {t("signInToUnlock")}
          </p>
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="skeleton-stagger grid grid-cols-1 lg:grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-lg" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MSCIPage() {
  const t = useTranslations("msci");
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
        setError(err.message || t("fetchError"));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedIndex, t]);

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
    <div className="space-y-4 pb-4 max-w-5xl mx-auto w-full">
      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs leading-relaxed text-foreground/90 font-medium">
            {t("info")}
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
              <p className="text-xs font-semibold text-red-600">{t("loadError")}</p>
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
              {t("empty")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stock Cards List */}
      {!loading && !error && sortedStocks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sortedStocks.map((stock, index) => (
            <StockCard
              key={stock.id}
              stock={stock}
              isLocked={index >= 5 && !isAuthenticated}
            />
          ))}
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-2xs text-center text-muted-foreground pt-4">
          {t("lastUpdated")} {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
