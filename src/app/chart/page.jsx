"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import {
  CURRENT_LINE_COLOR,
  areWatchlistsEqual,
  formatScreeningTimestamp,
  formatTimestamp,
  cycleMetaMap,
  NORMAL_TIMEFRAME_OPTIONS,
  BASE_INFO_TABS,
  EMA_COLOR,
  LIVERMORE_UPPER_COLOR,
  LIVERMORE_LOWER_COLOR,
  isIdxLotSymbol,
  getDefaultCyclesForSymbol,
  getDayOfYear,
  getQuarterDateRange,
} from '@/lib/chart-helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import dynamic from 'next/dynamic';
const LazyEarningsChart = dynamic(() => import('@/components/recharts/earnings-chart').then((m) => m.EarningsChart), { ssr: false });
const LazyRevenueChart = dynamic(() => import('@/components/recharts/revenue-chart').then((m) => m.RevenueChart), { ssr: false });
const LazySeasonalityChart = dynamic(() => import('@/components/recharts/seasonality-chart').then((m) => m.SeasonalityChart), { ssr: false });
import { Loader2, Sun, MoonStar, Clock3, Fullscreen, ArrowLeft, Settings, CandlestickChart, LineChart, BarChart2 } from "lucide-react";
import { Tooltip as RadixTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTheme } from 'next-themes';
import { AddAssetModal } from "@/components/add-asset-modal";
import { SymbolSearchDialog } from "@/components/header-symbol-search";
import { useAuth } from "@/components/auth-provider";
import { NormalCandlestickChart } from "@/components/normal-candlestick-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartState } from '@/hooks/use-chart-state';
import { useChartData } from '@/hooks/use-chart-data';
import { useChartSeries } from '@/hooks/use-chart-series';
import { useChartFundamentals } from '@/hooks/use-chart-fundamentals';
import { useChartNews } from '@/hooks/use-chart-news';
import { useChartScreening } from '@/hooks/use-chart-screening';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_WATCHLIST, getDefaultWatchlist } from "@/lib/default-watchlist";
import { ArunaWatermark } from "@/components/aruna-watermark";
import { TickerAvatar } from "@/components/ticker-avatar";
import { formatTickerDisplay, getChangeTone, formatPrice, formatPriceTrim } from "@/lib/utils";
import { MOTION } from "@/lib/motion";
import { ChartHeaderBar } from "@/components/chart-header-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { AnalystGaugeChart } from "@/components/analyst-gauge-chart";
import { ChartTradingPlanPanel } from "@/components/chart-trading-plan-panel";
import { ChartSeasonalityPanel } from "@/components/chart-seasonality-panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

const CHART_HEIGHT_CLASS = "h-[380px] lg:h-[500px]";
const SECONDARY_CHART_HEIGHT_CLASS = "h-[260px]";

function ChartMainSkeleton() {
  return (
    <div className="skeleton-stagger flex flex-col gap-2">
      <Card className="bg-transparent border-none rounded-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28 rounded-full" />
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-7 w-36 rounded-lg" />
                <Skeleton className="h-3 w-10 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Skeleton className={`w-full ${CHART_HEIGHT_CLASS} rounded-xl`} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center items-center gap-1 mt-4 lg:mt-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="flex-1 h-7 rounded-full" />
        ))}
      </div>
    </div>
  );
}

