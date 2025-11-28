"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  removeIncompleteYears,
  computeDailyReturns,
  getElectionCycleLabel,
  hirschStyleSeasonalPattern,
  computeSingleYearPattern,
  forwardFillSingleYear,
  calculateMonthlyReturns,
  calculateQuarterlyReturns,
  formatMonthlyHeatmap,
  formatQuarterlyHeatmap,
} from '@/lib/seasonalData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, ErrorBar, ReferenceLine } from 'recharts';
import { Loader2, Sun, MoonStar, Clock3, Star, Lock, Bitcoin, Crown, ChevronDown, Fullscreen, ArrowLeft } from "lucide-react";
import { useTheme } from 'next-themes';
import { AddAssetModal } from "@/components/add-asset-modal";
import { SymbolSearchDialog } from "@/components/header-symbol-search";
import { useAuth } from "@/components/auth-provider";
import { NormalCandlestickChart } from "@/components/normal-candlestick-chart";
import { fetchEncodedJson } from "@/lib/api-client";
import { DEFAULT_WATCHLIST, getDefaultWatchlist } from "@/lib/default-watchlist";
import { ArunaWatermark } from "@/components/aruna-watermark";

const CURRENT_LINE_COLOR = 'oklch(59.6% 0.145 163.225)';

const SCREENING_CATEGORIES = ['idx', 'us', 'crypto'];

function areWatchlistsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].symbol !== b[i].symbol || (a[i].order ?? i) !== (b[i].order ?? i)) {
      return false;
    }
  }
  return true;
}

function matchScreeningEntry(results, targetSymbol) {
  if (!Array.isArray(results) || !targetSymbol) return null;
  const normalizedTarget = targetSymbol.trim().toUpperCase();
  if (!normalizedTarget) return null;
  for (const candidate of results) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      if (candidate.trim().toUpperCase() === normalizedTarget) {
        return { symbol: candidate, signal_date: null, is_warning: false };
      }
      continue;
    }
    if (
      typeof candidate === 'object' &&
      typeof candidate.symbol === 'string' &&
      candidate.symbol.trim().toUpperCase() === normalizedTarget
    ) {
      return {
        symbol: candidate.symbol,
        signal_date: candidate.signal_date ?? null,
        is_warning: Boolean(candidate.is_warning),
      };
    }
  }
  return null;
}

function formatScreeningTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const cycleMetaMap = {
  all: { label: 'All Years', lineKey: 'allYears' },
  pre: { label: 'Pre-Election Year', lineKey: 'preElection' },
  election: { label: 'Election Year', lineKey: 'election' },
  mid: { label: 'Mid-Term Year', lineKey: 'midTerm' },
  post: { label: 'Post-Election Year', lineKey: 'postElection' },
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const NORMAL_TIMEFRAME_OPTIONS = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '2h', label: '2h' },
  { value: '4h', label: '4h' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
  { value: 'M', label: '1M' },
];

const INTRADAY_TIMEFRAMES = new Set(['15m', '1h', '2h', '4h']);

const EMA_PERIOD = 32;
const EMA_COLOR = '#0ea5e9';
const LIVERMORE_LOOKBACK = 20;
const LIVERMORE_UPPER_COLOR = '#f97316';
const LIVERMORE_LOWER_COLOR = '#6b7380';

