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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, ErrorBar, ReferenceLine } from 'recharts';
import { Loader2, Sun, MoonStar, Clock3, Star, Lock, Bitcoin, Crown } from "lucide-react";
import { useTheme } from 'next-themes';
import { AddAssetModal } from "@/components/add-asset-modal";
import { SymbolSearchDialog } from "@/components/header-symbol-search";
import { useAuth } from "@/components/auth-provider";
import { NormalCandlestickChart } from "@/components/normal-candlestick-chart";

const CURRENT_LINE_COLOR = 'oklch(59.6% 0.145 163.225)';
const WATCHLIST_STORAGE_KEY = 'aruna_watchlist';
const WATCHLIST_UPDATED_AT_KEY = 'aruna_watchlist_updated_at';
const DEFAULT_WATCHLIST = [
  { symbol: 'BBCA.JK', order: 1 },
  { symbol: 'BTC-USD', order: 2 },
  { symbol: 'QQQ', order: 3 },
  { symbol: 'SPY', order: 4 },
  { symbol: 'NVDA', order: 5 },
  { symbol: 'MSFT', order: 6 },
  { symbol: 'AMZN', order: 7 },
  { symbol: 'GOOG', order: 8 },
  { symbol: 'AVGO', order: 9 },
];

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

function readWatchlist() {
  if (typeof window === 'undefined') return DEFAULT_WATCHLIST;
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
      window.localStorage.setItem(WATCHLIST_UPDATED_AT_KEY, new Date().toISOString());
      return DEFAULT_WATCHLIST;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => item && typeof item.symbol === 'string' && typeof item.order === 'number'
      );
    }
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(DEFAULT_WATCHLIST));
    window.localStorage.setItem(WATCHLIST_UPDATED_AT_KEY, new Date().toISOString());
    return DEFAULT_WATCHLIST;
  } catch (error) {
    console.warn('Failed to read watchlist', error);
    return DEFAULT_WATCHLIST;
  }
}

function writeWatchlist(data, updatedAt) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(data));
    window.localStorage.setItem(
      WATCHLIST_UPDATED_AT_KEY,
      typeof updatedAt === 'string' ? updatedAt : new Date().toISOString()
    );
  } catch (error) {
    console.warn('Failed to write watchlist', error);
  }
}

function readWatchlistUpdatedAt() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(WATCHLIST_UPDATED_AT_KEY);
}