function ChartSidebarSkeleton({ hasPortfolioPosition }) {
  return (
    <div className="skeleton-stagger space-y-4 mt-6 lg:mt-0">
      {hasPortfolioPosition && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-32 rounded-full" />
                <Skeleton className="h-6 w-36 rounded-full" />
              </div>
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </CardContent>
        </Card>
      )}
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="flex gap-2 overflow-x-auto hide-scrollbar border-b border-border/30 pb-1">
        {["w-24", "w-12", "w-16", "w-14", "w-16", "w-16"].map((width, idx) => (
          <Skeleton key={`tab-${idx}`} className={`h-7 ${width} rounded-full shrink-0`} />
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, idx) => (
            <Skeleton key={`analysis-${idx}`} className="h-3 rounded-full w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ElectionCyclePageContent() {
  const { resolvedTheme } = useTheme();
  const {
    supabase,
    user,
    remoteWatchlist,
    watchlistLoaded,
    syncWatchlist,
    remotePortfolio,
    portfolioLoaded,
    syncPortfolio,
  } = useAuth();
  const isAuthenticated = Boolean(user);

  const chartState = useChartState();
  const { symbol, setSymbol, selectedCycles, setSelectedCycles, infoTab, setInfoTab, isNormalView, pathname, router } = chartState;
  const { screeningSignal } = useChartScreening(supabase, symbol);
  const {
    normalTimeframe, setNormalTimeframe,
    normalSeriesLoading, normalSeriesError,
    filteredNormalChartData, normalCandlestickSeries,
    normalChartReady, buySignalMarkers,
    isIntradayTimeframe, normalTimeframeLabel,
    scaleChoice, setScaleChoice,
    showLivermoreKey, setShowLivermoreKey,
    chartDisplayType, setChartDisplayType,
    normalFullscreenOpen, setNormalFullscreenOpen,
  } = useChartSeries(symbol, isNormalView, screeningSignal);
  const colors = useMemo(() => {
    const isDark = resolvedTheme === 'dark';
    const base = isDark ? '#F9F9F9F9' : '#333333';
    return {
      trumpYears: base,
      allYears: base,
      preElection: base,
      election: base,
      midTerm: base,
      postElection: base,
      current: CURRENT_LINE_COLOR,
    };
  }, [resolvedTheme]);
  const { loading, error, retry, rawLinesData, symbolInfo, assetName, monthlyHeatmap, quarterlyHeatmap } = useChartData(symbol, selectedCycles, colors.allYears);
  const { fundamentals, fundamentalsLoading, revenuePeriod, setRevenuePeriod } = useChartFundamentals(symbol, infoTab);
  const { news, newsLoading } = useChartNews(symbol, infoTab);

  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [portfolioEntries, setPortfolioEntries] = useState([]);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [watchlist, setWatchlist] = useState(() => getDefaultWatchlist());
  const remoteWatchlistSeedRef = useRef(false);
  const remotePortfolioSeedRef = useRef(false);
  const redirectToSignIn = useCallback(() => {
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : pathname || '/';
    router.push(`/signin?redirect=${encodeURIComponent(currentPath)}`);
  }, [pathname, router]);

  const canUseProtectedActions = isAuthenticated;

  const primaryChartColor = CURRENT_LINE_COLOR;
  const secondaryChartColor = colors.allYears;
  const beatColor = 'rgb(22, 163, 74)'; // tailwind green-600
  const missColor = 'rgb(220, 38, 38)'; // tailwind red-600

  const screeningSignalDateLabel = screeningSignal?.signal_date
    ? formatScreeningTimestamp(screeningSignal.signal_date)
    : null;
  const tradingPlanPayload = screeningSignal?.trading_plan ?? null;
  const lotEligible = useMemo(() => isIdxLotSymbol(symbol), [symbol]);
  const hasTradingPlan = Boolean(tradingPlanPayload);
  const infoTabs = useMemo(() => {
    if (hasTradingPlan) {
      return [{ value: 'trading-plan', label: 'TRADING PLAN' }, ...BASE_INFO_TABS];
    }
    return BASE_INFO_TABS;
  }, [hasTradingPlan]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (!areWatchlistsEqual(DEFAULT_WATCHLIST, watchlist)) {
        setWatchlist(getDefaultWatchlist());
      }
      return;
    }

    if (!watchlistLoaded) {
      return;
    }

    if (Array.isArray(remoteWatchlist)) {
      if (!areWatchlistsEqual(remoteWatchlist, watchlist)) {
        setWatchlist(remoteWatchlist);
      }
      return;
    }

    if (!remoteWatchlistSeedRef.current) {
      remoteWatchlistSeedRef.current = true;
      const defaults = getDefaultWatchlist();
      setWatchlist(defaults);
      syncWatchlist(defaults)
        .catch(() => null)
        .finally(() => {
          remoteWatchlistSeedRef.current = false;
        });
    }
  }, [
    isAuthenticated,
    watchlistLoaded,
    remoteWatchlist,
    watchlist,
    syncWatchlist,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      setPortfolioEntries([]);
      return;
    }

    if (!portfolioLoaded) {
      return;
    }

    if (Array.isArray(remotePortfolio)) {
      setPortfolioEntries(remotePortfolio);
      return;
    }

    if (!remotePortfolioSeedRef.current) {
      remotePortfolioSeedRef.current = true;
      const defaults = [];
      setPortfolioEntries(defaults);
      syncPortfolio(defaults)
        .catch(() => null)
        .finally(() => {
          remotePortfolioSeedRef.current = false;
        });
    }
  }, [
    isAuthenticated,
    portfolioLoaded,
    remotePortfolio,
    syncPortfolio,
  ]);



  const formatTick = (dayOfYear) => {
    const date = new Date(2000, 0, 1);
    date.setDate(date.getDate() + dayOfYear - 1);
    // Tampilkan tanggal detail ketika quarter filter aktif, bulan saja ketika 'all'
    if (quarterFilter === 'all') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }
  };

  const formatTooltip = (value) => {
    if (value == null || isNaN(value)) return '-';
    if (scaleChoice === 'log') {
      // Convert back from multiplier to percentage
      const pct = (value - 1) * 100;
      return `${pct.toFixed(1)}%`;
    }
    return `${value.toFixed(1)}%`;
  };

  const formatYAxis = (value) => {
    if (value == null || isNaN(value)) return '-';
    if (scaleChoice === 'log') {
      // Convert back from multiplier to percentage
      const pct = (value - 1) * 100;
      return `${pct.toFixed(0)}%`;
    }
    return `${value.toFixed(0)}%`;
  };



  const [quarterFilter, setQuarterFilter] = useState('all');



  // Transform raw data berdasarkan scaleChoice (tidak perlu re-fetch)
  const chartData = useMemo(() => {
    if (!rawLinesData || rawLinesData.length === 0) {
      return { chartArray: [], linesData: rawLinesData };
    }

    const mergedData = {};
    rawLinesData.forEach(line => {
      line.data.forEach(point => {
        if (!mergedData[point.dayOfYear]) {
          mergedData[point.dayOfYear] = { dayOfYear: point.dayOfYear };
        }
        // For logarithmic: convert percentage to growth multiplier (e.g., 10% = 1.10)
        // For linear: use percentage directly
        let value;
        if (scaleChoice === 'log') {
          // Convert percentage to multiplier: -10% -> 0.90, 0% -> 1.0, 10% -> 1.10
          value = 1 + (point.pctChangeYtd / 100);
          // Ensure positive values for log scale (minimum 0.01)
          value = Math.max(value, 0.01);
        } else {
          value = point.pctChangeYtd;
        }
        mergedData[point.dayOfYear][line.key] = value;
      });
    });

    const chartArray = Object.values(mergedData).sort((a, b) => a.dayOfYear - b.dayOfYear);
    return { chartArray, linesData: rawLinesData };
  }, [rawLinesData, scaleChoice]);

  const filteredChartData = useMemo(() => {
    if (!chartData.chartArray || chartData.chartArray.length === 0) {
      return [];
    }
    if (quarterFilter === 'all') {
      return chartData.chartArray;
    }
    const [start, end] = getQuarterDateRange(quarterFilter);
    const subset = chartData.chartArray.filter(
      (item) => item.dayOfYear >= start && item.dayOfYear <= end
    );
    if (subset.length === 0) {
      return subset;
    }
    const baselines = {};
    return subset.map((point) => {
      const nextPoint = { dayOfYear: point.dayOfYear };
      Object.entries(point).forEach(([key, value]) => {
        if (key === 'dayOfYear') return;
        if (typeof value !== 'number') {
          nextPoint[key] = value;
          return;
        }
        if (!(key in baselines) || baselines[key] == null) {
          baselines[key] = value;
        }
        const baseline = baselines[key];
        if (scaleChoice === 'log') {
          nextPoint[key] = baseline ? value / baseline : value;
        } else {
          nextPoint[key] = value - baseline;
        }
      });
      return nextPoint;
    });
  }, [chartData.chartArray, quarterFilter, scaleChoice]);

  const portfolioPosition = useMemo(() => {
    if (!symbol || !Array.isArray(portfolioEntries) || portfolioEntries.length === 0) {
      return null;
    }
    const normalizedSymbol = symbol.toUpperCase();
    let totalShares = 0;
    let totalLots = 0;
    let totalCost = 0;

    portfolioEntries.forEach((entry) => {
      if (!entry || typeof entry.symbol !== 'string') return;
      if (entry.symbol.toUpperCase() !== normalizedSymbol) return;
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const effectiveShares = entry.unit === 'lot' ? amount * 100 : amount;
      const avgPrice = Number(entry.avgPrice);
      totalShares += effectiveShares;
      if (entry.unit === 'lot') {
        totalLots += amount;
      }
      if (Number.isFinite(avgPrice)) {
        totalCost += avgPrice * effectiveShares;
      }
    });

    if (totalShares <= 0) {
      return null;
    }

    const fallbackPrice = fundamentals?.price?.current;
    const parsedFallback = fallbackPrice != null ? Number(fallbackPrice) : null;
    const latestPriceCandidate =
      typeof symbolInfo?.currentPrice === 'number'
        ? symbolInfo.currentPrice
        : parsedFallback;
    const latestPrice = Number.isFinite(latestPriceCandidate) ? latestPriceCandidate : null;
    const averagePrice = totalCost > 0 ? totalCost / totalShares : null;
    const marketValue = latestPrice != null ? latestPrice * totalShares : null;
    const pnl = marketValue != null ? marketValue - totalCost : null;
    const pnlPct = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null;

    return {
      totalShares,
      totalLots,
      totalCost,
      averagePrice,
      latestPrice,
      marketValue,
      pnl,
      pnlPct,
    };
  }, [portfolioEntries, symbol, symbolInfo?.currentPrice, fundamentals?.price]);

  const hasPortfolioPosition = Boolean(portfolioPosition);

  const latestNormalPoint =
    filteredNormalChartData.length > 0
      ? filteredNormalChartData[filteredNormalChartData.length - 1]
      : null;

  const displayedPrice =
    isNormalView && typeof latestNormalPoint?.price === 'number'
      ? latestNormalPoint.price
      : symbolInfo?.currentPrice ?? null;

  const displayedChange = useMemo(() => {
    if (symbolInfo?.dailyChange == null || symbolInfo?.dailyChangePct == null) {
      return null;
    }
    return {
      value: symbolInfo.dailyChange,
      pct: symbolInfo.dailyChangePct
    };
  }, [symbolInfo?.dailyChange, symbolInfo?.dailyChangePct]);

  const renderTimeframeButtons = ({ includeFullscreenToggle = false } = {}) => (
    <>
      {NORMAL_TIMEFRAME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={normalTimeframe === option.value ? 'default' : 'ghost'}
          className={`rounded-sm px-2 min-w-[2.1rem] font-bold py-0 text-1xs ${normalTimeframe === option.value
            ? 'bg-emerald-700 text-white/80'
            : 'border-border/20 text-muted-foreground'
            }`}
          onClick={() => setNormalTimeframe(option.value)}
        >
          {option.label}
        </Button>
      ))}
      {renderChartTypeSwitcher()}
      {renderChartSettings()}
      {includeFullscreenToggle ? (
        <RadixTooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 rounded-full border border-border/30 p-0 text-muted-foreground"
              onClick={() => setNormalFullscreenOpen(true)}
              disabled={normalSeriesLoading || !normalChartReady}
              aria-label="Open candlestick fullscreen"
            >
              <Fullscreen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fullscreen {normalTimeframeLabel} candlestick</TooltipContent>
        </RadixTooltip>
      ) : null}
    </>
  );

  const renderChartTypeSwitcher = () => (
    <RadixTooltip>
      <TooltipTrigger asChild>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 rounded-md border border-border/30 px-2 gap-1.5 text-muted-foreground text-1xs font-semibold"
              aria-label="Chart type"
            >
              {chartDisplayType === 'line' ? (
                <LineChart className="h-3.5 w-3.5" />
              ) : chartDisplayType === 'candle' ? (
                <BarChart2 className="h-3.5 w-3.5" />
              ) : (
                <CandlestickChart className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 z-[130]">
        {[
          { key: 'heikinAshi', label: 'Heikin Ashi', icon: CandlestickChart },
          { key: 'candle', label: 'Candlestick', icon: BarChart2 },
          { key: 'line', label: 'Line', icon: LineChart },
        ].map((opt) => {
          const Icon = opt.icon;
          return (
            <DropdownMenuItem
              key={opt.key}
              className="flex items-center gap-2 cursor-pointer"
              onSelect={() => setChartDisplayType(opt.key)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{opt.label}</span>
              {chartDisplayType === opt.key && (
                <svg className="h-3.5 w-3.5 ml-auto text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
      </DropdownMenu>
    </TooltipTrigger>
      <TooltipContent side="bottom">Chart Type</TooltipContent>
    </RadixTooltip>
  );

  const renderChartSettings = () => (
    <RadixTooltip>
      <TooltipTrigger asChild>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 rounded-full border border-border/30 p-0 text-muted-foreground"
          aria-label="Chart settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-[130]">
        <DropdownMenuCheckboxItem
          checked={scaleChoice === 'log'}
          onCheckedChange={() => setScaleChoice(scaleChoice === 'log' ? 'linear' : 'log')}
          className="cursor-pointer"
          onSelect={(e) => e.preventDefault()}
        >
          <span className="text-sm">Logarithmic</span>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={showLivermoreKey}
          onCheckedChange={() => setShowLivermoreKey((prev) => !prev)}
          className="cursor-pointer"
          onSelect={(e) => e.preventDefault()}
        >
          <span className="text-sm">Livermore Key</span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </TooltipTrigger>
      <TooltipContent side="bottom">Chart Settings</TooltipContent>
    </RadixTooltip>
  );


  const hasCycleChartData = chartData.chartArray && chartData.chartArray.length > 0;
  const showChartSection =
    !loading &&
    (isNormalView
      ? filteredNormalChartData.length > 0 || normalSeriesLoading || normalSeriesError
      : hasCycleChartData);

  const formatTooltipDate = (dayOfYear) => {
    const date = new Date(2000, 0, 1);
    date.setDate(date.getDate() + dayOfYear - 1);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const formatNormalTimestamp = useCallback(
    (timestamp) => {
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime())) return '';
      if (normalTimeframe === '15m') {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
      if (normalTimeframe === '1h' || normalTimeframe === '2h' || normalTimeframe === '4h') {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
        });
      }
      if (normalTimeframe === 'M') {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    [normalTimeframe]
  );

  const formatPriceValue = useCallback(
    (value) => formatPriceTrim(value, symbol, { fallback: '-' }),
    [symbol]
  );

  const currencyCode = fundamentals?.profile?.currency || symbolInfo?.currency || 'USD';
  const currencyFractionDigits = useMemo(
    () => (currencyCode === 'IDR' ? 0 : 2),
    [currencyCode]
  );

  const compactNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      }),
    []
  );

  const formatPlainNumber = useCallback((value) => {
    if (value == null || value === '') return '—';
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return formatPrice(numeric, {
        locale: 'en-US',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        zeroIsEmpty: false,
      });
    }
    return String(value);
  }, []);

  const formatDetailedCurrency = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: currencyFractionDigits,
      maximumFractionDigits: currencyFractionDigits,
    });
  }, [currencyFractionDigits]);

  const formatQuantityValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }, []);

  const formatCompactCurrency = useCallback(
    (value) => {
      if (value == null || Number.isNaN(Number(value))) return '—';
      const numeric = Number(value);
      return `${compactNumberFormatter.format(numeric)} ${currencyCode}`;
    },
    [compactNumberFormatter, currencyCode]
  );

  const formatRatio = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(2);
  }, []);

  const formatPercentage = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(1)}%`;
  }, []);

  const quickStats = useMemo(() => {
    if (!fundamentals) return [];
    const valuations = fundamentals.valuations || {};
    const priceInfo = fundamentals.price || {};
    const marketData = fundamentals.marketData || {};
    const currentValue =
      typeof displayedPrice === 'number'
        ? displayedPrice
        : typeof symbolInfo?.currentPrice === 'number'
          ? symbolInfo.currentPrice
          : null;
    const relativeVolume =
      marketData.regularMarketVolume != null && marketData.averageDailyVolume3Month
        ? Number(marketData.regularMarketVolume) / Number(marketData.averageDailyVolume3Month)
        : null;
    const distTo50d =
      currentValue != null && marketData.fiftyDayAverage
        ? ((currentValue - Number(marketData.fiftyDayAverage)) / Number(marketData.fiftyDayAverage)) * 100
        : null;
    const distTo200d =
      currentValue != null && marketData.twoHundredDayAverage
        ? ((currentValue - Number(marketData.twoHundredDayAverage)) / Number(marketData.twoHundredDayAverage)) * 100
        : null;
    const distTo52wHigh =
      currentValue != null && marketData.fiftyTwoWeekHigh
        ? ((currentValue - Number(marketData.fiftyTwoWeekHigh)) / Number(marketData.fiftyTwoWeekHigh)) * 100
        : null;
    const distFrom52wLow =
      currentValue != null && marketData.fiftyTwoWeekLow
        ? ((currentValue - Number(marketData.fiftyTwoWeekLow)) / Number(marketData.fiftyTwoWeekLow)) * 100
        : null;

    const stats = [
      { label: 'Market Cap', value: formatCompactCurrency(valuations.marketCap) },
      { label: 'Enterprise Value', value: formatCompactCurrency(valuations.enterpriseValue) },
      { label: 'P/E (TTM)', value: formatRatio(valuations.trailingPe) },
      { label: 'Forward P/E', value: formatRatio(valuations.forwardPe) },
      { label: 'P/B', value: formatRatio(valuations.priceToBook) },
      { label: 'P/S', value: formatRatio(valuations.priceToSales) },
      { label: 'EV/EBITDA', value: formatRatio(valuations.evToEbitda) },
      { label: 'EV/Revenue', value: formatRatio(valuations.evToRevenue) },
      { label: 'PEG', value: formatRatio(valuations.pegRatio) },
      { label: '52W Range', value: formatPlainNumber(priceInfo.fiftyTwoWeekRange) },
      { label: 'Day Range', value: formatPlainNumber(priceInfo.dayRange) },
      { label: 'Volume', value: formatPlainNumber(priceInfo.volume) },
      { label: 'Avg Volume (3M)', value: formatPlainNumber(marketData.averageDailyVolume3Month) },
      { label: 'Avg Volume (10D)', value: formatPlainNumber(marketData.averageDailyVolume10Day) },
      {
        label: 'Relative Volume',
        value:
          relativeVolume != null && Number.isFinite(relativeVolume)
            ? `${relativeVolume.toFixed(2)}x`
            : '—',
      },
      { label: '50D Average', value: formatPlainNumber(marketData.fiftyDayAverage) },
      { label: '200D Average', value: formatPlainNumber(marketData.twoHundredDayAverage) },
      {
        label: 'Vs 50D',
        value:
          distTo50d != null && Number.isFinite(distTo50d)
            ? `${distTo50d >= 0 ? '+' : ''}${distTo50d.toFixed(2)}%`
            : '—',
      },
      {
        label: 'Vs 200D',
        value:
          distTo200d != null && Number.isFinite(distTo200d)
            ? `${distTo200d >= 0 ? '+' : ''}${distTo200d.toFixed(2)}%`
            : '—',
      },
      {
        label: 'To 52W High',
        value:
          distTo52wHigh != null && Number.isFinite(distTo52wHigh)
            ? `${distTo52wHigh >= 0 ? '+' : ''}${distTo52wHigh.toFixed(2)}%`
            : '—',
      },
      {
        label: 'From 52W Low',
        value:
          distFrom52wLow != null && Number.isFinite(distFrom52wLow)
            ? `${distFrom52wLow >= 0 ? '+' : ''}${distFrom52wLow.toFixed(2)}%`
            : '—',
      },
      { label: 'Previous Close', value: formatPlainNumber(priceInfo.previousClose) },
      { label: 'Open', value: formatPlainNumber(priceInfo.open) },
    ];
    return stats.filter((item) => item.value && item.value !== '—');
  }, [fundamentals, formatCompactCurrency, formatRatio, formatPlainNumber, displayedPrice, symbolInfo?.currentPrice]);

  const currentYtdReturn = useMemo(() => {
    const currentLine = rawLinesData.find((entry) => entry.key === 'current');
    if (!currentLine?.data || currentLine.data.length === 0) return null;
    const sorted = [...currentLine.data].sort((a, b) => a.dayOfYear - b.dayOfYear);
    const todayIndex = getDayOfYear(new Date());
    const uptoToday = sorted.filter((point) => point.dayOfYear <= todayIndex);
    const latestPoint =
      uptoToday.length > 0 ? uptoToday[uptoToday.length - 1] : sorted[sorted.length - 1];
    return latestPoint?.pctChangeYtd ?? null;
  }, [rawLinesData]);

  const cycleSummary = useMemo(() => {
    if (isNormalView || !rawLinesData || rawLinesData.length === 0) return null;
    const primaryCycleKey = selectedCycles.find((key) => key !== 'current') ?? 'all';
    const meta = cycleMetaMap[primaryCycleKey];
    if (!meta) return null;
    const line = rawLinesData.find((entry) => entry.key === meta.lineKey);
    if (!line || !line.data || line.data.length === 0) return null;
    const sorted = [...line.data].sort((a, b) => a.dayOfYear - b.dayOfYear);
    const lastPoint = sorted[sorted.length - 1];
    return {
      label: meta.label,
      cagr: lastPoint?.pctChangeYtd ?? null,
    };
  }, [isNormalView, rawLinesData, selectedCycles]);

  const cycleSummaryStats = useMemo(() => {
    if (isNormalView) return [];
    const entries = [];
    if (cycleSummary?.cagr != null) {
      entries.push({
        label: `${cycleSummary.label} CAGR`,
        value: formatPercentage(cycleSummary.cagr),
      });
    }
    if (currentYtdReturn != null) {
      entries.push({
        label: 'YTD Return',
        value: formatPercentage(currentYtdReturn),
      });
    }
    return entries;
  }, [cycleSummary, currentYtdReturn, formatPercentage, isNormalView]);

  const summaryStats = useMemo(() => {
    if (!cycleSummaryStats.length && !quickStats.length) {
      return [];
    }
    return [...cycleSummaryStats, ...quickStats];
  }, [cycleSummaryStats, quickStats]);

  const recommendationData = useMemo(() => {
    const trend = fundamentals?.recommendations?.trend;
    const details = fundamentals?.recommendations?.details;
    if ((!trend || trend.length === 0) && !details) {
      return null;
    }
    const latest = Array.isArray(trend) && trend.length > 0 ? trend[0] : null;
    const breakdown = latest
      ? [
        { label: 'Strong Buy', value: Number(latest.strongBuy) || 0 },
        { label: 'Buy', value: Number(latest.buy) || 0 },
        { label: 'Hold', value: Number(latest.hold) || 0 },
        { label: 'Sell', value: Number(latest.sell) || 0 },
        { label: 'Strong Sell', value: Number(latest.strongSell) || 0 },
      ]
      : [];
    const totalFromBreakdown = breakdown.reduce((sum, item) => sum + (item.value || 0), 0);
    const totalOpinions =
      Number(details?.numberOfAnalystOpinions) || totalFromBreakdown || null;
    const recommendationKey = details?.recommendationKey || null;
    const ratingLabel = recommendationKey
      ? recommendationKey.replace(/_/g, ' ').toUpperCase()
      : 'N/A';

    const getRecommendationClasses = (key) => {
      switch (key) {
        case 'hold':
          return { bg: 'bg-amber-500/15 text-amber-300', text: 'text-amber-400' };
        case 'sell':
        case 'strong_sell':
        case 'underperform':
          return { bg: 'bg-red-500/15 text-red-300', text: 'text-red-500' };
        case 'buy':
        case 'strong_buy':
          return { bg: 'bg-emerald-500/15 text-emerald-300', text: 'text-emerald-500' };
        default:
          return { bg: 'bg-gray-500/15 text-gray-300', text: 'text-muted-foreground' };
      }
    };

    const ratingClasses = getRecommendationClasses(recommendationKey);
    const ratingBgClass = ratingClasses.bg;
    const ratingTextClass = ratingClasses.text;
    const ratingScore =
      typeof details?.recommendationMean === 'number'
        ? Number(details.recommendationMean)
        : null;
    const priceTargets = details
      ? {
        low: details.targetLowPrice ?? null,
        average: details.targetMeanPrice ?? null,
        median: details.targetMedianPrice ?? null,
        high: details.targetHighPrice ?? null,
      }
      : null;
    return {
      breakdown,
      totalOpinions,
      ratingLabel,
      ratingBgClass,
      ratingTextClass,
      ratingScore,
      priceTargets,
    };
  }, [fundamentals?.recommendations]);

  const analysisCurrency = fundamentals?.analysis?.currency || currencyCode;

  const formatPeriodLabel = useCallback((period) => {
    if (!period) return '';
    const raw = String(period).toUpperCase();
    const compact = raw.replace(/\s+/g, '');
    const flippedQuarterMatch = compact.match(/^(\d)Q(\d{2,4})$/) || compact.match(/^Q(\d)(\d{2,4})$/);
    if (flippedQuarterMatch) {
      const [, quarter, yearGroup] = flippedQuarterMatch;
      const fullYear = yearGroup.length === 2 ? `20${yearGroup}` : yearGroup;
      return `Q${quarter} ${fullYear}`;
    }
    if (/^Q\d/.test(raw) && /FY/.test(raw)) return raw.replace(/\s+/g, ' ').trim();
    if (/FY\d{2,4}/.test(raw)) return raw.replace(/ /g, ' ');
    if (/^\d{4}$/.test(raw)) return `${raw.slice(-2)}`;
    return raw.replace(/(\d{4})/g, ' $1').replace(/\s+/g, ' ').trim();
  }, []);

  const earningsChartData = useMemo(() => {
    const series = fundamentals?.analysis?.earnings?.quarterly;
    if (!series || series.length === 0) return [];
    return series.slice(-8).map((entry) => {
      const actual = entry.actual != null ? Number(entry.actual) : null;
      const estimate = entry.estimate != null ? Number(entry.estimate) : null;
      const surprise = actual != null && estimate != null ? actual - estimate : null;
      return {
        period: entry.period,
        periodLabel: formatPeriodLabel(entry.period),
        actual,
        estimate,
        surprise,
        surprisePercent:
          entry.surprisePercent != null ? Number(entry.surprisePercent) : null,
        outcome: surprise == null ? null : surprise >= 0 ? 'beat' : 'miss',
        outcomeValue: surprise == null ? null : Math.abs(surprise),
        range:
          actual != null && estimate != null
            ? [Math.min(actual, estimate), Math.max(actual, estimate)]
            : null,
      };
    });
  }, [fundamentals, formatPeriodLabel]);

  const revenueChartData = useMemo(() => {
    const series =
      fundamentals?.analysis?.revenue?.[revenuePeriod] ||
      fundamentals?.analysis?.revenue?.quarterly ||
      [];
    if (!series || series.length === 0) return [];
    return series.slice(-8).map((entry) => ({
      period: entry.period,
      periodLabel: formatPeriodLabel(entry.period),
      revenue: entry.revenue != null ? Number(entry.revenue) : null,
      earnings: entry.earnings != null ? Number(entry.earnings) : null,
    }));
  }, [fundamentals, revenuePeriod, formatPeriodLabel]);

  const hasEarningsAnalysis = earningsChartData.length > 0;
  const hasRevenueAnalysis = revenueChartData.length > 0;
  const latestEarningsPoint = hasEarningsAnalysis ? earningsChartData[earningsChartData.length - 1] : null;
  const latestRevenuePoint = hasRevenueAnalysis ? revenueChartData[revenueChartData.length - 1] : null;

  const formatEarningsValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toFixed(2);
  }, []);

  const formatSignedEarnings = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    const sign = numeric >= 0 ? '+' : '-';
    return `${sign}${Math.abs(numeric).toFixed(2)}`;
  }, []);

  const formatRevenueValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    const suffix = analysisCurrency ? ` ${analysisCurrency}` : '';
    return `${compactNumberFormatter.format(numeric)}${suffix}`;
  }, [analysisCurrency, compactNumberFormatter]);

  const formatOutcomeLabel = useCallback(
    (surprise) => {
      if (surprise == null || Number.isNaN(Number(surprise))) return null;
      const numeric = Number(surprise);
      const tone = numeric >= 0 ? 'beat' : 'miss';
      return {
        tone,
        label: `${tone === 'beat' ? 'Beat' : 'Miss'} ${formatSignedEarnings(numeric)}`,
      };
    },
    [formatSignedEarnings]
  );

  const hasAnnualRevenue = (fundamentals?.analysis?.revenue?.annual || []).length > 0;
  const latestEarningsOutcome = useMemo(
    () => formatOutcomeLabel(latestEarningsPoint?.surprise ?? null),
    [latestEarningsPoint, formatOutcomeLabel]
  );

  const renderEarningsTick = useCallback(
    ({ x, y, payload }) => {
      const point = earningsChartData[payload.index];
      if (!point) return null;
      const outcomeInfo = formatOutcomeLabel(point.surprise);
      return (
        <g transform={`translate(${x},${y})`}>
          <text textAnchor="middle" className="fill-muted-foreground text-2xs">
            <tspan x={0} dy="0">
              {point.periodLabel}
            </tspan>
            {outcomeInfo && outcomeInfo.label ? (
              <tspan
                x={0}
                dy="1.4em"
                fill={outcomeInfo.tone === 'beat' ? beatColor : missColor}
                fontWeight="600"
              >
                {outcomeInfo.label}
              </tspan>
            ) : null}
          </text>
        </g>
      );
    },
    [earningsChartData, formatOutcomeLabel, beatColor, missColor]
  );

  const renderEstimateDot = useCallback(({ cx, cy }) => {
    if (cx == null || cy == null) return null;
    return (
      <circle
        key={`estimate-dot-${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r={6}
        fill="hsl(var(--background))"
        stroke={secondaryChartColor}
        strokeWidth={1.5}
      />
    );
  }, [secondaryChartColor]);

  const renderActualDot = useCallback(({ cx, cy }) => {
    if (cx == null || cy == null) return null;
    return <circle key={`actual-dot-${cx}-${cy}`} cx={cx} cy={cy} r={7} fill={primaryChartColor} />;
  }, [primaryChartColor]);

  const earningsTooltipFormatter = useCallback(
    (value, name) => {
      if (value == null || Number.isNaN(Number(value))) return ['—', name];
      const label = name === 'actual' ? 'Actual' : 'Estimate';
      return [formatSignedEarnings(value), label];
    },
    [formatSignedEarnings]
  );

  const revenueTooltipFormatter = useCallback(
    (value, name) => {
      if (value == null || Number.isNaN(Number(value))) return ['—', name];
      const label = name === 'revenue' ? 'Revenue' : 'Earnings';
      return [formatRevenueValue(value), label];
    },
    [formatRevenueValue]
  );

  const marketStateInfo = useMemo(() => {
    const stateRaw = fundamentals?.profile?.marketState;
    if (!stateRaw) {
      if (symbolInfo?.isMarketOpen) {
        return { label: 'Market Open', tone: 'text-emerald-600 dark:text-emerald-400', Icon: Sun };
      }
      return null;
    }
    const state = String(stateRaw).toUpperCase();
    if (state.includes('REGULAR') || state === 'OPEN') {
      return { label: 'Market Open', tone: 'text-emerald-700 dark:text-emerald-700', Icon: Sun };
    }
    if (state.includes('PRE')) {
      return { label: 'Pre-Market', tone: 'text-amber-600', Icon: Clock3 };
    }
    if (state.includes('POST')) {
      return { label: 'Post-Market', tone: 'text-blue-500', Icon: Clock3 };
    }
    return { label: 'Market Closed', tone: 'text-muted-foreground', Icon: MoonStar };
  }, [fundamentals?.profile?.marketState, symbolInfo?.isMarketOpen]);

  const formatMarketState = useCallback((stateRaw) => {
    if (!stateRaw) return null;
    const state = String(stateRaw).toUpperCase();
    if (state.includes('REGULAR') || state === 'OPEN') return 'Market Open';
    if (state.includes('PRE')) return 'Pre-Market';
    if (state.includes('POST')) return 'Post-Market';
    if (state.includes('CLOSED')) return 'Market Closed';
    return stateRaw;
  }, []);

  const formatRecommendationPeriod = useCallback((periodRaw) => {
    if (!periodRaw) return null;
    const match = String(periodRaw).match(/^(-?\d+)m$/);
    if (!match) return periodRaw;
    const months = Number(match[1]);
    if (months === 0) return 'Current Month';
    const abs = Math.abs(months);
    return `${abs} Month${abs > 1 ? 's' : ''} Ago`;
  }, []);

  const formatQuoteType = useCallback((typeRaw) => {
    if (!typeRaw) return null;
    return String(typeRaw)
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, []);

  const MarketStateIcon = marketStateInfo?.Icon;
  const isFavorite = useMemo(
    () => watchlist.some((item) => item.symbol === symbol),
    [watchlist, symbol]
  );

  const toggleFavorite = useCallback(() => {
    if (!canUseProtectedActions) {
      redirectToSignIn();
      return;
    }

    setWatchlist((prev) => {
      const exists = prev.some((item) => item.symbol === symbol);
      let next;
      if (exists) {
        next = prev.filter((item) => item.symbol !== symbol);
      } else {
        const nextOrder =
          prev.length > 0 ? Math.max(...prev.map((item) => Number(item.order) || 0)) + 1 : 1;
        next = [...prev, { symbol, order: nextOrder }];
      }
      syncWatchlist(next).catch(() => { });
      return next;
    });
  }, [redirectToSignIn, symbol, syncWatchlist, canUseProtectedActions]);

  const renderProfileTab = () => {
    if (fundamentalsLoading) {
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Company Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="h-3 w-20 rounded-full" />
                  <div className="h-4 w-24 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    const profileInfo = fundamentals?.profile;
    const extendedProfile = fundamentals?.assetProfile;
    if (!profileInfo && !extendedProfile) {
      return (
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            Company profile unavailable for {symbol}.
          </CardContent>
        </Card>
      );
    }

    const locationParts = [
      extendedProfile?.address1,
      extendedProfile?.city,
      extendedProfile?.state,
      extendedProfile?.country,
    ].filter(Boolean);
    const headquarters = locationParts.join(', ');
    const websiteRaw = extendedProfile?.website;
    const website = websiteRaw
      ? websiteRaw.startsWith('http')
        ? websiteRaw
        : `https://${websiteRaw}`
      : null;
    const officers = Array.isArray(extendedProfile?.companyOfficers)
      ? extendedProfile.companyOfficers.filter((officer) => officer?.name).slice(0, 6)
      : [];
    const governance = fundamentals?.governance;

    const keyFacts = [
      { label: 'Exchange', value: profileInfo?.exchange },
      { label: 'Quote Type', value: formatQuoteType(profileInfo?.quoteType) },
      { label: 'Market State', value: formatMarketState(profileInfo?.marketState) },
      { label: 'Sector', value: extendedProfile?.sector || profileInfo?.sector },
      { label: 'Industry', value: extendedProfile?.industry || profileInfo?.industry },
      { label: 'Country', value: extendedProfile?.country || null },
      { label: 'Phone', value: extendedProfile?.phone || null },
      {
        label: 'Employees',
        value:
          extendedProfile?.fullTimeEmployees != null
            ? Number(extendedProfile.fullTimeEmployees).toLocaleString('en-US')
            : null,
      },
      { label: 'Headquarters', value: headquarters || null },
      {
        label: 'Website',
        value: website ? (
          <a
            href={website}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 hover:underline"
          >
            {websiteRaw}
          </a>
        ) : null,
      },
      {
        label: 'Investor Relations',
        value: extendedProfile?.irWebsite ? (
          <a
            href={extendedProfile.irWebsite}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-600 hover:underline"
          >
            IR Site
          </a>
        ) : null,
      },
    ].filter((item) => item.value);

    return (
      <div className="space-y-4">
        {keyFacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm mb-2">Company Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                {keyFacts.map((fact) => (
                  <div key={fact.label} className="space-y-1">
                    <dt className="text-muted-foreground">{fact.label}</dt>
                    <dd className="text-xs font-medium text-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {extendedProfile?.longBusinessSummary && (
          <Card className="mt-4 pt-4">
            <CardHeader>
              <CardTitle className="text-sm mb-2">Company Background</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                {extendedProfile.longBusinessSummary}
              </p>
            </CardContent>
          </Card>
        )}

        {governance && Object.values(governance).some((value) => value != null) && (
          <Card className="mt-4 pt-4">
            <CardHeader>
              <CardTitle className="text-sm mb-2">Governance Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Overall Risk', value: governance.overallRisk },
                  { label: 'Audit Risk', value: governance.auditRisk },
                  { label: 'Board Risk', value: governance.boardRisk },
                  { label: 'Compensation Risk', value: governance.compensationRisk },
                  { label: 'Shareholder Rights', value: governance.shareHolderRightsRisk },
                ]
                  .filter((item) => item.value != null)
                  .map((item) => {
                    const score = Number(item.value);
                    const pct = Math.min(100, (score / 10) * 100);
                    const color = score <= 3 ? 'bg-emerald-500' : score <= 6 ? 'bg-amber-500' : 'bg-red-500';
                    const textColor = score <= 3 ? 'text-emerald-500' : score <= 6 ? 'text-amber-500' : 'text-red-500';
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className={`font-bold ${textColor}`}>{score} / 10</span>
                        </div>
                        <Progress value={pct} className="h-1.5 bg-muted" indicatorClassName={color} />
                      </div>
                    );
                  })}
                {governance.governanceEpochDate && (
                  <p className="text-2xs text-muted-foreground pt-1">
                    As of {formatTimestamp(Number(governance.governanceEpochDate) * 1000, { dateOnly: true }) ?? '—'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {officers.length > 0 && (
          <Card className="mt-4 pt-4">
            <CardHeader>
              <CardTitle className="text-sm mb-2">Leadership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {officers.map((officer, idx) => (
                <div key={`${officer.name}-${idx}`} className="">
                  <p className="text-xs font-semibold dark:text-white/70 text-black/70">{officer.name}</p>
                  <p className="text-xs text-muted-foreground">{officer.title || 'Executive'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderNewsTab = () => {
    if (newsLoading) {
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm mb-2">News</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <Skeleton className="h-3 w-32 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!news || news.length === 0) {
      return (
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            No news available for {symbol}.
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {news.slice(0, 10).map((item, idx) => {
          const title = item.title || '—';
          const publisher = item.publisher || '—';
          const time = item.providerPublishTime ? new Date(item.providerPublishTime).toLocaleDateString('en-US') : '—';
          const link = item.link || '#';

          return (
            <Card
              key={idx}
              className="hover:cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => window.open(link, '_blank')}
              style={{ cursor: 'pointer' }}
            >
              <CardHeader className="flex flex-col gap-1 px-1">
                <CardTitle className="text-xs font-medium text-foreground truncate">{title}</CardTitle>
                <CardDescription className="text-[0.85rem] text-muted-foreground truncate">
                  {publisher} • {time}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                <p className="text-[0.75rem] text-muted-foreground line-clamp-2">
                  {item.description || ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderKeyStatsTab = () => {
    if (fundamentalsLoading) {
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm mb-2">Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid gap-2 grid-cols-1">
            {[...Array(2)].map((_, idx) => (
              <Card key={idx} className="h-full">
                <CardHeader>
                  <Skeleton className="h-4 w-32 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[220px] rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    const marketData = fundamentals?.marketData || null;
    const spread =
      marketData?.bid != null && marketData?.ask != null
        ? Number(marketData.ask) - Number(marketData.bid)
        : null;
    const spreadPct =
      spread != null && displayedPrice != null && Number(displayedPrice) !== 0
        ? (spread / Number(displayedPrice)) * 100
        : null;
    const snapshotRows = marketData
      ? [
        { label: 'Market State', value: formatMarketState(marketData.marketState) },
        { label: 'Quote Source', value: marketData.quoteSourceName || null },
        { label: 'Bid', value: formatPlainNumber(marketData.bid) },
        { label: 'Ask', value: formatPlainNumber(marketData.ask) },
        { label: 'Bid Size', value: formatQuantityValue(marketData.bidSize) },
        { label: 'Ask Size', value: formatQuantityValue(marketData.askSize) },
        {
          label: 'Spread',
          value:
            spread != null && Number.isFinite(spread)
              ? `${formatPlainNumber(spread)}${spreadPct != null ? ` (${spreadPct.toFixed(3)}%)` : ''}`
              : null,
        },
        { label: 'Timezone', value: marketData.exchangeTimezoneName?.replace(/_/g, ' ') || null },
        { label: 'Regular Session', value: formatTimestamp(marketData.regularMarketTime) || null },
        { label: 'Pre-Market', value: formatTimestamp(marketData.preMarketTime) || null },
        { label: 'Post-Market', value: formatTimestamp(marketData.postMarketTime) || null },
        { label: 'Analyst Summary', value: marketData.averageAnalystRating || null },
      ].filter((item) => item.value && item.value !== '—')
      : [];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm mb-2">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryStats.length > 0 ? (
              <dl className="grid grid-cols-2 gap-3">
                {summaryStats.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="text-xs font-medium">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                Summary data unavailable for {symbol}.
              </p>
            )}
          </CardContent>
        </Card>

        {snapshotRows.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-sm mb-2">Trading Snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {snapshotRows.map((item) => (
                    <TableRow key={item.label}>
                      <TableCell className="py-2 text-xs text-muted-foreground">{item.label}</TableCell>
                      <TableCell className="py-2 text-xs font-semibold text-right text-foreground">{item.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {(hasEarningsAnalysis || hasRevenueAnalysis) ? (
          <div className="grid gap-2 grid-cols-1">
            {hasEarningsAnalysis && latestEarningsPoint && (
              <div className="relative">
                <Card className="h-full mt-4">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-sm mb-4">Earnings Results</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {latestEarningsPoint.periodLabel}
                          </span>{' '}
                          • Estimate{' '}
                          <span className="font-medium text-muted-foreground">
                            {formatSignedEarnings(latestEarningsPoint.estimate)}
                          </span>{' '}
                          • Actual{' '}
                          <span className="font-medium text-emerald-700">
                            {formatSignedEarnings(latestEarningsPoint.actual)}
                          </span>
                        </p>
                        {latestEarningsOutcome ? (
                          <p
                            className={`text-xs font-semibold ${latestEarningsOutcome.tone === 'beat'
                              ? 'text-emerald-700'
                              : 'text-red-600'
                              }`}
                          >
                            {latestEarningsOutcome.label}
                          </p>
                        ) : null}
                      </div>
                      <Badge className="px-3 py-1 uppercase tracking-wide">
                        Normalized
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className={SECONDARY_CHART_HEIGHT_CLASS}>
                    <LazyEarningsChart
                      data={earningsChartData}
                      secondaryColor={secondaryChartColor}
                      formatEarningsValue={formatEarningsValue}
                      renderEarningsTick={renderEarningsTick}
                      renderEstimateDot={renderEstimateDot}
                      renderActualDot={renderActualDot}
                      earningsTooltipFormatter={earningsTooltipFormatter}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {hasRevenueAnalysis && (
              <div className="relative">
                <Card className="h-full">
                  <CardHeader className="gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <CardTitle className="text-sm mb-4">Revenue vs Earnings</CardTitle>
                        {latestRevenuePoint && (
                          <p className="text-xs text-muted-foreground">
                            <span style={{ color: primaryChartColor }}>
                              Revenue {formatRevenueValue(latestRevenuePoint.revenue)}
                            </span>{' '}
                            •{' '}
                            <span style={{ color: secondaryChartColor }}>
                              Earnings {formatRevenueValue(latestRevenuePoint.earnings)}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
                        <SegmentedControl
                          value={revenuePeriod}
                          onValueChange={setRevenuePeriod}
                          variant="ghost"
                          className="px-2 py-1 text-xs rounded-full"
                          activeClassName="bg-foreground text-background hover:bg-foreground/90 dark:hover:bg-foreground/90 shadow-sm"
                          inactiveClassName="text-foreground hover:bg-accent hover:text-accent-foreground"
                          options={[
                            { value: 'annual', label: 'Annual', disabled: !hasAnnualRevenue },
                            { value: 'quarterly', label: 'Quarterly' },
                          ]}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={SECONDARY_CHART_HEIGHT_CLASS}>
                    <LazyRevenueChart
                      data={revenueChartData}
                      primaryColor={primaryChartColor}
                      secondaryColor={secondaryChartColor}
                      analysisCurrency={analysisCurrency}
                      compactNumberFormatter={compactNumberFormatter}
                      revenueTooltipFormatter={revenueTooltipFormatter}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="text-xs text-muted-foreground">
              Earnings and revenue analysis unavailable.
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderAnalysisTab = () => {
    if (fundamentalsLoading) {
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analyst Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="space-y-2">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-3 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!recommendationData && revenueChartData.length === 0) {
      return (
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            Analyst insights unavailable for {symbol}.
          </CardContent>
        </Card>
      );
    }

    const { breakdown = [], totalOpinions, ratingLabel, ratingTextClass, ratingScore, priceTargets } =
      recommendationData ?? {};
    const currentPrice = displayedPrice ?? symbolInfo?.currentPrice ?? null;
    const hasBreakdown = breakdown.some((item) => item.value);
    const lowTarget = priceTargets?.low ?? null;
    const highTarget = priceTargets?.high ?? null;
    const averageTarget = priceTargets?.average ?? priceTargets?.median ?? null;
    const minRange = [lowTarget, currentPrice, averageTarget, highTarget]
      .filter((value) => typeof value === 'number' && Number.isFinite(value))
      .sort((a, b) => a - b);
    const minValue = minRange[0] ?? null;
    const maxValue = minRange[minRange.length - 1] ?? null;
    const span = maxValue != null && minValue != null ? maxValue - minValue || 1 : 1;
    const getPosition = (value) => {
      if (value == null || minValue == null) return '0%';
      return `${Math.min(100, Math.max(0, ((value - minValue) / span) * 100))}%`;
    };

    const recommendationTrend = Array.isArray(fundamentals?.recommendations?.trend)
      ? fundamentals.recommendations.trend
      : [];
    const marketData = fundamentals?.marketData || null;
    const consensusColumns = revenueChartData.slice(-4);
    const consensusRows = [
      {
        label: `Revenue${analysisCurrency ? ` (${analysisCurrency})` : ''}`,
        values: consensusColumns.map((entry) =>
          entry?.revenue != null ? formatRevenueValue(entry.revenue) : '—'
        ),
      },
      {
        label: `Earnings${analysisCurrency ? ` (${analysisCurrency})` : ''}`,
        values: consensusColumns.map((entry) =>
          entry?.earnings != null ? formatRevenueValue(entry.earnings) : '—'
        ),
      },
    ].filter((row) => row.values.some((value) => value !== '—'));

    return (
      <div className="space-y-4">
        {recommendationData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Analyst Rating</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Based on {totalOpinions || 0} analysts in the past 3 months
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Semicircle gauge */}
              <AnalystGaugeChart score={ratingScore} />

              {/* Rating label below gauge */}
              <div className="text-center -mt-2">
                <p className={`text-base font-bold tracking-wide ${ratingTextClass || 'text-foreground'}`}>
                  {ratingLabel || 'N/A'}
                </p>
              </div>

              {/* Breakdown bars */}
              {hasBreakdown && (
                <div className="space-y-2 pt-1">
                  {breakdown.map((item) => {
                    const percent = totalOpinions
                      ? Math.round((item.value / totalOpinions) * 100)
                      : 0;
                    const barColor =
                      item.label === 'Strong Buy' ? 'bg-emerald-600'
                        : item.label === 'Buy' ? 'bg-emerald-500/80'
                          : item.label === 'Hold' ? 'bg-amber-500'
                            : item.label === 'Sell' ? 'bg-red-500/80'
                              : 'bg-red-600';
                    return (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="w-20 text-right text-xs text-muted-foreground shrink-0">{item.label}</span>
                        <Progress
                          value={Math.min(100, percent)}
                          className="flex-1 h-2.5 bg-muted"
                          indicatorClassName={barColor}
                        />
                        <span className="w-8 text-xs tabular-nums text-muted-foreground">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {priceTargets && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Price Target</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Analyst price forecast for {symbol}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-xs">
              {/* Price target summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-red-500/8 p-3 text-center">
                  <p className="text-2xs font-semibold text-red-500 uppercase tracking-wider">Low</p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {lowTarget != null ? formatDetailedCurrency(lowTarget) : '—'}
                  </p>
                  {lowTarget != null && currentPrice != null && (
                    <p className={`text-2xs mt-0.5 font-medium ${lowTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
                      {lowTarget >= currentPrice ? '+' : ''}{(((lowTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-500/8 p-3 text-center ring-1 ring-emerald-500/20">
                  <p className="text-2xs font-semibold text-emerald-600 uppercase tracking-wider">Average</p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {averageTarget != null ? formatDetailedCurrency(averageTarget) : '—'}
                  </p>
                  {averageTarget != null && currentPrice != null && (
                    <p className={`text-2xs mt-0.5 font-medium ${averageTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
                      {averageTarget >= currentPrice ? '+' : ''}{(((averageTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-500/8 p-3 text-center">
                  <p className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">High</p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {highTarget != null ? formatDetailedCurrency(highTarget) : '—'}
                  </p>
                  {highTarget != null && currentPrice != null && (
                    <p className={`text-2xs mt-0.5 font-medium ${highTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
                      {highTarget >= currentPrice ? '+' : ''}{(((highTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>

              {/* Visual price range bar */}
              <div className="space-y-2">
                <div className="relative h-3 rounded-full bg-muted mx-2">
                  {/* Filled range from low to high */}
                  {lowTarget != null && highTarget != null && (
                    <div
                      className="absolute top-0 h-full rounded-full bg-foreground/20"
                      style={{
                        left: getPosition(lowTarget),
                        width: `calc(${getPosition(highTarget)} - ${getPosition(lowTarget)})`,
                      }}
                    />
                  )}
                  {/* Current price marker */}
                  {currentPrice != null && (
                    <div
                      className="absolute -top-0.5 flex flex-col items-center"
                      style={{ left: getPosition(currentPrice) }}
                    >
                      <div className="w-0.5 h-4 bg-foreground rounded-full -translate-x-1/2" />
                    </div>
                  )}
                  {/* Average target marker */}
                  {averageTarget != null && (
                    <div
                      className="absolute -top-0.5 flex flex-col items-center"
                      style={{ left: getPosition(averageTarget) }}
                    >
                      <div className="w-2 h-4 rounded-full bg-emerald-600 -translate-x-1/2 border-2 border-background" />
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-2xs text-muted-foreground px-2">
                  <span>Current: {currentPrice != null ? `${formatDetailedCurrency(currentPrice)} ${currencyCode}` : '—'}</span>
                  <span>Target: {averageTarget != null ? `${formatDetailedCurrency(averageTarget)} ${currencyCode}` : '—'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {consensusRows.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Consensus Estimates</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Revenue and earnings projections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {consensusRows.map((row) => (
                <div key={row.label} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{row.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {consensusColumns.map((entry, idx) => (
                      <div key={`${row.label}-${idx}`} className="rounded-xl bg-muted/40 p-2.5 text-center">
                        <p className="text-2xs text-muted-foreground font-medium">{entry.periodLabel}</p>
                        <p className="text-xs font-bold text-foreground mt-1">{row.values[idx]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {recommendationTrend.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recommendation Trend History</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Monthly shift in analyst stance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recommendationTrend.map((entry, idx) => {
                const sb = Number(entry.strongBuy || 0);
                const b = Number(entry.buy || 0);
                const h = Number(entry.hold || 0);
                const s = Number(entry.sell || 0);
                const ss = Number(entry.strongSell || 0);
                const totals = sb + b + h + s + ss;
                const pct = (v) => totals > 0 ? `${((v / totals) * 100).toFixed(0)}%` : '0%';
                const bars = [
                  { value: sb, color: 'bg-emerald-600', label: 'SB' },
                  { value: b, color: 'bg-emerald-500/70', label: 'B' },
                  { value: h, color: 'bg-amber-500', label: 'H' },
                  { value: s, color: 'bg-red-500/70', label: 'S' },
                  { value: ss, color: 'bg-red-600', label: 'SS' },
                ];
                return (
                  <div key={`rec-trend-${idx}`} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {formatRecommendationPeriod(entry.period) || formatRecommendationPeriod(`-${idx}m`)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{totals} analysts</span>
                    </div>
                    {/* Stacked horizontal bar */}
                    <div className="flex h-3 rounded-full overflow-hidden gap-px">
                      {bars.map(({ value, color }) =>
                        value > 0 ? (
                          <div
                            key={color}
                            className={`${color} transition-all`}
                            style={{ width: pct(value) }}
                            title={`${value}`}
                          />
                        ) : null
                      )}
                    </div>
                    {/* Count row */}
                    <div className="flex justify-between text-3xs text-muted-foreground px-0.5">
                      {bars.map(({ value, label }) => (
                        <span key={label} className="tabular-nums">{label}: {value}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {marketData && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Earnings Event Window</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Upcoming earnings and call schedule from Yahoo feed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'Earnings Timestamp', value: formatTimestamp(marketData.earningsTimestamp) },
                  { label: 'Earnings Start', value: formatTimestamp(marketData.earningsTimestampStart) },
                  { label: 'Earnings End', value: formatTimestamp(marketData.earningsTimestampEnd) },
                  { label: 'Call Start', value: formatTimestamp(marketData.earningsCallTimestampStart) },
                  { label: 'Call End', value: formatTimestamp(marketData.earningsCallTimestampEnd) },
                  { label: 'Date Estimate', value: marketData.isEarningsDateEstimate == null ? null : (marketData.isEarningsDateEstimate ? 'Estimated' : 'Confirmed') },
                ]
                  .filter((item) => item.value != null && item.value !== '')
                  .map((item) => (
                    <div key={item.label} className="space-y-0.5">
                      <dt className="text-muted-foreground">{item.label}</dt>
                      <dd className="font-semibold text-foreground">{item.value}</dd>
                    </div>
                  ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderFinancialsTab = () => {
    if (fundamentalsLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-32 rounded-full" />
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const fh = fundamentals?.financialHealth;
    const kse = fundamentals?.keyStatsExtras;
    const div = fundamentals?.dividendInfo;
    const cal = fundamentals?.calendarData;
    const upgrades = fundamentals?.upgrades;
    const marketData = fundamentals?.marketData;

    const hasFinancialHealth = fh && Object.values(fh).some(v => v != null);
    const hasKeyStats = kse && Object.values(kse).some(v => v != null);
    const hasDividends = div && (div.dividendRate != null || div.dividendYield != null);
    const hasCalendar = cal && (cal.earningsDate?.length > 0 || cal.exDividendDate || cal.dividendDate);
    const hasUpgrades = upgrades && upgrades.length > 0;
    const hasOwnershipShort = kse && (
      kse.sharesShortPriorMonth != null ||
      kse.sharesShortPreviousMonthDate != null ||
      kse.sharesPercentSharesOut != null ||
      kse.shortPercentOfFloat != null ||
      kse.impliedSharesOutstanding != null
    );
    const hasFiscalMarkers = kse && (
      kse.lastFiscalYearEnd != null ||
      kse.nextFiscalYearEnd != null ||
      kse.mostRecentQuarter != null
    );

    if (!hasFinancialHealth && !hasKeyStats && !hasDividends && !hasCalendar && !hasUpgrades && !hasOwnershipShort && !hasFiscalMarkers) {
      return (
        <Card>
          <CardContent className="text-xs text-muted-foreground py-6">
            Financial details unavailable for {symbol}.
          </CardContent>
        </Card>
      );
    }

    const formatPct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : '—';
    const formatNum = (v) => {
      if (v == null) return '—';
      if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
      if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
      if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
      if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
      return typeof v === 'number' ? v.toFixed(2) : String(v);
    };
    const formatDate = (v) => formatTimestamp(v, { dateOnly: true }) ?? '—';

    return (
      <div className="space-y-4">
        {/* Upcoming Events */}
        {hasCalendar && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {cal.earningsDate?.length > 0 && (
                    <TableRow>
                      <TableCell className="py-2 text-xs text-muted-foreground">Next Earnings</TableCell>
                      <TableCell className="py-2 text-xs font-medium text-right">{formatDate(cal.earningsDate[0])}</TableCell>
                    </TableRow>
                  )}
                  {cal.exDividendDate && (
                    <TableRow>
                      <TableCell className="py-2 text-xs text-muted-foreground">Ex-Dividend Date</TableCell>
                      <TableCell className="py-2 text-xs font-medium text-right">{formatDate(cal.exDividendDate)}</TableCell>
                    </TableRow>
                  )}
                  {cal.dividendDate && (
                    <TableRow>
                      <TableCell className="py-2 text-xs text-muted-foreground">Dividend Pay Date</TableCell>
                      <TableCell className="py-2 text-xs font-medium text-right">{formatDate(cal.dividendDate)}</TableCell>
                    </TableRow>
                  )}
                  {marketData?.earningsCallTimestampStart && (
                    <TableRow>
                      <TableCell className="py-2 text-xs text-muted-foreground">Earnings Call</TableCell>
                      <TableCell className="py-2 text-xs font-medium text-right">{formatTimestamp(marketData.earningsCallTimestampStart) ?? '—'}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Financial Health */}
        {hasFinancialHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Financial Health</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {[
                    { label: 'Total Revenue', value: formatNum(fh.totalRevenue) },
                    {
                      label: 'Free Cash Flow',
                      value: formatNum(fh.freeCashflow),
                      highlight: fh.freeCashflow != null ? (fh.freeCashflow >= 0 ? 'pos' : 'neg') : null,
                    },
                    { label: 'Total Cash', value: formatNum(fh.totalCash) },
                    {
                      label: 'Total Debt',
                      value: formatNum(fh.totalDebt),
                      highlight: fh.totalDebt != null && fh.totalCash != null
                        ? (fh.totalDebt < fh.totalCash ? 'pos' : 'neg')
                        : null,
                    },
                    {
                      label: 'Debt / Equity',
                      value: fh.debtToEquity != null ? fh.debtToEquity.toFixed(2) : '—',
                      highlight: fh.debtToEquity != null ? (fh.debtToEquity < 100 ? 'pos' : 'neg') : null,
                    },
                    {
                      label: 'Current Ratio',
                      value: fh.currentRatio != null ? fh.currentRatio.toFixed(2) : '—',
                      highlight: fh.currentRatio != null ? (fh.currentRatio >= 1 ? 'pos' : 'neg') : null,
                    },
                    {
                      label: 'Quick Ratio',
                      value: fh.quickRatio != null ? fh.quickRatio.toFixed(2) : '—',
                      highlight: fh.quickRatio != null ? (fh.quickRatio >= 1 ? 'pos' : 'neg') : null,
                    },
                    { label: 'Revenue / Share', value: fh.revenuePerShare != null ? fh.revenuePerShare.toFixed(2) : '—' },
                  ].filter(item => item.value !== '—').map((item) => (
                    <TableRow key={item.label}>
                      <TableCell className="py-2 text-1xs text-muted-foreground">{item.label}</TableCell>
                      <TableCell className={`py-2 text-xs font-semibold text-right ${item.highlight === 'pos' ? 'text-emerald-500' : item.highlight === 'neg' ? 'text-red-500' : ''}`}>
                        {item.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Margins & Growth */}
        {hasFinancialHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Margins & Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Gross Margin', value: fh.grossMargins, color: 'bg-emerald-500' },
                  { label: 'Operating Margin', value: fh.operatingMargins, color: 'bg-sky-500' },
                  { label: 'Profit Margin', value: fh.profitMargins, color: 'bg-violet-500' },
                  { label: 'EBITDA Margin', value: fh.ebitdaMargins, color: 'bg-amber-500' },
                ].filter(item => item.value != null).map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{formatPct(item.value)}</span>
                    </div>
                    <Progress
                      value={Math.min(100, Math.max(0, (item.value || 0) * 100))}
                      className="h-1.5 bg-muted"
                      indicatorClassName={item.color}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20">
                  {[
                    { label: 'ROE', value: fh.returnOnEquity },
                    { label: 'ROA', value: fh.returnOnAssets },
                    { label: 'Revenue Growth', value: fh.revenueGrowth },
                    { label: 'Earnings Growth', value: fh.earningsGrowth },
                  ].filter(item => item.value != null).map((item) => (
                    <div key={item.label} className="space-y-0.5">
                      <dt className="text-1xs text-muted-foreground">{item.label}</dt>
                      <dd className={`text-xs font-semibold ${getChangeTone(item.value)}`}>
                        {formatPct(item.value)}
                      </dd>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dividends */}
        {hasDividends && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dividend Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {[
                  { label: 'Dividend Rate', value: div.dividendRate != null ? `${currencyCode} ${div.dividendRate.toFixed(2)}` : null },
                  { label: 'Dividend Yield', value: div.dividendYield != null ? formatPct(div.dividendYield) : null },
                  { label: 'Payout Ratio', value: div.payoutRatio != null ? formatPct(div.payoutRatio) : null },
                  { label: '5Y Avg Yield', value: div.fiveYearAvgDividendYield != null ? `${div.fiveYearAvgDividendYield.toFixed(2)}%` : null },
                  { label: 'Ex-Dividend', value: div.exDividendDate ? formatDate(div.exDividendDate) : null },
                ].filter(item => item.value != null).map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <dt className="text-1xs text-muted-foreground">{item.label}</dt>
                    <dd className="text-xs font-semibold">{item.value}</dd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Stats Extras */}
        {hasKeyStats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Key Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {[
                  { label: 'Beta', value: kse.beta != null ? kse.beta.toFixed(3) : null },
                  { label: 'Book Value', value: kse.bookValue != null ? kse.bookValue.toFixed(2) : null },
                  { label: 'EPS (TTM)', value: kse.trailingEps != null ? kse.trailingEps.toFixed(2) : null },
                  { label: 'EPS (Fwd)', value: kse.forwardEps != null ? kse.forwardEps.toFixed(2) : null },
                  { label: 'Earnings Growth (Q)', value: kse.earningsQuarterlyGrowth != null ? formatPct(kse.earningsQuarterlyGrowth) : null },
                  { label: '52-Week Change', value: kse.fiftyTwoWeekChange != null ? formatPct(kse.fiftyTwoWeekChange) : null },
                  { label: 'Shares Outstanding', value: kse.sharesOutstanding != null ? formatNum(kse.sharesOutstanding) : null },
                  { label: 'Float', value: kse.floatShares != null ? formatNum(kse.floatShares) : null },
                  { label: 'Implied Shares Out', value: kse.impliedSharesOutstanding != null ? formatNum(kse.impliedSharesOutstanding) : null },
                  { label: 'Short Ratio', value: kse.shortRatio != null ? kse.shortRatio.toFixed(2) : null },
                  { label: 'Shares Short', value: kse.sharesShort != null ? formatNum(kse.sharesShort) : null },
                  { label: 'Shares Short (Prev)', value: kse.sharesShortPriorMonth != null ? formatNum(kse.sharesShortPriorMonth) : null },
                  { label: 'Short % Float', value: kse.shortPercentOfFloat != null ? formatPct(kse.shortPercentOfFloat) : null },
                  { label: 'Short % Shares Out', value: kse.sharesPercentSharesOut != null ? formatPct(kse.sharesPercentSharesOut) : null },
                  { label: '% Held by Insiders', value: kse.heldPercentInsiders != null ? formatPct(kse.heldPercentInsiders) : null },
                  { label: '% Held by Institutions', value: kse.heldPercentInstitutions != null ? formatPct(kse.heldPercentInstitutions) : null },
                  { label: 'Last Split', value: kse.lastSplitFactor || null },
                ].filter(item => item.value != null).map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <dt className="text-1xs text-muted-foreground">{item.label}</dt>
                    <dd className="text-xs font-semibold">{item.value}</dd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasOwnershipShort && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ownership & Short Interest</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {[
                  { label: 'Shares Short (Current)', value: kse.sharesShort != null ? formatNum(kse.sharesShort) : null },
                  { label: 'Shares Short (Prev)', value: kse.sharesShortPriorMonth != null ? formatNum(kse.sharesShortPriorMonth) : null },
                  { label: 'Short % Float', value: kse.shortPercentOfFloat != null ? formatPct(kse.shortPercentOfFloat) : null },
                  { label: 'Short % Shares Out', value: kse.sharesPercentSharesOut != null ? formatPct(kse.sharesPercentSharesOut) : null },
                  { label: 'Insider Ownership', value: kse.heldPercentInsiders != null ? formatPct(kse.heldPercentInsiders) : null },
                  { label: 'Institution Ownership', value: kse.heldPercentInstitutions != null ? formatPct(kse.heldPercentInstitutions) : null },
                  { label: 'Short Data Date', value: kse.sharesShortPreviousMonthDate ? formatDate(kse.sharesShortPreviousMonthDate) : null },
                ].filter((item) => item.value != null).map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <dt className="text-1xs text-muted-foreground">{item.label}</dt>
                    <dd className="text-xs font-semibold">{item.value}</dd>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {hasFiscalMarkers && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fiscal Markers</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'Most Recent Quarter', value: kse.mostRecentQuarter ? formatDate(kse.mostRecentQuarter) : null },
                  { label: 'Last Fiscal Year End', value: kse.lastFiscalYearEnd ? formatDate(kse.lastFiscalYearEnd) : null },
                  { label: 'Next Fiscal Year End', value: kse.nextFiscalYearEnd ? formatDate(kse.nextFiscalYearEnd) : null },
                ].filter((item) => item.value != null).map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="font-semibold text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Analyst Upgrades/Downgrades */}
        {hasUpgrades && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Upgrades & Downgrades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upgrades.map((entry, idx) => {
                  const actionColor = entry.action === 'up' || entry.action === 'init'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : entry.action === 'down'
                      ? 'text-red-500'
                      : 'text-muted-foreground';
                  const actionLabel = entry.action === 'up' ? '↑ Upgrade'
                    : entry.action === 'down' ? '↓ Downgrade'
                      : entry.action === 'init' ? '● Initiated'
                        : entry.action === 'main' ? '— Maintained'
                          : entry.action || '—';
                  return (
                    <div key={idx} className="flex items-start gap-3 py-2 border-b border-border/10 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{entry.firm || 'Unknown'}</p>
                        <p className="text-1xs text-muted-foreground">
                          {entry.fromGrade ? `${entry.fromGrade} → ` : ''}{entry.toGrade || '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-1xs font-semibold ${actionColor}`}>{actionLabel}</p>
                        <p className="text-2xs text-muted-foreground">{formatDate(entry.date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pb-8">
      <ChartHeaderBar
        symbol={symbol}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        onSearchOpen={() => setSearchDialogOpen(true)}
        selectedCycles={selectedCycles}
        onCyclesChange={setSelectedCycles}
      />

      <div className="lg:col-span-8 flex flex-col gap-2">
        {loading && <ChartMainSkeleton />}

        {!loading && error && (
          <Card className="flex flex-col items-center gap-4 text-center py-10 bg-transparent border-dashed rounded-xl">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={retry} className="rounded-full">
              Try Again
            </Button>
          </Card>
        )}

        {showChartSection && (
          <>
            <Card className={`bg-transparent border-none rounded-none ${MOTION.fadeIn}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <CardDescription className="text-xs">{assetName}</CardDescription>
                    {screeningSignal && (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="success" className="px-3 py-1 text-1xs">
                          BUY SIGNAL
                        </Badge>
                        {screeningSignalDateLabel && (
                          <Badge className="px-3 py-1">
                            Signal {screeningSignalDateLabel}
                          </Badge>
                        )}
                      </div>
                    )}
                    {marketStateInfo ? (
                      <span className={`flex items-center gap-1 text-2xs font-medium ${marketStateInfo.tone}`}>
                        {MarketStateIcon ? <MarketStateIcon className="h-3 w-3" /> : null}
                        {marketStateInfo.label}
                      </span>
                    ) : null}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold">
                          {formatPriceTrim(displayedPrice, symbol, { fallback: '-' })}
                        </span>
                        {symbolInfo?.currency && (
                          <span className="text-xs text-muted-foreground">{symbolInfo.currency}</span>
                        )}
                      </div>
                      {displayedChange && (
                        <div className="flex flex-col text-xs">
                          <span
                            className={`font-medium ${displayedChange.value >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                          >
                            {displayedChange.value >= 0 ? '+' : ''}
                            {displayedChange.value.toFixed(2)} (
                            {displayedChange.pct != null
                              ? `${displayedChange.pct >= 0 ? '+' : ''}${displayedChange.pct.toFixed(2)}%`
                              : '—'}
                            )
                          </span>
                          {displayedChange.label && (
                            <span className="text-2xs text-muted-foreground">
                              {displayedChange.label}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <TickerAvatar symbol={symbol} logo={symbolInfo?.logo} className="w-12 h-12" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className={isNormalView ? "px-0 pb-0 overflow-hidden" : "px-0 pb-0 -mr-4 lg:mr-0"}>
                {isNormalView ? (
                  normalSeriesLoading ? (
                    <div className={CHART_HEIGHT_CLASS}>
                      <Skeleton className="w-full h-full rounded-xl" />
                    </div>
                  ) : filteredNormalChartData.length > 0 ? (
                    <>
                      <div className="relative left-1/2 right-1/2 -translate-x-1/2 w-screen max-w-[768px] lg:max-w-[900px]">
                        <NormalCandlestickChart
                          candles={normalCandlestickSeries.candles}
                          ema={normalCandlestickSeries.ema}
                          meta={normalCandlestickSeries.meta}
                          markers={buySignalMarkers}
                          formatTimestamp={formatNormalTimestamp}
                          currency={symbolInfo?.currency}
                          formatPrice={formatPriceValue}
                          isDark={resolvedTheme === 'dark'}
                          showTimeScale={isIntradayTimeframe}
                          showSeconds={normalTimeframe === '15m'}
                          emaColor={EMA_COLOR}
                          livermoreKey={normalCandlestickSeries.livermore}
                          showLivermoreKey={showLivermoreKey}
                          livermoreUpperColor={LIVERMORE_UPPER_COLOR}
                          livermoreLowerColor={LIVERMORE_LOWER_COLOR}
                          valueLabelPrefix={chartDisplayType === 'heikinAshi' ? "HA" : ""}
                          showTooltip={false}
                          priceScaleType={scaleChoice}
                          height={450}
                          seriesType={chartDisplayType === 'line' ? 'line' : 'candlestick'}
                        />
                        {isIdxLotSymbol(symbol) && (
                          <div className="absolute inset-0 pointer-events-none">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/anteck.gif"
                              alt="IDX"
                              className="absolute w-16 h-16 lg:w-24 lg:h-24 object-contain opacity-50 rounded-md"
                              style={{ bottom: '3.5rem', right: '5.5rem' }}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={`flex ${CHART_HEIGHT_CLASS} items-center justify-center text-xs text-muted-foreground`}>
                      {normalSeriesError || `Price data unavailable for the ${normalTimeframeLabel} timeframe.`}
                    </div>
                  )
                ) : (
                  <div className={`relative ${CHART_HEIGHT_CLASS}`}>
                    <LazySeasonalityChart
                      data={filteredChartData}
                      linesData={chartData.linesData}
                      quarterFilter={quarterFilter}
                      scaleChoice={scaleChoice}
                      formatTick={formatTick}
                      formatYAxis={formatYAxis}
                      formatTooltip={formatTooltip}
                      formatTooltipDate={formatTooltipDate}
                    />
                    <ArunaWatermark className="absolute inset-0 flex items-end justify-start bottom-18 left-4" />
                    {selectedCycles.includes('trump') && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/trump.gif"
                          alt="Trump Years"
                          className="absolute w-16 h-16 lg:w-24 lg:h-24 object-contain opacity-30"
                          loading="lazy"
                          style={{ bottom: '4rem', right: '3rem' }}
                        />
                      </div>
                    )}
                    {['pre', 'election', 'post', 'mid'].some(k => selectedCycles.includes(k)) && (
                      <div className="absolute inset-0 pointer-events-none">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/america-eagle.gif"
                          alt="Election Cycle"
                          className="absolute w-16 h-16 lg:w-24 lg:h-24 object-contain opacity-30"
                          style={{ bottom: '4rem', right: '3.5rem' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {isNormalView ? (
              <>
                <div className="flex flex-wrap justify-center items-center gap-1 mt-4 lg:mt-2">
                  {renderTimeframeButtons({ includeFullscreenToggle: true })}
                </div>
                <Dialog open={normalFullscreenOpen} onOpenChange={setNormalFullscreenOpen}>
                  <DialogContent
                    variant="fullscreen"
                    onEscapeKeyDown={(event) => event.preventDefault()}
                    onPointerDownOutside={(event) => event.preventDefault()}
                    showCloseButton={false}
                  >
                    <div className="flex flex-col gap-1 justify-center items-center border-b py-4 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-5 left-5"
                        onClick={() => setNormalFullscreenOpen(false)}
                      >
                        <ArrowLeft className="size-6 text-muted-foreground" />
                      </Button>
                      <DialogTitle className="text-sm font-semibold leading-none">
                        {formatTickerDisplay(symbol)}
                      </DialogTitle>
                      <span className="text-muted-foreground text-xs">{assetName}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-2 py-2">
                      <div className="flex flex-wrap justify-center items-center gap-1">{renderTimeframeButtons()}</div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <NormalCandlestickChart
                        candles={normalCandlestickSeries.candles}
                        ema={normalCandlestickSeries.ema}
                        meta={normalCandlestickSeries.meta}
                        markers={buySignalMarkers}
                        formatTimestamp={formatNormalTimestamp}
                        currency={symbolInfo?.currency}
                        formatPrice={formatPriceValue}
                        isDark={resolvedTheme === 'dark'}
                        showTimeScale={isIntradayTimeframe}
                        showSeconds={normalTimeframe === '15m'}
                        emaColor={EMA_COLOR}
                        livermoreKey={normalCandlestickSeries.livermore}
                        showLivermoreKey={showLivermoreKey}
                        livermoreUpperColor={LIVERMORE_UPPER_COLOR}
                        livermoreLowerColor={LIVERMORE_LOWER_COLOR}
                        valueLabelPrefix={chartDisplayType === 'heikinAshi' ? "HA" : ""}
                        showTooltip={false}
                        priceScaleType={scaleChoice}
                        height={650}
                        seriesType={chartDisplayType === 'line' ? 'line' : 'candlestick'}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 mt-4 lg:mt-2">
                <SegmentedControl
                  value={quarterFilter}
                  onValueChange={setQuarterFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'Q1', label: 'Q1' },
                    { value: 'Q2', label: 'Q2' },
                    { value: 'Q3', label: 'Q3' },
                    { value: 'Q4', label: 'Q4' },
                  ]}
                  className="rounded-sm px-2 min-w-[2.1rem] font-bold py-0 text-1xs"
                  activeClassName="bg-emerald-700 text-white/80 hover:bg-emerald-700"
                  inactiveClassName="border-border/20 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="lg:col-span-4 flex flex-col gap-4">
        {loading && <ChartSidebarSkeleton hasPortfolioPosition={hasPortfolioPosition} />}

        {showChartSection && (
          <div className={`space-y-4 mt-6 lg:mt-0 ${MOTION.fadeIn}`}>
            {hasPortfolioPosition && (
              <Card className="overflow-hidden border border-border/20">
                <div
                  className={`flex flex-col gap-3 border-l-4 px-4 py-4 ${portfolioPosition.pnl != null && portfolioPosition.pnl < 0
                    ? 'border-red-600 bg-red-600/5'
                    : 'border-emerald-700 bg-emerald-700/5'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-1xs uppercase tracking-wide text-muted-foreground">
                        Your Portfolio in {symbol}
                      </p>
                      <p className="text-xl font-semibold">
                        {portfolioPosition.marketValue != null
                          ? `${formatDetailedCurrency(portfolioPosition.marketValue)} ${currencyCode}`
                          : '—'}
                      </p>
                      <p className="text-1xs text-muted-foreground">Market Value</p>
                    </div>
                    {portfolioPosition.pnlPct != null && (
                      <span
                        className={`text-xs font-semibold ${portfolioPosition.pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                      >
                        {formatPercentage(portfolioPosition.pnlPct)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-border/30 bg-background px-4 py-3 text-sm font-semibold">
                  <div className="space-y-1">
                    <p className="text-1xs text-muted-foreground">Average Price</p>
                    <p>
                      {portfolioPosition.averagePrice != null
                        ? `${formatDetailedCurrency(portfolioPosition.averagePrice)} ${currencyCode}`
                        : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-1xs text-muted-foreground">PNL</p>
                    <p
                      className={
                        portfolioPosition.pnl != null
                          ? portfolioPosition.pnl >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                          : 'text-muted-foreground'
                      }
                    >
                      {portfolioPosition.pnl != null
                        ? `${portfolioPosition.pnl >= 0 ? '+' : ''}${formatDetailedCurrency(portfolioPosition.pnl)} ${currencyCode}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Button
              onClick={() => {
                if (!canUseProtectedActions) {
                  redirectToSignIn();
                  return;
                }
                setPortfolioDialogOpen(true);
              }}
              className="w-full text-xs"
            >
              Add to Your Portfolio
            </Button>

            {(fundamentalsLoading || fundamentals || cycleSummary || quarterlyHeatmap.rows.length > 0 || monthlyHeatmap.rows.length > 0) && (
              <div className="space-y-4">
                <Tabs value={infoTab} onValueChange={setInfoTab} className="w-full">
                  <TabsList
                    variant="line"
                    className="justify-start gap-2 overflow-x-auto flex-nowrap whitespace-nowrap border-b border-border/30 pb-1 hide-scrollbar w-full h-auto p-0 text-1xs"
                  >
                    {infoTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="flex-shrink-0 px-2 py-2 uppercase font-semibold text-[11px] text-muted-foreground data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400 after:bg-emerald-700 dark:after:bg-emerald-400"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div>
                  {infoTab === 'trading-plan' && (
                    <ChartTradingPlanPanel
                      payload={tradingPlanPayload}
                      dateLabel={screeningSignalDateLabel}
                      lotEligible={lotEligible}
                      currencyCode={currencyCode}
                      formatPriceValue={formatPriceValue}
                      formatDetailedCurrency={formatDetailedCurrency}
                    />
                  )}
                  {infoTab === 'profile' && renderProfileTab()}
                  {infoTab === 'keystats' && renderKeyStatsTab()}
                  {infoTab === 'analysis' && renderAnalysisTab()}
                  {infoTab === 'financials' && renderFinancialsTab()}
                  {infoTab === 'news' && renderNewsTab()}
                  {infoTab === 'seasonality' && (
                    <ChartSeasonalityPanel
                      quarterlyHeatmap={quarterlyHeatmap}
                      monthlyHeatmap={monthlyHeatmap}
                      symbol={symbol}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AddAssetModal
        open={portfolioDialogOpen && canUseProtectedActions}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPortfolioDialogOpen(false);
            return;
          }
          if (!canUseProtectedActions) {
            redirectToSignIn();
            return;
          }
          setPortfolioDialogOpen(true);
        }}
        initialSymbol={symbol}
        onSave={async (entry) => {
          if (!canUseProtectedActions) {
            redirectToSignIn();
            return;
          }
          const nextEntries = Array.isArray(portfolioEntries)
            ? [...portfolioEntries, entry]
            : [entry];
          setPortfolioEntries(nextEntries);
          try {
            await syncPortfolio(nextEntries);
            setPortfolioDialogOpen(false);
            router.push('/portfolio-tracker');
          } catch (error) {
            console.warn('Failed to sync portfolio', error);
          }
        }}
      />
      <SymbolSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelect={(nextSymbol) => {
          if (!nextSymbol || nextSymbol === symbol) {
            return;
          }
          setSymbol(nextSymbol);
          setSelectedCycles(getDefaultCyclesForSymbol(nextSymbol));
          router.push(`/chart?symbol=${encodeURIComponent(nextSymbol)}&cycle=normal`);
        }}
      />
    </div>
  );
}

export default function SmartChartsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ElectionCyclePageContent />
    </Suspense>
  );
}