function computeRSI(values = [], period = 14) {
  const output = new Array(values.length).fill(null);
  if (values.length <= period) {
    return output;
  }

  let gainSum = 0;
  let lossSum = 0;
  let avgGain = null;
  let avgLoss = null;

  for (let i = 1; i < values.length; i++) {
    const current = values[i];
    const prev = values[i - 1];
    if (!Number.isFinite(current) || !Number.isFinite(prev)) {
      continue;
    }
    const change = current - prev;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      gainSum += gain;
      lossSum += loss;
      if (i === period) {
        avgGain = gainSum / period;
        avgLoss = lossSum / period;
        output[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else if (avgGain != null && avgLoss != null) {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      if (avgLoss === 0) {
        output[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        output[i] = 100 - 100 / (1 + rs);
      }
    }
  }

  return output;
}

function smoothSeries(values = [], period = 3) {
  const result = new Array(values.length).fill(null);
  const window = [];
  let sum = 0;
  let count = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const numeric = Number.isFinite(value) ? value : null;
    window.push(numeric);
    if (numeric != null) {
      sum += numeric;
      count += 1;
    }
    if (window.length > period) {
      const removed = window.shift();
      if (removed != null) {
        sum -= removed;
        count -= 1;
      }
    }
    if (window.length === period && count === period) {
      result[i] = sum / period;
    }
  }

  return result;
}

function computeStochasticRSI(values = [], stochasticLength = 14, rsiLength = 14, smoothK = 3, smoothD = 3) {
  const rsiValues = computeRSI(values, rsiLength);
  const rawK = new Array(values.length).fill(null);

  for (let i = 0; i < rsiValues.length; i++) {
    const currentRsi = rsiValues[i];
    if (!Number.isFinite(currentRsi)) continue;
    const start = i - stochasticLength + 1;
    if (start < 0) continue;
    let min = Infinity;
    let max = -Infinity;
    let valid = true;
    for (let j = start; j <= i; j++) {
      const value = rsiValues[j];
      if (!Number.isFinite(value)) {
        valid = false;
        break;
      }
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (!valid || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
      continue;
    }
    rawK[i] = ((currentRsi - min) / (max - min)) * 100;
  }

  const smoothKValues = smoothSeries(rawK, smoothK);
  const smoothDValues = smoothSeries(smoothKValues, smoothD);
  return { k: smoothKValues, d: smoothDValues };
}

function calculateEMA(values = [], period = 13) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }
  const multiplier = 2 / (period + 1);
  let emaValue = null;
  return values.map((value) => {
    if (!Number.isFinite(value)) {
      return null;
    }
    emaValue = emaValue == null ? value : value * multiplier + emaValue * (1 - multiplier);
    return emaValue;
  });
}

function computeLivermoreKeyLevels(points = [], lookback = 20) {
  if (!Array.isArray(points) || points.length === 0) {
    return { upper: [], lower: [], lookup: {} };
  }
  const upper = [];
  const lower = [];
  const lookup = {};
  const highs = [];
  const lows = [];
  points.forEach((point) => {
    if (!point || typeof point.time !== 'number') return;
    const high = Number.isFinite(point.high) ? point.high : null;
    const low = Number.isFinite(point.low) ? point.low : null;
    if (high == null || low == null) {
      lookup[point.time] = { upper: null, lower: null };
      return;
    }
    highs.push(high);
    lows.push(low);
    if (highs.length > lookback) highs.shift();
    if (lows.length > lookback) lows.shift();
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const upperValue = Number.isFinite(highest) ? Number(highest.toFixed(6)) : null;
    const lowerValue = Number.isFinite(lowest) ? Number(lowest.toFixed(6)) : null;
    lookup[point.time] = { upper: upperValue, lower: lowerValue };
    if (upperValue != null) {
      upper.push({ time: point.time, value: upperValue });
    }
    if (lowerValue != null) {
      lower.push({ time: point.time, value: lowerValue });
    }
  });
  return { upper, lower, lookup };
}

function isCryptoTicker(symbol = '') {
  const upper = symbol.toUpperCase();
  return upper.includes('-USD') || upper.startsWith('CRYPTO:');
}

function getDefaultCyclesForSymbol() {
  return ['normal'];
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60000;
  return Math.floor(diff / DAY_IN_MS);
}

function ElectionCyclePageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
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
  const symbolParam = searchParams.get('symbol');
  const cycleParam = searchParams.get('cycle');
  const searchParamsString = searchParams.toString();
  const LAST_SYMBOL_KEY = 'aruna_last_election_symbol';
  const getInitialSymbol = () => {
    if (symbolParam) return symbolParam;
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem(LAST_SYMBOL_KEY);
      if (last) return last;
    }
    return 'MSFT';
  };
  const initialSymbol = getInitialSymbol();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [scaleChoice, setScaleChoice] = useState('linear');
  const [loading, setLoading] = useState(false);
  const [rawLinesData, setRawLinesData] = useState([]);
  const [normalTimeframe, setNormalTimeframe] = useState('D');
  const [normalSeries, setNormalSeries] = useState([]);
  const [normalSeriesLoading, setNormalSeriesLoading] = useState(false);
  const [normalSeriesError, setNormalSeriesError] = useState(null);
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {} });
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [portfolioEntries, setPortfolioEntries] = useState([]);
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [showLivermoreKey, setShowLivermoreKey] = useState(false);
  const [watchlist, setWatchlist] = useState(() => getDefaultWatchlist());
  const [screeningSignal, setScreeningSignal] = useState(null);
  const [infoTab, setInfoTab] = useState('keystats');
  const [normalFullscreenOpen, setNormalFullscreenOpen] = useState(false);
  const remoteWatchlistSeedRef = React.useRef(false);
  const remotePortfolioSeedRef = React.useRef(false);
  const redirectToSignIn = useCallback(() => {
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : pathname || '/';
    router.push(`/signin?redirect=${encodeURIComponent(currentPath)}`);
  }, [pathname, router]);

  const [selectedCycles, setSelectedCycles] = useState(() => {
    if (cycleParam) {
      const parsed = cycleParam.split(',').map((item) => item.trim()).filter(Boolean);
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return getDefaultCyclesForSymbol(initialSymbol);
  });
  const isNormalView = selectedCycles.length === 1 && selectedCycles[0] === 'normal';
  const normalTimeframeOption = useMemo(
    () => NORMAL_TIMEFRAME_OPTIONS.find((option) => option.value === normalTimeframe),
    [normalTimeframe]
  );
  const normalTimeframeLabel = normalTimeframeOption?.label ?? normalTimeframe.toUpperCase();
  const isIntradayTimeframe = INTRADAY_TIMEFRAMES.has(normalTimeframe);
  const screeningSignalDateLabel = screeningSignal?.signal_date
    ? formatScreeningTimestamp(screeningSignal.signal_date)
    : null;

  const colors = useMemo(() => {
    const isDark = resolvedTheme === 'dark';
    const base = isDark ? '#F9F9F9F9' : '#333333';
    return {
      allYears: base,
      preElection: base,
      election: base,
      midTerm: base,
      postElection: base,
      current: CURRENT_LINE_COLOR,
    };
  }, [resolvedTheme]);

  const primaryChartColor = CURRENT_LINE_COLOR;
  const secondaryChartColor = colors.allYears;
  const beatColor = 'rgb(22, 163, 74)'; // tailwind green-600
  const missColor = 'rgb(220, 38, 38)'; // tailwind red-600

  // Update symbol when URL param changes
  useEffect(() => {
    if (symbolParam && symbolParam !== symbol) {
      setSymbol(symbolParam);
      if (cycleParam) {
        const parsed = cycleParam.split(',').map((item) => item.trim()).filter(Boolean);
        if (parsed.length > 0) {
          setSelectedCycles(parsed);
        } else {
          setSelectedCycles(getDefaultCyclesForSymbol(symbolParam));
        }
      } else {
        setSelectedCycles(getDefaultCyclesForSymbol(symbolParam));
      }
    } else if (cycleParam) {
      const parsed = cycleParam.split(',').map((item) => item.trim()).filter(Boolean);
      if (parsed.length > 0) {
        setSelectedCycles(parsed);
      }
    }
  }, [symbolParam, symbol, cycleParam]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    const normalized = selectedCycles.join(',');
    const params = new URLSearchParams(searchParamsString);
    const current = params.get('cycle') ?? '';
    if (normalized) {
      if (current === normalized) return;
      params.set('cycle', normalized);
    } else {
      if (!current) return;
      params.delete('cycle');
    }
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [selectedCycles, searchParamsString, pathname, router]);

  const loadScreeningSignal = useCallback(async () => {
    if (!supabase) {
      setScreeningSignal(null);
      return;
    }
    const normalizedSymbol = typeof symbol === 'string' ? symbol.trim().toUpperCase() : '';
    if (!normalizedSymbol) {
      setScreeningSignal(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('screening_snapshots')
        .select('category, results')
        .in('category', SCREENING_CATEGORIES);
      if (error) throw error;

      let found = null;
      data?.some((snapshot) => {
        const match = matchScreeningEntry(snapshot.results, normalizedSymbol);
        if (match) {
          found = { ...match, category: snapshot.category };
          return true;
        }
        return false;
      });
      setScreeningSignal(found);
    } catch (error) {
      console.warn('Failed to load screening snapshots', error);
      setScreeningSignal(null);
    }
  }, [supabase, symbol]);

  useEffect(() => {
    loadScreeningSignal();
  }, [loadScreeningSignal]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('election_cycle_screening')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'screening_snapshots' },
        () => {
          loadScreeningSignal();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadScreeningSignal]);

  useEffect(() => {
    setScreeningSignal(null);
  }, [symbol]);

  // Persist last viewed symbol
  useEffect(() => {
    try {
      localStorage.setItem(LAST_SYMBOL_KEY, symbol);
    } catch {}
  }, [symbol]);

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
    fetchDataAndBuildChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, selectedCycles]);

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

  useEffect(() => {
    if (!symbol) {
      return;
    }

    let cancelled = false;
    setFundamentals(null);
    setFundamentalsLoading(true);
    setRevenuePeriod('quarterly');

    (async () => {
      try {
        const { response, data } = await fetchEncodedJson(
          `/api/fundamentals?symbol=${encodeURIComponent(symbol)}`
        );
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load fundamentals');
        }
        if (!cancelled) {
          setFundamentals(data);
        }
      } catch (error) {
        console.warn('Failed to fetch fundamentals', error);
        if (!cancelled) {
          setFundamentals(null);
        }
      } finally {
        if (!cancelled) {
          setFundamentalsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (!fundamentals) return;
    const annual = fundamentals.analysis?.revenue?.annual;
    if (revenuePeriod === 'annual' && (!annual || annual.length === 0)) {
      setRevenuePeriod('quarterly');
    }
  }, [fundamentals, revenuePeriod]);

  async function fetchDataAndBuildChart() {
    setLoading(true);
    try {
      const startDate = Math.floor(new Date('1971-01-01').getTime() / 1000);
      const endDate = Math.floor(Date.now() / 1000);

      const { response, data } = await fetchEncodedJson(
        `/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch data');
      }

      let rawData = (data.data || []).map(row => ({
        date: row.date,
        adjclose: row.adjclose,
      }));

      rawData = rawData.filter(row => row.adjclose !== null);

      const currentYear = new Date().getFullYear();
      const histRaw = rawData.filter(row => new Date(row.date).getFullYear() < currentYear);
      const currentRaw = rawData.filter(row => new Date(row.date).getFullYear() === currentYear);

      let histDaily = computeDailyReturns(histRaw);
      histDaily = removeIncompleteYears(histDaily, 200);
      histDaily = histDaily.map(row => ({
        ...row,
        cycle: getElectionCycleLabel(row.year),
      }));

      const currentDaily = computeDailyReturns(currentRaw);
      const linesData = [];

      if (selectedCycles.includes('all') && histDaily.length > 0) {
        const firstYear = Math.min(...histDaily.map(r => r.year));
        const pattern = hirschStyleSeasonalPattern(histDaily);
        linesData.push({
          name: `All Years (${firstYear}-${currentYear - 1})`,
          key: 'allYears',
          data: pattern,
          color: colors.allYears,
        });
      }

      if (selectedCycles.includes('pre')) {
        const preData = histDaily.filter(r => r.cycle === 'Pre-Election Year');
        if (preData.length > 0) {
          linesData.push({
            name: 'Pre-Election Year',
            key: 'preElection',
            data: hirschStyleSeasonalPattern(preData),
            color: colors.preElection,
          });
        }
      }

      if (selectedCycles.includes('election')) {
        const elecData = histDaily.filter(r => r.cycle === 'Election Year');
        if (elecData.length > 0) {
          linesData.push({
            name: 'Election Year',
            key: 'election',
            data: hirschStyleSeasonalPattern(elecData),
            color: colors.election,
          });
        }
      }

      if (selectedCycles.includes('mid')) {
        const midData = histDaily.filter(r => r.cycle === 'Mid-Term Year');
        if (midData.length > 0) {
          linesData.push({
            name: 'Mid-Term Year',
            key: 'midTerm',
            data: hirschStyleSeasonalPattern(midData),
            color: colors.midTerm,
          });
        }
      }

      if (selectedCycles.includes('post')) {
        const postData = histDaily.filter(r => r.cycle === 'Post-Election Year');
        if (postData.length > 0) {
          linesData.push({
            name: 'Post-Election Year',
            key: 'postElection',
            data: hirschStyleSeasonalPattern(postData),
            color: colors.postElection,
          });
        }
      }

      if (selectedCycles.includes('current') && currentDaily.length > 0) {
        let pattern = computeSingleYearPattern(currentDaily, currentYear);
        pattern = forwardFillSingleYear(pattern);
        if (pattern.length > 0) {
          linesData.push({
            name: `Current Year (${currentYear} YTD)`,
            key: 'current',
            data: pattern,
            color: colors.current,
          });
        }
      }

      // Simpan raw linesData saja, transformasi akan dilakukan di useMemo
      setRawLinesData(linesData);

      const symbolName = data.meta?.name || symbol;
      setAssetName(symbolName);

      let currentPrice = null;
      let startPrice = null;
      let predictedPrice = null;
      let predictedPct = null;
      let dailyChange = null;
      let dailyChangePct = null;

      if (rawData.length > 0) {
        currentPrice = rawData[rawData.length - 1].adjclose;
        if (rawData.length > 1) {
          const previousPrice = rawData[rawData.length - 2].adjclose;
          if (previousPrice != null) {
            dailyChange = currentPrice - previousPrice;
            if (previousPrice !== 0) {
              dailyChangePct = (dailyChange / previousPrice) * 100;
            }
          }
        }
      }

      if (currentRaw.length > 0) {
        startPrice = currentRaw[0].adjclose;
      }

      const currentCycleLabel = getElectionCycleLabel(currentYear);
      const cycleKeyMap = {
        'Pre-Election Year': 'preElection',
        'Election Year': 'election',
        'Mid-Term Year': 'midTerm',
        'Post-Election Year': 'postElection',
      };
      const targetKey = cycleKeyMap[currentCycleLabel];
      const benchmarkLine = linesData.find(line => line.key === targetKey);
      
      if (benchmarkLine && benchmarkLine.data.length > 0 && startPrice) {
        const lastPoint = benchmarkLine.data[benchmarkLine.data.length - 1];
        if (scaleChoice === 'linear') {
          predictedPct = lastPoint.pctChangeYtd;
          predictedPrice = startPrice * (1.0 + predictedPct / 100.0);
        }
      }

      const marketState = data.meta?.marketState ? String(data.meta.marketState).toUpperCase() : 'CLOSED';
      const isMarketOpen = ['REGULAR', 'OPEN', 'TRADING'].some(state => marketState.includes(state));

      setSymbolInfo({
        name: symbolName,
        currentPrice,
        predictedPrice,
        predictedPct,
        dailyChange,
        dailyChangePct,
        isMarketOpen,
        currency: data.meta?.currency,
      });

      const monthlyReturns = calculateMonthlyReturns(rawData);
      const quarterlyReturns = calculateQuarterlyReturns(rawData);
      
      setMonthlyHeatmap(formatMonthlyHeatmap(monthlyReturns, 10));
      setQuarterlyHeatmap(formatQuarterlyHeatmap(quarterlyReturns, 10));
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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

  function getReturnCellClass(value) {
    if (value == null || isNaN(value)) return '';
    if (value > 0) return 'text-white bg-green-900';
    if (value < 0) return 'text-white bg-red-900';
    return 'bg-muted text-foreground';
  }

  const [quarterFilter, setQuarterFilter] = useState('all');

  const getQuarterDateRange = (quarter) => {
    switch(quarter) {
      case 'Q1': return [1, 90];
      case 'Q2': return [91, 181];
      case 'Q3': return [182, 273];
      case 'Q4': return [274, 365];
      default: return [1, 365];
    }
  };

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

  useEffect(() => {
    if (!symbol || !isNormalView) {
      setNormalSeriesLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadSeries() {
      setNormalSeriesLoading(true);
      setNormalSeriesError(null);
      setNormalSeries([]);
      try {
        const params = new URLSearchParams({ symbol, timeframe: normalTimeframe });
        const { response, data } = await fetchEncodedJson(`/api/price-series?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load price data');
        }
        if (!cancelled) {
          setNormalSeries(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (!cancelled) {
          setNormalSeries([]);
          setNormalSeriesError(error.message || 'Failed to load price data');
        }
      } finally {
        if (!cancelled) {
          setNormalSeriesLoading(false);
        }
      }
    }

    loadSeries();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [symbol, normalTimeframe, isNormalView]);

  const filteredNormalChartData = useMemo(() => {
    if (!isNormalView || !Array.isArray(normalSeries) || normalSeries.length === 0) {
      return [];
    }
    const sorted = [...normalSeries]
      .filter(
        (point) =>
          point &&
          typeof point.timestamp === 'number' &&
          Number.isFinite(point.timestamp)
      )
      .sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length === 0) return [];

    const baseTimestamp = sorted[0].timestamp;
    let prevHeikinOpen = null;
    let prevHeikinClose = null;

    const normalizedPoints = [];

    sorted.forEach((point) => {
      const close =
        typeof point.close === 'number' && Number.isFinite(point.close)
          ? point.close
          : typeof point.price === 'number' && Number.isFinite(point.price)
            ? point.price
            : null;
      if (close == null) {
        return;
      }

      const open =
        typeof point.open === 'number' && Number.isFinite(point.open) ? point.open : close;
      const high =
        typeof point.high === 'number' && Number.isFinite(point.high)
          ? point.high
          : Math.max(open, close);
      const low =
        typeof point.low === 'number' && Number.isFinite(point.low)
          ? point.low
          : Math.min(open, close);

      const heikinClose = (open + high + low + close) / 4;
      const heikinOpen =
        prevHeikinOpen == null || prevHeikinClose == null
          ? (open + close) / 2
          : (prevHeikinOpen + prevHeikinClose) / 2;
      const heikinHigh = Math.max(high, heikinOpen, heikinClose);
      const heikinLow = Math.min(low, heikinOpen, heikinClose);
      prevHeikinOpen = heikinOpen;
      prevHeikinClose = heikinClose;

      normalizedPoints.push({
        timestamp: point.timestamp,
        elapsed: point.timestamp - baseTimestamp,
        price: close,
        open,
        high,
        low,
        close,
        interpolated: false,
        volume:
          typeof point.volume === 'number' && Number.isFinite(point.volume)
            ? point.volume
            : null,
        heikinOpen,
        heikinHigh,
        heikinLow,
        heikinClose,
      });
    });

    if (normalizedPoints.length === 0) {
      return [];
    }

    const closingPrices = normalizedPoints.map((point) => point.close);
    const ema32Series = calculateEMA(closingPrices, EMA_PERIOD);
    const firstClose =
      closingPrices.find((value) => typeof value === 'number' && Number.isFinite(value)) ?? null;

    return normalizedPoints.map((point, index) => {
      const ema32 = Number.isFinite(ema32Series[index]) ? ema32Series[index] : point.close;
      const changePct =
        firstClose && firstClose !== 0 ? ((point.close - firstClose) / firstClose) * 100 : null;
      return {
        ...point,
        changePct,
        ema32,
      };
    });
  }, [isNormalView, normalSeries]);

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
      pct: symbolInfo.dailyChangePct,
      label: 'Daily change',
    };
  }, [symbolInfo?.dailyChange, symbolInfo?.dailyChangePct]);

  const normalCandlestickSeries = useMemo(() => {
    if (!isNormalView || filteredNormalChartData.length === 0) {
      return {
        candles: [],
        ema: [],
        livermore: { upper: [], lower: [] },
        meta: {},
        stochastic: { k: [], d: [] },
      };
    }
    const candles = [];
    const ema = [];
    const meta = {};
    const livermoreSource = [];
    const closingValues = filteredNormalChartData.map((point) => {
      if (typeof point.close === 'number' && Number.isFinite(point.close)) {
        return point.close;
      }
      if (typeof point.price === 'number' && Number.isFinite(point.price)) {
        return point.price;
      }
      return null;
    });
    const stochasticValues = computeStochasticRSI(closingValues, 14, 14, 3, 3);
    const stochasticK = [];
    const stochasticD = [];
    filteredNormalChartData.forEach((point, index) => {
      if (typeof point.timestamp !== 'number') return;
      const time = Math.floor(point.timestamp / 1000);
      if (!Number.isFinite(time)) return;
      const actualOpen =
        typeof point.open === 'number' && Number.isFinite(point.open) ? point.open : point.price;
      const actualClose =
        typeof point.close === 'number' && Number.isFinite(point.close) ? point.close : point.price;
      const actualHigh =
        typeof point.high === 'number' && Number.isFinite(point.high)
          ? point.high
          : Math.max(actualOpen, actualClose);
      const actualLow =
        typeof point.low === 'number' && Number.isFinite(point.low)
          ? point.low
          : Math.min(actualOpen, actualClose);

      const open =
        typeof point.heikinOpen === 'number' && Number.isFinite(point.heikinOpen)
          ? point.heikinOpen
          : actualOpen;
      const close =
        typeof point.heikinClose === 'number' && Number.isFinite(point.heikinClose)
          ? point.heikinClose
          : actualClose;
      const high =
        typeof point.heikinHigh === 'number' && Number.isFinite(point.heikinHigh)
          ? point.heikinHigh
          : actualHigh;
      const low =
        typeof point.heikinLow === 'number' && Number.isFinite(point.heikinLow)
          ? point.heikinLow
          : actualLow;

      candles.push({ time, open, high, low, close });
      if (typeof point.ema32 === 'number' && Number.isFinite(point.ema32)) {
        ema.push({ time, value: point.ema32 });
      } else {
        ema.push({ time, value: close });
      }
      livermoreSource.push({ time, high: actualHigh, low: actualLow });
      meta[time] = {
        timestamp: point.timestamp,
        open,
        high,
        low,
        close,
        actualOpen,
        actualHigh,
        actualLow,
        actualClose,
        ema32:
          typeof point.ema32 === 'number' && Number.isFinite(point.ema32) ? point.ema32 : close,
        livermoreUpper: null,
        livermoreLower: null,
        changePct:
          typeof point.changePct === 'number' && Number.isFinite(point.changePct)
            ? point.changePct
            : null,
      };

      const kValue = stochasticValues.k[index];
      const dValue = stochasticValues.d[index];
      if (Number.isFinite(kValue)) {
        stochasticK.push({ time, value: Number(kValue.toFixed(2)) });
      }
      if (Number.isFinite(dValue)) {
        stochasticD.push({ time, value: Number(dValue.toFixed(2)) });
      }
    });

    const livermoreLevels = computeLivermoreKeyLevels(livermoreSource, LIVERMORE_LOOKBACK);
    Object.entries(livermoreLevels.lookup).forEach(([timeKey, values]) => {
      if (!values) return;
      if (meta[timeKey]) {
        meta[timeKey].livermoreUpper = values.upper ?? null;
        meta[timeKey].livermoreLower = values.lower ?? null;
      }
    });

    return {
      candles,
      ema,
      livermore: { upper: livermoreLevels.upper, lower: livermoreLevels.lower },
      meta,
      stochastic: { k: stochasticK, d: stochasticD },
    };
  }, [filteredNormalChartData, isNormalView]);

  const normalChartReady = normalCandlestickSeries.candles.length > 0;

  const renderTimeframeButtons = ({ includeFullscreenToggle = false } = {}) => (
    <>
      {NORMAL_TIMEFRAME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={normalTimeframe === option.value ? 'default' : 'ghost'}
          className={`rounded-sm px-2 min-w-[2.1rem] font-bold py-0 text-[11px] ${
            normalTimeframe === option.value
              ? 'bg-emerald-700 text-white/80 shadow-sm'
              : 'border-border/70 text-muted-foreground'
          }`}
          onClick={() => setNormalTimeframe(option.value)}
        >
          {option.label}
        </Button>
      ))}
      {includeFullscreenToggle ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 rounded-full border border-border/60 p-0 text-muted-foreground shadow-sm"
          onClick={() => setNormalFullscreenOpen(true)}
          disabled={normalSeriesLoading || !normalChartReady}
          title={`Fullscreen ${normalTimeframeLabel} candlestick`}
          aria-label="Open candlestick fullscreen"
        >
          <Fullscreen className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );

  const renderScaleButtons = (className = '') => (
    <div className={`inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5 ${className}`}>
      {[
        { value: 'linear', label: 'Linear' },
        { value: 'log', label: 'Logarithmic' },
      ].map((option) => (
        <Button
          key={option.value}
          type="button"
          size="xs"
          variant={scaleChoice === option.value ? 'default' : 'ghost'}
          className={`px-2 py-1 text-xs rounded-full ${scaleChoice === option.value ? 'shadow-sm' : ''}`}
          onClick={() => setScaleChoice(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  const renderLivermoreToggle = (className = '') => (
    <Button
      type="button"
      size="xs"
      variant={showLivermoreKey ? 'default' : 'ghost'}
      className={`rounded-full px-2 py-1 text-[11px] hover:bg-emerald-700 ${showLivermoreKey ? 'bg-emerald-700 text-white/80 shadow-sm' : 'border border-border/70 dark:text-white bg-muted/40'} ${className}`}
      onClick={() => setShowLivermoreKey((prev) => !prev)}
    >
      Livermore Key
    </Button>
  );

  const stochasticChartData = useMemo(() => {
    const combined = new Map();
    (normalCandlestickSeries.stochastic?.k ?? []).forEach(({ time, value }) => {
      combined.set(time, { time, k: value });
    });
    (normalCandlestickSeries.stochastic?.d ?? []).forEach(({ time, value }) => {
      const merged = combined.get(time) ?? { time };
      merged.d = value;
      combined.set(time, merged);
    });
    const sorted = Array.from(combined.values()).sort((a, b) => a.time - b.time);
    return sorted.slice(-400);
  }, [normalCandlestickSeries.stochastic]);

  const showIntradayScale = isIntradayTimeframe;
  useEffect(() => {
    if (!isNormalView && normalFullscreenOpen) {
      setNormalFullscreenOpen(false);
    }
  }, [isNormalView, normalFullscreenOpen]);
  const buySignalMarkers = useMemo(() => {
    if (
      !isNormalView ||
      !screeningSignal?.signal_date ||
      filteredNormalChartData.length === 0
    ) {
      return [];
    }
    const signalDate = new Date(screeningSignal.signal_date);
    if (Number.isNaN(signalDate.getTime())) {
      return [];
    }
    const signalMs = signalDate.getTime();
    let closest = null;
    let minDelta = Infinity;
    filteredNormalChartData.forEach((point) => {
      if (typeof point.timestamp !== 'number') return;
      const delta = Math.abs(point.timestamp - signalMs);
      if (delta < minDelta) {
        minDelta = delta;
        closest = Math.floor(point.timestamp / 1000);
      }
    });
    if (closest == null) {
      return [];
    }
    return [
      {
        time: closest,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#059669',
        text: 'Buy',
      },
    ];
  }, [filteredNormalChartData, screeningSignal?.signal_date, isNormalView]);
  const infoTabs = [
    { value: 'keystats', label: 'KEYSTATS' },
    { value: 'analysis', label: 'ANALYSIS' },
    { value: 'seasonality', label: 'SEASONALITY' },
    { value: 'profile', label: 'ABOUT' },
  ];

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

  const formatPriceValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

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
    if (typeof value === 'number') {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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

  const formatDecimalPercentage = useCallback((value, fractionDigits = 2) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value) * 100;
    return `${numeric.toFixed(fractionDigits)}%`;
  }, []);

  const quickStats = useMemo(() => {
    if (!fundamentals) return [];
    const valuations = fundamentals.valuations || {};
    const priceInfo = fundamentals.price || {};
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
      { label: 'Previous Close', value: formatPlainNumber(priceInfo.previousClose) },
      { label: 'Open', value: formatPlainNumber(priceInfo.open) },
    ];
    return stats.filter((item) => item.value && item.value !== '—');
  }, [fundamentals, formatCompactCurrency, formatRatio, formatPlainNumber]);

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
          return 'bg-amber-500/15 text-amber-300';
        case 'sell':
        case 'strong_sell':
        case 'underperform':
          return 'bg-red-500/15 text-red-300';
        case 'buy':
        case 'strong_buy':
          return 'bg-emerald-500/15 text-emerald-300';
        default:
          return 'bg-gray-500/15 text-gray-300';
      }
    };

    const ratingBgClass = getRecommendationClasses(recommendationKey);
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
          <text textAnchor="middle" className="fill-muted-foreground text-[10px]">
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
        return { label: 'Market Open', tone: 'text-emerald-700 dark:text-emerald-700', Icon: Sun };
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

  const MarketStateIcon = marketStateInfo?.Icon;
  const isFavorite = useMemo(
    () => watchlist.some((item) => item.symbol === symbol),
    [watchlist, symbol]
  );

  const toggleFavorite = useCallback(() => {
    if (!isAuthenticated) {
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
      syncWatchlist(next).catch(() => {});
      return next;
    });
  }, [isAuthenticated, redirectToSignIn, symbol, syncWatchlist]);

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
                  <div className="h-3 w-20 rounded-full shimmer" />
                  <div className="h-4 w-24 rounded-full shimmer" />
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

    const keyFacts = [
      { label: 'Exchange', value: profileInfo?.exchange },
      { label: 'Sector', value: extendedProfile?.sector || profileInfo?.sector },
      { label: 'Industry', value: extendedProfile?.industry || profileInfo?.industry },
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
                  <div className="h-3 w-20 rounded-full shimmer" />
                  <div className="h-4 w-24 rounded-full shimmer" />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid gap-2 md:grid-cols-2">
            {[...Array(2)].map((_, idx) => (
              <Card key={idx} className="h-full">
                <CardHeader>
                  <div className="h-4 w-32 rounded-full shimmer" />
                </CardHeader>
                <CardContent>
                  <div className="h-[220px] rounded-xl shimmer" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

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

        {(hasEarningsAnalysis || hasRevenueAnalysis) ? (
          <div className="grid gap-2 md:grid-cols-2">
            {hasEarningsAnalysis && latestEarningsPoint && (
              <div className="relative">
                <Card
                  className={`h-full mt-4 ${
                    !isAuthenticated
                      ? 'pointer-events-none select-none opacity-60 blur-[1.5px]'
                      : ''
                  }`}
                >
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
                            className={`text-xs font-semibold ${
                              latestEarningsOutcome.tone === 'beat'
                                ? 'text-emerald-700'
                                : 'text-red-600'
                            }`}
                          >
                            {latestEarningsOutcome.label}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full border bg-muted/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Normalized
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={earningsChartData}
                        margin={{ top: 20, right: 48, bottom: 32, left: -10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="periodLabel"
                          interval={0}
                          height={48}
                          tick={renderEarningsTick}
                        />
                        <YAxis
                          tickFormatter={(value) =>
                            value == null ? '' : formatEarningsValue(value)
                          }
                          width={50}
                          axisLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={earningsTooltipFormatter}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.periodLabel || ''
                          }
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Line
                          key="earnings-estimate"
                          type="monotone"
                          dataKey="estimate"
                          stroke="transparent"
                          dot={renderEstimateDot}
                          activeDot={false}
                        />
                        <Line
                          key="earnings-actual"
                          type="monotone"
                          dataKey="actual"
                          stroke="transparent"
                          dot={renderActualDot}
                          activeDot={false}
                        >
                          <ErrorBar
                            dataKey="range"
                            direction="y"
                            stroke={secondaryChartColor}
                            strokeDasharray="3 3"
                            width={0}
                          />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {!isAuthenticated && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/05 backdrop-blur-xs px-6 text-center">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground">
                      Sign in to explore earnings results
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasRevenueAnalysis && (
              <div className="relative">
                <Card
                  className={`h-full ${
                    !isAuthenticated
                      ? 'pointer-events-none select-none opacity-60 blur-[1.5px]'
                      : ''
                  }`}
                >
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
                        {[
                          { value: 'annual', label: 'Annual', disabled: !hasAnnualRevenue },
                          { value: 'quarterly', label: 'Quarterly', disabled: false },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            size="xs"
                            variant={revenuePeriod === option.value ? 'default' : 'ghost'}
                            className={`px-2 py-1 text-xs rounded-full ${
                              revenuePeriod === option.value ? 'shadow-sm' : ''
                            }`}
                            onClick={() => setRevenuePeriod(option.value)}
                            disabled={option.disabled}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={revenueChartData}
                        margin={{ top: 16, right: 32, bottom: 12, left: -12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="periodLabel" tick={{ fontSize: 10 }} />
                        <YAxis
                          tickFormatter={(value) =>
                            value == null ? '' : compactNumberFormatter.format(value)
                          }
                          width={60}
                          axisLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={revenueTooltipFormatter}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.periodLabel || ''}
                          cursor={{ fill: 'transparent' }}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar
                          dataKey="revenue"
                          name={`Revenue${analysisCurrency ? ` (${analysisCurrency})` : ''}`}
                          fill={primaryChartColor}
                          radius={[6, 6, 2, 2]}
                        />
                        <Bar
                          dataKey="earnings"
                          name={`Earnings${analysisCurrency ? ` (${analysisCurrency})` : ''}`}
                          fill={secondaryChartColor}
                          radius={[6, 6, 2, 2]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {!isAuthenticated && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/05 backdrop-blur-xs px-6 text-center">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs font-semibold text-muted-foreground">
                      Sign in to compare revenue and earnings
                    </p>
                  </div>
                )}
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
                    <div className="h-3 w-24 rounded-full shimmer" />
                    <div className="h-3 w-full rounded-full shimmer" />
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

    const { breakdown = [], totalOpinions, ratingLabel, ratingBgClass, ratingScore, priceTargets } =
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
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm mb-2">{totalOpinions || 0} Analyst Rating</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Latest consensus for {symbol}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-4 space-y-3 text-xs">
              <div className="flex flex-col justify-center items-center gap-3">
                <div className={`flex p-3 text-center items-center justify-center rounded-full text-sm tracking-wide ${ratingBgClass}`}>
                  {(ratingLabel || 'N/A')}
                </div>
                {ratingScore && (
                  <span className="text-xs text-muted-foreground">
                    Score {ratingScore.toFixed(1)} / 5
                  </span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-3">
                {hasBreakdown ? (
                  breakdown.map((item) => {
                    const percent = totalOpinions
                      ? Math.round((item.value / totalOpinions) * 100)
                      : 0;
                    const toneClass =
                      item.label.toLowerCase().includes('sell')
                        ? 'bg-red-600'
                        : item.label.toLowerCase().includes('hold')
                          ? 'bg-amber-600'
                          : 'bg-emerald-700';
                    return (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-muted-foreground">{item.value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${toneClass}`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">Breakdown unavailable.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {priceTargets && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-sm mb-2">Analyst Price Target</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Average target{' '}
                {averageTarget != null
                  ? `${formatDetailedCurrency(averageTarget)} ${currencyCode}`
                  : '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-xs">
                  Low{' '}
                  {lowTarget != null
                    ? `${formatDetailedCurrency(lowTarget)} ${currencyCode}`
                    : '—'}
                </span>
                <span className="text-xs">
                  High{' '}
                  {highTarget != null
                    ? `${formatDetailedCurrency(highTarget)} ${currencyCode}`
                    : '—'}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted mx-1.5">
                {lowTarget != null && (
                  <span
                    className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border border-border bg-muted-foreground"
                    style={{ left: getPosition(lowTarget) }}
                    title="Low"
                  />
                )}
                {highTarget != null && (
                  <span
                    className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border border-border bg-muted-foreground"
                    style={{ left: getPosition(highTarget) }}
                    title="High"
                  />
                )}
                {averageTarget != null && (
                  <span
                    className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-emerald-600 bg-emerald-600"
                    style={{ left: getPosition(averageTarget) }}
                    title="Target"
                  />
                )}
                {currentPrice != null && (
                  <span
                    className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-white"
                    style={{ left: getPosition(currentPrice) }}
                    title="Current"
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Current{' '}
                  {currentPrice != null
                    ? `${formatDetailedCurrency(currentPrice)} ${currencyCode}`
                    : '—'}
                </span>
                <span>
                  Target{' '}
                  {averageTarget != null
                    ? `${formatDetailedCurrency(averageTarget)} ${currencyCode}`
                    : '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {consensusRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm mb-2">Analyst Consensus Estimate</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Based on the latest revenue and earnings projections
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs min-w-lg">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-4 text-left font-medium">Metric</th>
                    {consensusColumns.map((entry) => (
                      <th key={entry.period} className="px-2 py-2 text-left font-medium">
                        {entry.periodLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consensusRows.map((row) => (
                    <tr key={row.label} className="border-t border-border/40">
                      <td className="py-2 pr-4 font-semibold">{row.label}</td>
                      {row.values.map((value, idx) => (
                        <td key={`${row.label}-${idx}`} className="px-2 py-2">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };
  const renderSeasonalityTab = () => {
    if (quarterlyHeatmap.rows.length === 0 && monthlyHeatmap.rows.length === 0) {
      return (
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            Seasonality data unavailable.
          </CardContent>
        </Card>
      );
    }
    return (
      <Accordion type="multiple" defaultValue={['quarterly', 'monthly']}>
        <AccordionItem value="quarterly" className="border-b-0">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            Quarterly Returns
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="relative">
              <div
                className={`overflow-x-auto -mx-4 px-4 ${
                  !isAuthenticated ? 'pointer-events-none select-none blur-[1.5px] opacity-60' : ''
                }`}
              >
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">Year</th>
                      {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, idx) => (
                        <th key={idx} className="text-center py-2 px-2 font-medium">{quarter}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quarterlyHeatmap.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                        {[1, 2, 3, 4].map((quarter) => {
                          const value = row[`Q${quarter}`];
                          const cellClass = getReturnCellClass(value);
                          return (
                            <td key={quarter} className={`text-center py-2 px-2 ${cellClass}`}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold bg-muted/50">
                      <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg.</td>
                      {[1, 2, 3, 4].map((quarter) => {
                        const value = quarterlyHeatmap.average[`Q${quarter}`];
                        const cellClass = getReturnCellClass(value);
                        return (
                          <td key={quarter} className={`text-center py-2 px-2 ${cellClass}`}>
                            {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {!isAuthenticated && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/05 backdrop-blur-xs px-6 text-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    Sign in to explore quarterly returns
                  </p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="monthly" className="border-b-0">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            Monthly Returns
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="relative">
              <div
                className={`overflow-x-auto ${
                  !isAuthenticated ? 'pointer-events-none select-none blur-[1.5px] opacity-60' : ''
                }`}
              >
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">Year</th>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                        <th key={idx} className="text-center py-2 px-1 font-medium">{month}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyHeatmap.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                          const value = row[`M${month}`];
                          const cellClass = getReturnCellClass(value);
                          return (
                            <td key={month} className={`text-center py-2 px-1 ${cellClass}`}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold bg-muted/50">
                      <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg.</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                        const value = monthlyHeatmap.average[`M${month}`];
                        const cellClass = getReturnCellClass(value);
                        return (
                          <td key={month} className={`text-center py-2 px-1 ${cellClass}`}>
                            {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {!isAuthenticated && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/05 backdrop-blur-xs px-6 text-center">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">
                    Sign in to view monthly returns
                  </p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <div className="flex flex-col gap-2 pb-8">
      <div className="flex justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="text-base font-semibold uppercase cursor-pointer transition-colors hover:text-primary flex items-center gap-1"
            onClick={() => setSearchDialogOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSearchDialogOpen(true);
              }
            }}
          >
            {symbol} <ChevronDown className="size-4 dark:text-white/70"/>
          </h1>
          <span className="text-muted">|</span>
          {symbol.endsWith('.JK') && (
            <span className="dark:text-white/70 text-xs">🇮🇩</span>
          )}
          {symbol.endsWith('-USD') && (
            <span className="dark:text-white/70 text-xs flex items-center gap-1"><Bitcoin className="size-4"/> to the moon</span>
          )}
          {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
            <span className="dark:text-white/70 text-xs">🇺🇸 pension fund</span>
          )}
          {['AAPL','MSFT','GOOGL','GOOG','AMZN','META','NVDA','AVGO'].some((s) => symbol.endsWith(s)) && (
            <span className="dark:text-white/70 text-xs flex items-center gap-1"><Crown className="size-3.5"/> magnificent 7</span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${symbol} from favorites` : `Add ${symbol} to favorites`}
          className={`rounded-full p-1 transition-colors ${isFavorite ? 'text-amber-600 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Star
            className="size-5"
            strokeWidth={isFavorite ? 1.2 : 1.5}
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      {loading && (
        <>
          <Card className="bg-transparent border-none rounded-none">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded-full shimmer"></div>
                  <div className="h-8 w-32 rounded-2xl shimmer"></div>
                  <div className="h-4 w-24 rounded-full shimmer"></div>
                  <div className="h-4 w-20 rounded-full shimmer"></div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-40 rounded-full shimmer"></div>
                  <div className="h-6 w-32 rounded-full shimmer"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="w-full h-[380px] rounded-lg shimmer"></div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-1 h-7 rounded-full shimmer"></div>
            ))}
          </div>

          <div className="h-10 rounded-xl shimmer"></div>

          <div className="mt-4 flex flex-col gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(6)].map((_, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="h-3 w-24 rounded-full shimmer"></div>
                      <div className="h-4 w-20 rounded-full shimmer"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-2 md:grid-cols-2">
              <Card>
                <CardHeader className="gap-1">
                  <CardTitle className="text-sm">Earnings Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] rounded-xl shimmer"></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="gap-1">
                  <CardTitle className="text-sm">Revenue vs Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] rounded-xl shimmer"></div>
                </CardContent>
              </Card>
            </div>
          </div>

        </>
      )}

      {showChartSection && (
        <>
          <Card className="bg-transparent border-none rounded-none">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <CardDescription className="text-xs">{assetName}</CardDescription>
                {screeningSignal && (
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded-full border border-emerald-700/40 bg-emerald-700/10 px-3 py-1 text-[11px] font-semibold text-emerald-600">
                      BUY SIGNAL
                    </span>
                    {screeningSignalDateLabel && (
                      <span className="rounded-full border border-muted/60 bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground">
                        Signal {screeningSignalDateLabel}
                      </span>
                    )}
                  </div>
                )}
                {marketStateInfo ? (
                  <span className={`flex items-center gap-1 text-[10px] font-medium ${marketStateInfo.tone}`}>
                    {MarketStateIcon ? <MarketStateIcon className="h-3 w-3" /> : null}
                    {marketStateInfo.label}
                  </span>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold">
                        {displayedPrice != null
                          ? displayedPrice.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : '-'}
                      </span>
                      {symbolInfo?.currency && (
                        <span className="text-xs text-muted-foreground">{symbolInfo.currency}</span>
                      )}
                    </div>
                    {displayedChange && (
                      <div className="flex flex-col text-xs">
                        <span
                          className={`font-medium ${
                            displayedChange.value >= 0 ? 'text-emerald-600' : 'text-red-600'
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
                          <span className="text-[10px] text-muted-foreground">
                            {displayedChange.label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Select
                    className="w-full"
                    value={selectedCycles.join(',')}
                    onValueChange={(value) => setSelectedCycles(value.split(','))}
                  >
                    <SelectTrigger className="h-3 text-[11px]">
                      <SelectValue placeholder="Select cycles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem className="text-[11px]" value="normal">
                        Normal
                      </SelectItem>
                      <SelectItem className="text-[11px]" value="all,current">All Years</SelectItem>
                      <SelectItem className="text-[11px]" value="pre,current">Pre-Election</SelectItem>
                      <SelectItem className="text-[11px]" value="election,current">Election</SelectItem>
                      <SelectItem className="text-[11px]" value="post,current">Post-Election</SelectItem>
                      <SelectItem className="text-[11px]" value="mid,current">Mid-Term</SelectItem>
                      {/* <SelectItem value="pre,election,mid,post,current">All Cycles</SelectItem> */}
                    </SelectContent>
                  </Select>
                  {renderScaleButtons()}
                  <div className="flex flex-wrap justify-end gap-1">
                    {renderLivermoreToggle()}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className={isNormalView ? "px-0 pb-0 -mx-4" : "px-0 pb-0 -mr-4"}>
              {isNormalView ? (
                normalSeriesLoading ? (
                  <div className="flex h-[380px] items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading {normalTimeframeLabel} candles…
                  </div>
                ) : filteredNormalChartData.length > 0 ? (
                  <>
                    <div className="relative left-1/2 right-1/2 -translate-x-1/2">
                      <NormalCandlestickChart
                        candles={normalCandlestickSeries.candles}
                        ema={normalCandlestickSeries.ema}
                        meta={normalCandlestickSeries.meta}
                        markers={buySignalMarkers}
                        formatTimestamp={formatNormalTimestamp}
                        currency={symbolInfo?.currency}
                        formatPrice={formatPriceValue}
                        isDark={resolvedTheme === 'dark'}
                        showTimeScale={showIntradayScale}
                        showSeconds={normalTimeframe === '15m'}
                        emaColor={EMA_COLOR}
                        livermoreKey={normalCandlestickSeries.livermore}
                        showLivermoreKey={showLivermoreKey}
                        livermoreUpperColor={LIVERMORE_UPPER_COLOR}
                        livermoreLowerColor={LIVERMORE_LOWER_COLOR}
                        valueLabelPrefix="HA"
                        showTooltip={false}
                        priceScaleType={scaleChoice}
                        height={380}
                      />
                    </div>
                    {/* Stochastic RSI temporarily disabled in the UI
                    {stochasticChartData.length > 0 ? (
                      <div className="relative left-1/2 right-1/2 -translate-x-1/2 pb-4">
                        <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Stochastic RSI</span>
                          <span>14, 14</span>
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                          <ComposedChart data={stochasticChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/70" />
                            <XAxis
                              dataKey="time"
                              tickFormatter={(value) => formatNormalTimestamp(value * 1000)}
                              className="text-[10px]"
                              minTickGap={30}
                            />
                            <YAxis domain={[0, 100]} className="text-[10px]" width={30} allowDecimals={false} />
                            <ReferenceLine y={80} stroke="#f87171" strokeDasharray="4 4" />
                            <ReferenceLine y={20} stroke="#34d399" strokeDasharray="4 4" />
                            <Line key="stoch-k" type="monotone" dataKey="k" stroke="#f97316" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                            <Line key="stoch-d" type="monotone" dataKey="d" stroke="#6366f1" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : null}
                    */}
                  </>
                ) : (
                  <div className="flex h-[380px] items-center justify-center text-xs text-muted-foreground">
                    {normalSeriesError || `Price data unavailable for the ${normalTimeframeLabel} timeframe.`}
                  </div>
                )
              ) : (
                <div className="relative h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                    data={filteredChartData}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <defs>
                      {chartData.linesData.map((line) => {
                        const gradientId = `gradient-${line.key}`;
                        return (
                          <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={line.color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={line.color} stopOpacity={0} />
                          </linearGradient>
                        );
                      })}
                      </defs>
                      <XAxis
                      dataKey="dayOfYear"
                      tickFormatter={formatTick}
                      ticks={quarterFilter === 'all' ? [1, 91, 182, 274] : undefined}
                      className="text-[10px]"
                      height={30}
                    />
                      <YAxis
                      orientation="right"
                      scale={scaleChoice === 'log' ? 'log' : 'linear'}
                      domain={scaleChoice === 'log' ? ['auto', 'auto'] : ['auto', 'auto']}
                      tickFormatter={formatYAxis}
                      className="text-[10px]"
                      width={45}
                      allowDataOverflow={false}
                    />
                      <Tooltip
                      formatter={formatTooltip}
                      labelFormatter={formatTooltipDate}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                      {chartData.linesData.length > 0 ? (
                      <Legend
                        align="left"
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      />
                      ) : null}
                      {chartData.linesData.map((line) => (
                      <Area
                        key={line.key}
                        type="monotone"
                        dataKey={line.key}
                        stroke={line.color}
                        fill={`url(#gradient-${line.key})`}
                        fillOpacity={1}
                        name={line.name}
                        dot={false}
                        strokeWidth={1.5}
                      />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                  <ArunaWatermark className="absolute inset-0 flex items-end justify-start bottom-18 left-4" />
                </div>
              )}
            </CardContent>
          </Card>

          {isNormalView ? (
            <>
              <div className="flex flex-wrap justify-center items-center gap-1">
                {renderTimeframeButtons({ includeFullscreenToggle: true })}
              </div>
              <Dialog open={normalFullscreenOpen} onOpenChange={setNormalFullscreenOpen}>
                <DialogContent
                  className="fixed max-w-none h-screen rounded-none p-0 flex flex-col"
                  onEscapeKeyDown={(event) => event.preventDefault()}
                  onPointerDownOutside={(event) => event.preventDefault()}
                  showCloseButton={false}
                >
                  <div className="flex flex-col gap-1 justify-center items-center border-b py-4 text-center">
                    <div
                      className="absolute top-5 left-5"
                      onClick={() => setNormalFullscreenOpen(false)}
                    >
                      <ArrowLeft className="size-6 text-muted-foreground"/>
                    </div>
                    <DialogTitle className="text-sm font-semibold leading-none">
                      {symbol}
                    </DialogTitle>
                    <span className="text-muted-foreground text-xs">{assetName}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center justify-between gap-2">
                      {renderScaleButtons()}
                      <div className="flex flex-wrap gap-1">
                        {renderLivermoreToggle()}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center items-center gap-1">{renderTimeframeButtons()}</div>
                  </div>
                  <div>
                    <NormalCandlestickChart
                      candles={normalCandlestickSeries.candles}
                      ema={normalCandlestickSeries.ema}
                      meta={normalCandlestickSeries.meta}
                      markers={buySignalMarkers}
                      formatTimestamp={formatNormalTimestamp}
                      currency={symbolInfo?.currency}
                      formatPrice={formatPriceValue}
                      isDark={resolvedTheme === 'dark'}
                      showTimeScale={showIntradayScale}
                      showSeconds={normalTimeframe === '15m'}
                      emaColor={EMA_COLOR}
                      livermoreKey={normalCandlestickSeries.livermore}
                      showLivermoreKey={showLivermoreKey}
                      livermoreUpperColor={LIVERMORE_UPPER_COLOR}
                      livermoreLowerColor={LIVERMORE_LOWER_COLOR}
                      valueLabelPrefix="HA"
                      showTooltip={false}
                      priceScaleType={scaleChoice}
                      height={650}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2">
              {['all', 'Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                <button
                  key={q}
                  className={`w-16 h-6 text-xs font-semibold rounded-sm border-1.5 transition-colors ${
                    quarterFilter === q
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'
                  }`}
                  onClick={() => setQuarterFilter(q)}
                >
                  {q === 'all' ? 'All' : q}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {hasPortfolioPosition && (
              <Card className="overflow-hidden border border-border/70">
                <div
                  className={`flex flex-col gap-3 border-l-4 px-4 py-4 ${
                    portfolioPosition.pnl != null && portfolioPosition.pnl < 0
                      ? 'border-red-600 bg-red-600/5'
                      : 'border-emerald-700 bg-emerald-700/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Your Portfolio in {symbol}
                      </p>
                      <p className="text-xl font-semibold">
                        {portfolioPosition.marketValue != null
                          ? `${formatDetailedCurrency(portfolioPosition.marketValue)} ${currencyCode}`
                          : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Market Value</p>
                    </div>
                    {portfolioPosition.pnlPct != null && (
                      <span
                        className={`text-xs font-semibold ${
                          portfolioPosition.pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatPercentage(portfolioPosition.pnlPct)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-border/50 bg-background px-4 py-3 text-sm font-semibold">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Average Price</p>
                    <p>
                      {portfolioPosition.averagePrice != null
                        ? `${formatDetailedCurrency(portfolioPosition.averagePrice)} ${currencyCode}`
                        : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">PNL</p>
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
                if (!isAuthenticated) {
                  redirectToSignIn();
                  return;
                }
                setPortfolioDialogOpen(true);
              }}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-xs text-white/80"
            >
              Add to Your Portfolio
            </Button>
          </div>

          {(fundamentalsLoading || fundamentals || cycleSummary || quarterlyHeatmap.rows.length > 0 || monthlyHeatmap.rows.length > 0) && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2 border-b border-border/50 text-xs">
                {infoTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`px-2 py-2 uppercase font-semibold transition-colors ${
                      infoTab === tab.value
                        ? 'text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-700 dark:border-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setInfoTab(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div>
                {infoTab === 'profile' && renderProfileTab()}
                {infoTab === 'keystats' && renderKeyStatsTab()}
                {infoTab === 'analysis' && renderAnalysisTab()}
                {infoTab === 'seasonality' && renderSeasonalityTab()}
              </div>
            </div>
          )}

        </>
      )}

      <AddAssetModal 
        open={portfolioDialogOpen && isAuthenticated} 
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPortfolioDialogOpen(false);
            return;
          }
          if (!isAuthenticated) {
            redirectToSignIn();
            return;
          }
          setPortfolioDialogOpen(true);
        }}
        initialSymbol={symbol}
        onSave={async (entry) => {
          if (!isAuthenticated) {
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