const cycleMetaMap = {
  all: { label: 'All Years', lineKey: 'allYears' },
  pre: { label: 'Pre-Election Year', lineKey: 'preElection' },
  election: { label: 'Election Year', lineKey: 'election' },
  mid: { label: 'Mid-Term Year', lineKey: 'midTerm' },
  post: { label: 'Post-Election Year', lineKey: 'postElection' },
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const NORMAL_RANGE_OPTIONS = [
  { value: '1D', label: '1D', days: 1 },
  { value: '1W', label: '1W', days: 7 },
  { value: '1M', label: '1M', days: 30 },
  { value: '3M', label: '3M', days: 90 },
  { value: 'YTD', label: 'YTD', type: 'ytd' },
  { value: '1Y', label: '1Y', days: 365 },
  { value: '3Y', label: '3Y', days: 365 * 3 },
  { value: '5Y', label: '5Y', days: 365 * 5 },
];

const EMA_PERIOD = 32;
const EMA_COLOR = '#0ea5e9';

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
    remoteWatchlistUpdatedAt,
    watchlistLoaded,
    syncWatchlist,
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
  const [normalRange, setNormalRange] = useState('YTD');
  const [normalSeries, setNormalSeries] = useState([]);
  const [normalSeriesLoading, setNormalSeriesLoading] = useState(false);
  const [normalSeriesError, setNormalSeriesError] = useState(null);
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {} });
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistUpdatedAt, setWatchlistUpdatedAt] = useState(() => readWatchlistUpdatedAt());
  const [screeningSignal, setScreeningSignal] = useState(null);
  const remoteWatchlistSeedRef = React.useRef(false);

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
    if (typeof window === 'undefined') return;
    setWatchlist(readWatchlist());
    setWatchlistUpdatedAt(readWatchlistUpdatedAt());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      const local = readWatchlist();
      if (!areWatchlistsEqual(local, watchlist)) {
        setWatchlist(local);
      }
      const localUpdatedAt = readWatchlistUpdatedAt();
      if (localUpdatedAt !== watchlistUpdatedAt) {
        setWatchlistUpdatedAt(localUpdatedAt);
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
      const timestamp = remoteWatchlistUpdatedAt || null;
      if (timestamp !== watchlistUpdatedAt) {
        setWatchlistUpdatedAt(timestamp);
      }
      return;
    }

    if (!remoteWatchlistSeedRef.current) {
      remoteWatchlistSeedRef.current = true;
      const defaults = DEFAULT_WATCHLIST;
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
    remoteWatchlistUpdatedAt,
    watchlist,
    watchlistUpdatedAt,
    syncWatchlist,
  ]);

  useEffect(() => {
    fetchDataAndBuildChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, selectedCycles]);

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
        const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) {
          throw new Error('Failed to load fundamentals');
        }
        const data = await res.json();
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

      const response = await fetch(
        `/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const json = await response.json();
      let rawData = json.data.map(row => ({
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

      const symbolName = json.meta?.name || symbol;
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

      const marketState = json.meta?.marketState ? String(json.meta.marketState).toUpperCase() : 'CLOSED';
      const isMarketOpen = ['REGULAR', 'OPEN', 'TRADING'].some(state => marketState.includes(state));

      setSymbolInfo({
        name: symbolName,
        currentPrice,
        predictedPrice,
        predictedPct,
        dailyChange,
        dailyChangePct,
        isMarketOpen,
        currency: json.meta?.currency,
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
        const res = await fetch(
          `/api/price-series?symbol=${encodeURIComponent(symbol)}&range=${normalRange}`,
          { signal: controller.signal }
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load price data');
        }
        if (!cancelled) {
          setNormalSeries(Array.isArray(payload?.data) ? payload.data : []);
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
  }, [symbol, normalRange, isNormalView]);

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

    const multiplier = 2 / (EMA_PERIOD + 1);
    let emaValue = null;
    const baseTimestamp = sorted[0].timestamp;
    const firstClose =
      typeof sorted[0].close === 'number' && Number.isFinite(sorted[0].close)
        ? sorted[0].close
        : typeof sorted[0].price === 'number' && Number.isFinite(sorted[0].price)
          ? sorted[0].price
          : null;

    let prevHeikinOpen = null;
    let prevHeikinClose = null;

    return sorted
      .map((point) => {
        const close =
          typeof point.close === 'number' && Number.isFinite(point.close)
            ? point.close
            : typeof point.price === 'number' && Number.isFinite(point.price)
              ? point.price
              : null;
        if (close == null) {
          return null;
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

        if (emaValue == null) {
          emaValue = close;
        } else {
          emaValue = close * multiplier + emaValue * (1 - multiplier);
        }

        const changePct =
          firstClose && firstClose !== 0 ? ((close - firstClose) / firstClose) * 100 : null;

        return {
          timestamp: point.timestamp,
          elapsed: point.timestamp - baseTimestamp,
          price: close,
          open,
          high,
          low,
          close,
          changePct,
          ema32: emaValue,
          interpolated: false,
          volume:
            typeof point.volume === 'number' && Number.isFinite(point.volume)
              ? point.volume
              : null,
          heikinOpen,
          heikinHigh,
          heikinLow,
          heikinClose,
        };
      })
      .filter(Boolean);
  }, [isNormalView, normalSeries]);

  const latestNormalPoint =
    filteredNormalChartData.length > 0
      ? filteredNormalChartData[filteredNormalChartData.length - 1]
      : null;

  const normalRangeChange = useMemo(() => {
    if (!isNormalView || filteredNormalChartData.length < 2) {
      return null;
    }
    const actualPoints = filteredNormalChartData.filter((point) => !point.interpolated);
    const firstPoint = actualPoints[0] ?? filteredNormalChartData[0];
    const lastPoint = filteredNormalChartData[filteredNormalChartData.length - 1];
    if (
      !firstPoint ||
      !lastPoint ||
      typeof firstPoint.price !== 'number' ||
      typeof lastPoint.price !== 'number'
    ) {
      return null;
    }
    const changeValue = lastPoint.price - firstPoint.price;
    const changePct =
      firstPoint.price !== 0 ? (changeValue / firstPoint.price) * 100 : null;
    return {
      value: changeValue,
      pct: changePct,
    };
  }, [filteredNormalChartData, isNormalView]);

  const displayedPrice =
    isNormalView && typeof latestNormalPoint?.price === 'number'
      ? latestNormalPoint.price
      : symbolInfo?.currentPrice ?? null;

  const displayedChange = useMemo(() => {
    if (isNormalView && normalRangeChange) {
      return {
        value: normalRangeChange.value,
        pct: normalRangeChange.pct,
        label: `${normalRange} change`,
      };
    }
    if (
      !isNormalView &&
      symbolInfo?.dailyChange != null &&
      symbolInfo?.dailyChangePct != null
    ) {
      return {
        value: symbolInfo.dailyChange,
        pct: symbolInfo.dailyChangePct,
        label: 'Daily change',
      };
    }
    return null;
  }, [isNormalView, normalRange, normalRangeChange, symbolInfo]);

  const normalCandlestickSeries = useMemo(() => {
    if (!isNormalView || filteredNormalChartData.length === 0) {
      return { candles: [], ema: [], meta: {}, stochastic: { k: [], d: [] } };
    }
    const candles = [];
    const ema = [];
    const meta = {};
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

    return { candles, ema, meta, stochastic: { k: stochasticK, d: stochasticD } };
  }, [filteredNormalChartData, isNormalView]);

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

  const isIntradayRange = normalRange === '1D' || normalRange === '1W';

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
      if (normalRange === '1D') {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      if (normalRange === '1W') {
        return date.toLocaleString('en-US', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
      const options =
        normalRange === '3Y' || normalRange === '5Y'
          ? { month: 'short', year: 'numeric' }
          : { month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    },
    [normalRange]
  );

  const formatPriceValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '-';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const currencyCode = fundamentals?.profile?.currency || symbolInfo?.currency || 'USD';

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

  const analysisCurrency = fundamentals?.analysis?.currency || currencyCode;

  const formatPeriodLabel = useCallback((period) => {
    if (!period) return '';
    const upper = String(period).toUpperCase();
    if (/FY\d{2,4}/.test(upper)) return upper.replace(/ /g, ' ');
    if (/Q\d/.test(upper) && /FY/.test(upper)) return upper;
    if (/^\d{4}$/.test(upper)) return `FY ${upper.slice(-2)}`;
    return upper.replace(/(\d{4})/g, ' FY$1').replace(/\s+/g, ' ').trim();
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
    return <circle cx={cx} cy={cy} r={7} fill={primaryChartColor} />;
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

  const persistWatchlist = useCallback(
    (nextList, timestampOverride) => {
      if (isAuthenticated) {
        syncWatchlist(nextList)
          .then((remoteTimestamp) => {
            if (remoteTimestamp) {
              setWatchlistUpdatedAt(remoteTimestamp);
            }
          })
          .catch(() => {});
      } else {
        const timestamp = timestampOverride ?? new Date().toISOString();
        writeWatchlist(nextList, timestamp);
        setWatchlistUpdatedAt(timestamp);
      }
    },
    [isAuthenticated, syncWatchlist]
  );

  const marketStateInfo = useMemo(() => {
    const stateRaw = fundamentals?.profile?.marketState;
    if (!stateRaw) {
      if (symbolInfo?.isMarketOpen) {
        return { label: 'Market Open', tone: 'text-emerald-700 dark:text-emerald-500', Icon: Sun };
      }
      return null;
    }
    const state = String(stateRaw).toUpperCase();
    if (state.includes('REGULAR') || state === 'OPEN') {
      return { label: 'Market Open', tone: 'text-emerald-700 dark:text-emerald-500', Icon: Sun };
    }
    if (state.includes('PRE')) {
      return { label: 'Pre-Market', tone: 'text-amber-500', Icon: Clock3 };
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
      persistWatchlist(next);
      return next;
    });
  }, [symbol, persistWatchlist]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className="text-base font-bold uppercase cursor-pointer transition-colors hover:text-primary"
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
            {symbol}
          </h1>
          <span className="text-muted">|</span>
          {symbol.endsWith('.JK') && (
            <span className="dark:text-white/70 text-xs">🇮🇩 IDX</span>
          )}
          {symbol.endsWith('-USD') && (
            <span className="dark:text-white/70 text-xs flex items-center gap-1"><Bitcoin className="size-4"/> to the moon</span>
          )}
          {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
            <span className="dark:text-white/70 text-xs">🇺🇸 Pension Fund</span>
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
          className={`rounded-full p-1 transition-colors ${isFavorite ? 'text-amber-500 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
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
            <CardContent className="px-0 -mx-5 pb-0">
              <div className="w-full h-[280px] rounded-lg shimmer"></div>
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
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600">
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
                      <SelectItem className="text-[11px]" value="pre,current">Pre-Election</SelectItem>
                      <SelectItem className="text-[11px]" value="election,current">Election</SelectItem>
                      <SelectItem className="text-[11px]" value="mid,current">Mid-Term</SelectItem>
                      <SelectItem className="text-[11px]" value="post,current">Post-Election</SelectItem>
                      <SelectItem className="text-[11px]" value="all,current">All Years</SelectItem>
                      {/* <SelectItem value="pre,election,mid,post,current">All Cycles</SelectItem> */}
                    </SelectContent>
                  </Select>
                  {!isNormalView && (
                    <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
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
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className={isNormalView ? "px-0 pb-0" : "px-0 pb-0 -mr-5"}>
              {isNormalView ? (
                normalSeriesLoading ? (
                  <div className="flex h-[400px] items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading {normalRange} prices…
                  </div>
                ) : filteredNormalChartData.length > 0 ? (
                  <>
                    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2">
                      <NormalCandlestickChart
                        candles={normalCandlestickSeries.candles}
                        ema={normalCandlestickSeries.ema}
                        meta={normalCandlestickSeries.meta}
                        formatTimestamp={formatNormalTimestamp}
                        currency={symbolInfo?.currency}
                        formatPrice={formatPriceValue}
                        isDark={resolvedTheme === 'dark'}
                        showTimeScale={isIntradayRange}
                        showSeconds={normalRange === '1D'}
                        emaColor={EMA_COLOR}
                        valueLabelPrefix="HA"
                        showTooltip={false}
                        height={400}
                      />
                    </div>
                    {/* {stochasticChartData.length > 0 ? (
                      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 pb-4">
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
                            <Line type="monotone" dataKey="k" stroke="#f97316" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                            <Line type="monotone" dataKey="d" stroke="#6366f1" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : null} */}
                  </>
                ) : (
                  <div className="flex h-[400px] items-center justify-center text-xs text-muted-foreground">
                    {normalSeriesError || 'Intraday price data unavailable for this range.'}
                  </div>
                )
              ) : (
                <ResponsiveContainer width="100%" height={280}>
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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
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
              )}
            </CardContent>
          </Card>

          {isNormalView ? (
            <div className="flex flex-wrap justify-center gap-2">
              {NORMAL_RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={normalRange === option.value ? 'default' : 'ghost'}
                  className={`rounded-sm px-2 w-8 font-bold py-0 text-[11px] uppercase tracking-wider ${
                    normalRange === option.value
                      ? 'bg-emerald-700 text-white/80 shadow-sm'
                      : 'border-border/70 text-muted-foreground'
                  }`}
                  onClick={() => setNormalRange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
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

          <Button 
            onClick={() => setPortfolioDialogOpen(true)}
            className="mt-2 w-full bg-emerald-700 hover:bg-emerald-800 font-semibold text-xs text-white/80"
          >
            Add to Your Portfolio
          </Button>

          {(fundamentalsLoading || fundamentals || cycleSummary) && (
            <div className="mt-4 flex flex-col gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {fundamentalsLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[...Array(6)].map((_, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="h-3 w-24 rounded-full shimmer"></div>
                          <div className="h-4 w-20 rounded-full shimmer"></div>
                        </div>
                      ))}
                    </div>
                  ) : summaryStats.length > 0 ? (
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

              {fundamentalsLoading ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <Card className="h-full">
                    <CardHeader>
                      <div className="h-4 w-32 rounded-full shimmer"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[220px] rounded-xl shimmer"></div>
                    </CardContent>
                  </Card>
                  <Card className="h-full">
                    <CardHeader>
                      <div className="h-4 w-32 rounded-full shimmer"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[220px] rounded-xl shimmer"></div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                (hasEarningsAnalysis || hasRevenueAnalysis) && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {hasEarningsAnalysis && latestEarningsPoint && (
                      <div className="relative">
                        <Card
                          className={`h-full ${
                            !isAuthenticated
                              ? 'pointer-events-none select-none opacity-60 blur-[1.5px]'
                              : ''
                          }`}
                        >
                          <CardHeader className="gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <CardTitle className="text-sm">Earnings Results</CardTitle>
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
                                  type="monotone"
                                  dataKey="estimate"
                                  stroke="transparent"
                                  dot={renderEstimateDot}
                                  activeDot={false}
                                />
                                <Line
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
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-xs px-6 text-center">
                            <Lock className="h-6 w-6 text-muted-foreground" />
                            <p className="text-xs font-semibold text-muted-foreground">
                              Sign in to view detailed earnings results
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {hasRevenueAnalysis && latestRevenuePoint && (
                      <div className="relative">
                        <Card
                          className={`h-full ${
                            !isAuthenticated
                              ? 'pointer-events-none select-none opacity-60 blur-[1.5px]'
                              : ''
                          }`}
                        >
                          <CardHeader className="gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <CardTitle className="text-sm">Revenue vs Earnings</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">
                                    {formatPeriodLabel(latestRevenuePoint.period)}
                                  </span>{' '}
                                  •{' '}
                                  <span style={{ color: primaryChartColor }}>
                                    Revenue {formatRevenueValue(latestRevenuePoint.revenue)}
                                  </span>{' '}
                                  •{' '}
                                  <span style={{ color: secondaryChartColor }}>
                                    Earnings {formatRevenueValue(latestRevenuePoint.earnings)}
                                  </span>
                                </p>
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
                                  labelFormatter={(_, payload) =>
                                    payload?.[0]?.payload?.periodLabel || ''
                                  }
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
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-xs px-6 text-center">
                            <Lock className="h-6 w-6 text-muted-foreground" />
                            <p className="text-xs font-semibold text-muted-foreground">
                              Sign in to compare revenue and earnings
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

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
                            {[1, 2, 3, 4].map(quarter => {
                              const value = row[`Q${quarter}`];
                              const cellClass = getReturnCellClass(value);
                              return (
                                <td
                                  key={quarter}
                                  className={`text-center py-2 px-2 ${cellClass}`}
                                >
                                  {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold bg-muted/50">
                          <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg.</td>
                          {[1, 2, 3, 4].map(quarter => {
                            const value = quarterlyHeatmap.average[`Q${quarter}`];
                            const cellClass = getReturnCellClass(value);
                            return (
                              <td
                                key={quarter}
                                className={`text-center py-2 px-2 ${cellClass}`}
                              >
                                {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {!isAuthenticated && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-xs px-6 text-center">
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
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                              const value = row[`M${month}`];
                              const cellClass = getReturnCellClass(value);
                              return (
                                <td
                                  key={month}
                                  className={`text-center py-2 px-1 ${cellClass}`}
                                >
                                  {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold bg-muted/50">
                          <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg.</td>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                            const value = monthlyHeatmap.average[`M${month}`];
                            const cellClass = getReturnCellClass(value);
                            return (
                              <td
                                key={month}
                                className={`text-center py-2 px-1 ${cellClass}`}
                              >
                                {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {!isAuthenticated && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/40 backdrop-blur-xs px-6 text-center">
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

        </>
      )}

      <AddAssetModal 
        open={portfolioDialogOpen} 
        onOpenChange={setPortfolioDialogOpen}
        initialSymbol={symbol}
        onSave={(entry) => {
          // Load existing portfolio
          let portfolio = [];
          try {
            const raw = localStorage.getItem('aruna_portfolio');
            portfolio = raw ? JSON.parse(raw) : [];
          } catch (e) {
            console.warn('Failed to load portfolio', e);
          }
          
          // Add new entry
          portfolio.push(entry);
          
          // Save back to localStorage
          try {
            localStorage.setItem('aruna_portfolio', JSON.stringify(portfolio));
            setPortfolioDialogOpen(false);
            router.push('/portfolio-tracker');
          } catch (e) {
            console.warn('Failed to save portfolio', e);
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
