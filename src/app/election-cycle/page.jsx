"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, ErrorBar } from 'recharts';
import { Loader2, Sun, MoonStar, Clock3, Star, Lock } from "lucide-react";
import { useTheme } from 'next-themes';
import { AddAssetModal } from "@/components/add-asset-modal";
import { SymbolSearchDialog } from "@/components/header-symbol-search";
import { useAuth } from "@/components/auth-provider";

const CURRENT_LINE_COLOR = 'oklch(59.6% 0.145 163.225)';
const WATCHLIST_STORAGE_KEY = 'aruna_watchlist';
const WATCHLIST_UPDATED_AT_KEY = 'aruna_watchlist_updated_at';
const DEFAULT_WATCHLIST = [
  { symbol: 'NVDA', order: 1 },
  { symbol: 'MSFT', order: 2 },
  { symbol: 'AMZN', order: 3 },
  { symbol: 'GOOG', order: 4 },
  { symbol: 'AVGO', order: 5 },
  { symbol: 'BBCA.JK', order: 6 },
  { symbol: 'BBRI.JK', order: 7 },
  { symbol: 'BTC-USD', order: 8 },
];

const PRICE_TIMEFRAMES = ['1D', '1W', '1M', '3M', 'YTD', '1Y', '3Y', '5Y'];

const PRICE_TIMEFRAME_CONFIG = {
  '1D': { days: 2, interval: '15m' },
  '1W': { days: 8, interval: '1h' },
  '1M': { days: 35, interval: '1h' },
  '3M': { days: 110, interval: '1d' },
  YTD: { startOfYear: true, interval: '1d' },
  '1Y': { days: 370, interval: '1d' },
  '3Y': { days: 365 * 3 + 30, interval: '1wk' },
  '5Y': { days: 365 * 5 + 60, interval: '1wk' },
};

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

function resolvePriceRange(timeframe) {
  const now = new Date();
  const config = PRICE_TIMEFRAME_CONFIG[timeframe] ?? PRICE_TIMEFRAME_CONFIG['3M'];
  let start;
  if (config.startOfYear) {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (config.days) {
    start = new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000);
  } else {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }

  return {
    start,
    end: now,
    interval: config.interval,
  };
}

function ElectionCyclePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const {
    user,
    remoteWatchlist,
    remoteWatchlistUpdatedAt,
    watchlistLoaded,
    syncWatchlist,
  } = useAuth();
  const isAuthenticated = Boolean(user);
  const symbolParam = searchParams.get('symbol');
  const LAST_SYMBOL_KEY = 'aruna_last_election_symbol';
  const getInitialSymbol = () => {
    if (symbolParam) return symbolParam;
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem(LAST_SYMBOL_KEY);
      if (last) return last;
    }
    return 'MSFT';
  };
  const [symbol, setSymbol] = useState(getInitialSymbol);
  const [scaleChoice, setScaleChoice] = useState('linear');
  const [loading, setLoading] = useState(false);
  const [rawLinesData, setRawLinesData] = useState([]);
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {} });
  const [priceTimeframe, setPriceTimeframe] = useState('3M');
  const [priceSeries, setPriceSeries] = useState([]);
  const [priceSeriesLoading, setPriceSeriesLoading] = useState(false);
  const [priceError, setPriceError] = useState(null);
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistUpdatedAt, setWatchlistUpdatedAt] = useState(() => readWatchlistUpdatedAt());
  const remoteWatchlistSeedRef = React.useRef(false);
  const priceRequestRef = React.useRef(0);

  const deriveDefaultCycles = () => {
    const y = new Date().getFullYear();
    const label = getElectionCycleLabel(y);
    const mapping = {
      'Pre-Election Year': 'pre',
      'Election Year': 'election',
      'Mid-Term Year': 'mid',
      'Post-Election Year': 'post',
    };
    const key = mapping[label];
    return [key, 'current'];
  };
  const [selectedCycles, setSelectedCycles] = useState(deriveDefaultCycles());

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
    if (symbolParam) {
      setSymbol(symbolParam);
    }
  }, [symbolParam]);

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
    if (!user) {
      remoteWatchlistSeedRef.current = false;
      const local = readWatchlist();
      const localSerialized = JSON.stringify(local);
      const currentSerialized = JSON.stringify(watchlist);
      if (currentSerialized !== localSerialized) {
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

    if (Array.isArray(remoteWatchlist) && remoteWatchlist.length > 0) {
      remoteWatchlistSeedRef.current = false;
      const timestamp = remoteWatchlistUpdatedAt || new Date().toISOString();
      const currentSerialized = JSON.stringify(watchlist);
      const remoteSerialized = JSON.stringify(remoteWatchlist);
      if (currentSerialized !== remoteSerialized) {
        setWatchlist(remoteWatchlist);
        writeWatchlist(remoteWatchlist, timestamp);
      } else {
        const storedUpdatedAt = readWatchlistUpdatedAt();
        if (storedUpdatedAt !== timestamp) {
          writeWatchlist(remoteWatchlist, timestamp);
        }
      }
      if (watchlistUpdatedAt !== timestamp) {
        setWatchlistUpdatedAt(timestamp);
      }
      return;
    }

    if (!remoteWatchlistSeedRef.current) {
      remoteWatchlistSeedRef.current = true;
      const defaults = DEFAULT_WATCHLIST;
      const timestamp = new Date().toISOString();
      const currentSerialized = JSON.stringify(watchlist);
      const defaultsSerialized = JSON.stringify(defaults);
      if (currentSerialized !== defaultsSerialized) {
        setWatchlist(defaults);
        writeWatchlist(defaults, timestamp);
      } else {
        const storedUpdatedAt = readWatchlistUpdatedAt();
        if (storedUpdatedAt !== timestamp) {
          writeWatchlist(defaults, timestamp);
        }
      }
      if (watchlistUpdatedAt !== timestamp) {
        setWatchlistUpdatedAt(timestamp);
      }
      syncWatchlist(defaults)
        .then((remoteTimestamp) => {
          remoteWatchlistSeedRef.current = false;
          if (remoteTimestamp) {
            if (watchlistUpdatedAt !== remoteTimestamp) {
              setWatchlistUpdatedAt(remoteTimestamp);
            }
            writeWatchlist(defaults, remoteTimestamp);
          }
        })
        .catch(() => {
          remoteWatchlistSeedRef.current = false;
        });
    }
  }, [
    user,
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

  const loadPriceSeries = useCallback(
    async (timeframe) => {
      const requestId = ++priceRequestRef.current;
      setPriceSeriesLoading(true);
      setPriceError(null);
      try {
        const { start, end, interval } = resolvePriceRange(timeframe);
        const startDate = Math.floor(start.getTime() / 1000);
        const endDate = Math.floor(end.getTime() / 1000);
        const params = new URLSearchParams({
          symbol,
          startDate: String(startDate),
          endDate: String(endDate),
          interval,
        });

        const response = await fetch(`/api/finance?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load price history');
        }

        const json = await response.json();
        const data = Array.isArray(json?.data) ? json.data : [];

        const cleaned = data
          .map((row) => {
            const timestamp = new Date(row.date);
            const priceRaw =
              typeof row?.adjclose === 'number'
                ? row.adjclose
                : typeof row?.close === 'number'
                  ? row.close
                  : null;
            if (!timestamp || Number.isNaN(timestamp.valueOf()) || priceRaw == null) {
              return null;
            }
            return { timestamp: timestamp.getTime(), price: priceRaw };
          })
          .filter(Boolean)
          .sort((a, b) => a.timestamp - b.timestamp);

        if (priceRequestRef.current !== requestId) {
          return;
        }

        setPriceSeries(cleaned);
      } catch (error) {
        if (priceRequestRef.current !== requestId) {
          return;
        }
        console.warn('Failed to load price series', error);
        setPriceSeries([]);
        setPriceError(error.message || 'Failed to load price history');
      } finally {
        if (priceRequestRef.current === requestId) {
          setPriceSeriesLoading(false);
        }
      }
    },
    [symbol]
  );

  useEffect(() => {
    loadPriceSeries(priceTimeframe);
  }, [loadPriceSeries, priceTimeframe]);

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

  const filteredChartData = quarterFilter === 'all'
    ? chartData.chartArray
    : chartData.chartArray.filter(item => {
        const [start, end] = getQuarterDateRange(quarterFilter);
        return item.dayOfYear >= start && item.dayOfYear <= end;
      });

  const formatTooltipDate = (dayOfYear) => {
    const date = new Date(2000, 0, 1);
    date.setDate(date.getDate() + dayOfYear - 1);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const priceStats = useMemo(() => {
    if (!priceSeries || priceSeries.length === 0) return null;
    const first = priceSeries[0];
    const last = priceSeries[priceSeries.length - 1];
    if (!first || !last) return null;
    const change = last.price - first.price;
    const changePct = first.price ? (change / first.price) * 100 : 0;
    return { first, last, change, changePct };
  }, [priceSeries]);

  const priceLineColor = priceStats && priceStats.change < 0 ? 'rgb(220, 38, 38)' : 'rgb(22, 163, 74)';

  const priceTickFormatter = useCallback(
    (value) => {
      if (value == null) return '';
      const date = new Date(value);
      if (Number.isNaN(date.valueOf())) return '';
      if (priceTimeframe === '1D') {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      }
      if (priceTimeframe === '1W') {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      }
      if (priceTimeframe === '1M' || priceTimeframe === '3M') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      if (priceTimeframe === 'YTD' || priceTimeframe === '1Y') {
        return date.toLocaleDateString('en-US', { month: 'short' });
      }
      return date.toLocaleDateString('en-US', { year: 'numeric' });
    },
    [priceTimeframe]
  );

  const priceTooltipLabelFormatter = useCallback(
    (value) => {
      if (value == null) return '';
      const date = new Date(value);
      if (Number.isNaN(date.valueOf())) return '';
      if (priceTimeframe === '1D') {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
      if (priceTimeframe === '1W') {
        return date.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
      if (priceTimeframe === '1M' || priceTimeframe === '3M') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    },
    [priceTimeframe]
  );

  const priceYAxisFormatter = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '';
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 0,
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
        strokeWidth={2}
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
      const timestamp = timestampOverride ?? new Date().toISOString();
      writeWatchlist(nextList, timestamp);
      setWatchlistUpdatedAt(timestamp);

      if (user) {
        syncWatchlist(nextList)
          .then((remoteTimestamp) => {
            if (remoteTimestamp) {
              setWatchlistUpdatedAt(remoteTimestamp);
              writeWatchlist(nextList, remoteTimestamp);
            }
          })
          .catch(() => {});
      }
    },
    [user, syncWatchlist]
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
      return { label: 'Market Open', tone: 'text-emerald-600 dark:text-emerald-400', Icon: Sun };
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
            <span className="text-white/70 text-xs">🇮🇩 Hey antek-antek asing!</span>
          )}
          {symbol.endsWith('-USD') && (
            <span className="text-white/70 text-xs">🚀 To the moon (katanya)</span>
          )}
          {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
            <span className="text-white/70 text-xs">🇺🇸 Dana Pensiun PNS Amerika</span>
          )}
          {['AAPL','MSFT','GOOGL','GOOG','AMZN','META','NVDA','TSLA'].some((s) => symbol.endsWith(s)) && (
            <span className="text-white/70 text-xs">🧰 Magnificent 7</span>
          )}
        </div>
        {/* star add to favorites di sini */}
        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${symbol} from favorites` : `Add ${symbol} to favorites`}
          className={`rounded-full p-1 transition-colors ${isFavorite ? 'text-amber-500 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Star
            className="size-5"
            strokeWidth={isFavorite ? 1.5 : 2}
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      {loading && (
        <>
          <Card className="overflow-hidden bg-transparent border-none rounded-none">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-muted animate-pulse"></div>
                  <div className="h-8 w-32 rounded bg-muted animate-pulse"></div>
                  <div className="h-4 w-24 rounded bg-muted animate-pulse"></div>
                  <div className="h-4 w-20 rounded bg-muted animate-pulse"></div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-6 w-40 rounded bg-muted animate-pulse"></div>
                  <div className="h-6 w-32 rounded bg-muted animate-pulse"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 -mr-5 pb-0">
              <div className="w-full h-[280px] bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex-1 h-7 bg-muted rounded-md animate-pulse"></div>
            ))}
          </div>

          <div className="h-10 bg-muted rounded-md animate-pulse"></div>

          <div className="mt-4 flex flex-col gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(6)].map((_, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="h-3 w-24 rounded bg-muted animate-pulse"></div>
                      <div className="h-4 w-20 rounded bg-muted animate-pulse"></div>
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
                  <div className="h-[240px] rounded-lg bg-muted animate-pulse"></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="gap-1">
                  <CardTitle className="text-sm">Revenue vs Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] rounded-lg bg-muted animate-pulse"></div>
                </CardContent>
              </Card>
            </div>
          </div>

        </>
      )}

      {!loading && (
        <>
          <Card className="overflow-hidden bg-transparent border-none rounded-none">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-sm">Normal (Price)</CardTitle>
                  {priceStats ? (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xl font-bold">
                        {priceStats.last.price.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-xs text-muted-foreground">{currencyCode}</span>
                      <span
                        className={`text-xs font-medium ${
                          priceStats.change >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {priceStats.change >= 0 ? '+' : ''}
                        {priceStats.change.toFixed(2)} ({formatPercentage(priceStats.changePct)})
                      </span>
                    </div>
                  ) : priceSeriesLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading price data…
                    </div>
                  ) : priceError ? (
                    <div className="text-xs text-red-500">{priceError}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Price data will appear once loaded.
                    </div>
                  )}
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
                  {PRICE_TIMEFRAMES.map((tf) => (
                    <Button
                      key={tf}
                      type="button"
                      size="xs"
                      variant={priceTimeframe === tf ? 'default' : 'ghost'}
                      className={`px-2 py-1 text-xs ${priceTimeframe === tf ? 'shadow-sm' : ''}`}
                      onClick={() => setPriceTimeframe(tf)}
                      disabled={priceSeriesLoading && priceTimeframe === tf}
                    >
                      {tf}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 -mr-5 pb-0">
              <div className="relative h-[260px]">
                {priceSeriesLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : priceSeries.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {priceError ? priceError : 'No price data available for this range.'}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceSeries} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={priceLineColor} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={priceLineColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={priceTickFormatter}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        orientation="right"
                        tickFormatter={priceYAxisFormatter}
                        width={60}
                        tick={{ fontSize: 10 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        labelFormatter={priceTooltipLabelFormatter}
                        formatter={(value) => [
                          value != null
                            ? Number(value).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : '—',
                          'Price',
                        ]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke={priceLineColor}
                        fill="url(#priceGradient)"
                        fillOpacity={1}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {chartData.chartArray && chartData.chartArray.length > 0 && (
            <div className="space-y-3">
              <Card className="overflow-hidden bg-transparent border-none rounded-none">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <CardDescription className="text-xs">{assetName}</CardDescription>
                      {marketStateInfo ? (
                        <span className={`flex items-center gap-1 text-xs font-medium ${marketStateInfo.tone}`}>
                          {MarketStateIcon ? <MarketStateIcon className="h-3 w-3" /> : null}
                          {marketStateInfo.label}
                        </span>
                      ) : null}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold">
                            {symbolInfo?.currentPrice != null
                              ? symbolInfo.currentPrice.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : '-'}
                          </span>
                          {symbolInfo?.currency && (
                            <span className="text-xs text-muted-foreground">{symbolInfo.currency}</span>
                          )}
                        </div>
                        {symbolInfo?.dailyChange != null && symbolInfo?.dailyChangePct != null && (
                          <span
                            className={`text-xs font-medium ${symbolInfo.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {symbolInfo.dailyChange >= 0 ? '+' : ''}
                            {symbolInfo.dailyChange.toFixed(2)} ({symbolInfo.dailyChangePct.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <Select
                        className="w-full"
                        value={selectedCycles.join(',')}
                        onValueChange={(value) => setSelectedCycles(value.split(','))}
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue placeholder="Select cycles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem className="text-xs" value="pre,current">Pre-Election + Current</SelectItem>
                          <SelectItem className="text-xs" value="election,current">Election + Current</SelectItem>
                          <SelectItem className="text-xs" value="mid,current">Mid-Term + Current</SelectItem>
                          <SelectItem className="text-xs" value="post,current">Post-Election + Current</SelectItem>
                          <SelectItem className="text-xs" value="all,current">All Years + Current</SelectItem>
                        </SelectContent>
                      </Select>
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
                            className={`px-2 py-1 text-xs ${scaleChoice === option.value ? 'shadow-sm' : ''}`}
                            onClick={() => setScaleChoice(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-0 -mr-5 pb-0">
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
                          fontSize: '12px'
                        }}
                      />
                      <Legend
                        align="left"
                        verticalAlign="bottom"
                        wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      />
                      {chartData.linesData.map(line => (
                        <Area
                          key={line.key}
                          type="monotone"
                          dataKey={line.key}
                          stroke={line.color}
                          fill={`url(#gradient-${line.key})`}
                          fillOpacity={1}
                          name={line.name}
                          dot={false}
                          strokeWidth={2}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                {['all', 'Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                  <button
                    key={q}
                    className={`flex-1 h-6 text-xs rounded-md border-2 transition-colors ${
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

              <Button
                onClick={() => setPortfolioDialogOpen(true)}
                className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 font-semibold text-sm"
              >
                Add to Your Portfolio
              </Button>

              {(fundamentalsLoading || fundamentals) && (
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
                              <div className="h-3 w-24 rounded bg-muted animate-pulse"></div>
                              <div className="h-4 w-20 rounded bg-muted animate-pulse"></div>
                            </div>
                          ))}
                        </div>
                      ) : quickStats.length > 0 ? (
                        <dl className="grid grid-cols-2 gap-3">
                          {quickStats.map((item) => (
                            <div key={item.label} className="space-y-1">
                              <dt className="text-xs text-muted-foreground">{item.label}</dt>
                              <dd className="text-xs font-medium">{item.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Fundamentals unavailable for {symbol}.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {fundamentalsLoading ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <Card className="h-full">
                        <CardHeader>
                          <div className="h-4 w-32 rounded bg-muted animate-pulse"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[220px] rounded-lg bg-muted animate-pulse"></div>
                        </CardContent>
                      </Card>
                      <Card className="h-full">
                        <CardHeader>
                          <div className="h-4 w-32 rounded bg-muted animate-pulse"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-[220px] rounded-lg bg-muted animate-pulse"></div>
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
                                      <span className="font-medium text-emerald-600">
                                        {formatSignedEarnings(latestEarningsPoint.actual)}
                                      </span>
                                    </p>
                                    {latestEarningsOutcome ? (
                                      <p
                                        className={`text-xs font-semibold ${
                                          latestEarningsOutcome.tone === 'beat'
                                            ? 'text-emerald-600'
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
                              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm px-6 text-center">
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
                                        className={`px-2 py-1 text-xs ${
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
                              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm px-6 text-center">
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
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm px-6 text-center">
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
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm px-6 text-center">
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

        </div>
      )}

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
          router.push(`/election-cycle?symbol=${encodeURIComponent(nextSymbol)}`);
        }}
      />
    </div>
  );
}

export default function ElectionCyclePage() {
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
