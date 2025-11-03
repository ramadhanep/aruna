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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, Sun, MoonStar, Clock3 } from "lucide-react";
import { useTheme } from 'next-themes';
import { AddAssetModal } from "@/components/add-asset-modal";

const CURRENT_LINE_COLOR = 'oklch(59.6% 0.145 163.225)';

function ElectionCyclePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const symbolParam = searchParams.get('symbol');
  const LAST_SYMBOL_KEY = 'aruna_last_election_symbol';
  const getInitialSymbol = () => {
    if (symbolParam) return symbolParam;
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem(LAST_SYMBOL_KEY);
      if (last) return last;
    }
    return 'GOOGL';
  };
  const [symbol, setSymbol] = useState(getInitialSymbol);
  const [scaleChoice, setScaleChoice] = useState('linear');
  const [loading, setLoading] = useState(false);
  const [rawLinesData, setRawLinesData] = useState([]);
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {} });
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [metricView, setMetricView] = useState('marketCap');
  const [metricPeriod, setMetricPeriod] = useState('trailing');

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
    setMetricView('marketCap');
    setMetricPeriod('trailing');

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

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    if (clean.length === 6) {
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return [r, g, b];
    }
    return [0, 0, 0];
  }

  function rgbaFromHex(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function cellBgStyle(value) {
    if (value == null || isNaN(value)) return null;
    const posHex = '#16A34A';
    const negHex = '#DC2626';
    const magnitude = Math.min(Math.abs(value), 30);
    const intensity = 0.15 + (magnitude / 30) * 0.75;
    const color = value >= 0 ? rgbaFromHex(posHex, intensity) : rgbaFromHex(negHex, intensity);
    return color;
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

  const formatMetricDisplay = useCallback(
    (value, metric) => {
      if (value == null || Number.isNaN(value)) return '—';
      if (metric === 'marketCap' || metric === 'enterpriseValue') {
        return `${compactNumberFormatter.format(value)} ${currencyCode}`;
      }
      if (
        metric === 'peRatio' ||
        metric === 'forwardPeRatio' ||
        metric === 'pbRatio' ||
        metric === 'psRatio' ||
        metric === 'evToEbitda' ||
        metric === 'evToRevenue' ||
        metric === 'pegRatio'
      ) {
        return Number(value).toFixed(2);
      }
      return Number(value).toLocaleString();
    },
    [compactNumberFormatter, currencyCode]
  );

  const metricOptions = useMemo(
    () => [
      { value: 'marketCap', label: 'Market Cap' },
      { value: 'peRatio', label: 'P/E' },
      { value: 'pbRatio', label: 'P/B' },
      { value: 'psRatio', label: 'P/S' },
      { value: 'evToEbitda', label: 'EV/EBITDA' },
    ],
    []
  );

  const selectedMetric = metricOptions.find((option) => option.value === metricView) || metricOptions[0];

  const metricSeriesData = useMemo(() => {
    const series = fundamentals?.metrics?.[metricPeriod]?.[metricView];
    if (!series || series.length === 0) return [];

    return series.map((entry) => {
      const dateObj =
        entry.date && !Number.isNaN(Date.parse(entry.date))
          ? new Date(entry.date)
          : entry.timestamp
            ? new Date(entry.timestamp)
            : null;
      const iso = dateObj ? dateObj.toISOString().slice(0, 10) : entry.date || '';
      const label = dateObj
        ? dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : entry.date || '—';
      return {
        label,
        iso,
        value: entry.value,
      };
    });
  }, [fundamentals, metricPeriod, metricView]);

  const metricLatest = fundamentals?.latest?.[metricPeriod]?.[metricView] || null;
  const metricLatestDisplay = metricLatest ? formatMetricDisplay(metricLatest.value, metricView) : '—';
  const metricLatestDate = metricLatest?.date
    ? new Date(metricLatest.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const metricYAxisFormatter = useCallback(
    (value) => {
      if (value == null || Number.isNaN(value)) return '';
      if (metricView === 'marketCap' || metricView === 'enterpriseValue') {
        return compactNumberFormatter.format(value);
      }
      return Number(value).toFixed(1);
    },
    [compactNumberFormatter, metricView]
  );

  const metricTooltipFormatter = useCallback(
    (value) => formatMetricDisplay(value, metricView),
    [formatMetricDisplay, metricView]
  );

  const metricPeriodDescription =
    metricPeriod === 'trailing' ? 'Trailing twelve months data' : 'Quarterly reported values';

  const periodOptions = useMemo(
    () => [
      { value: 'trailing', label: 'Trailing' },
      { value: 'quarterly', label: 'Quarterly' },
    ],
    []
  );

  const quickStats = useMemo(() => {
    if (!fundamentals) return [];
    const trailing = fundamentals.latest?.trailing || {};
    const stats = [
      { label: 'Market Cap', value: formatMetricDisplay(trailing.marketCap?.value, 'marketCap') },
      { label: 'P/E (TTM)', value: formatMetricDisplay(trailing.peRatio?.value, 'peRatio') },
      { label: 'Forward P/E', value: formatMetricDisplay(trailing.forwardPeRatio?.value, 'peRatio') },
      { label: 'P/B', value: formatMetricDisplay(trailing.pbRatio?.value, 'pbRatio') },
      { label: 'P/S', value: formatMetricDisplay(trailing.psRatio?.value, 'psRatio') },
      { label: 'EV/EBITDA', value: formatMetricDisplay(trailing.evToEbitda?.value, 'evToEbitda') },
      { label: 'PEG', value: formatMetricDisplay(trailing.pegRatio?.value, 'pegRatio') },
      { label: '52W Range', value: formatPlainNumber(fundamentals.price?.fiftyTwoWeekRange) },
      { label: 'Day Range', value: formatPlainNumber(fundamentals.price?.dayRange) },
      { label: 'Volume', value: formatPlainNumber(fundamentals.price?.volume) },
      { label: 'Previous Close', value: formatPlainNumber(fundamentals.price?.previousClose) },
      { label: 'Open', value: formatPlainNumber(fundamentals.price?.open) },
    ];
    return stats.filter((item) => item.value && item.value !== '—');
  }, [fundamentals, formatMetricDisplay, formatPlainNumber]);

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

  const logoUrl = fundamentals?.profile?.logoUrl || null;
  const MarketStateIcon = marketStateInfo?.Icon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${assetName || symbol} logo`}
              className="h-8 w-8 rounded-full border border-border bg-background object-contain p-1"
              loading="lazy"
            />
          )}
          <h1 className="text-base font-bold uppercase">
            {symbol}
          </h1>
          {symbol.endsWith('.JK') && (
            <span className="text-xs">🇮🇩 Hey antek-antek asing!</span>
          )}
          {symbol.endsWith('-USD') && (
            <span className="text-xs">🚀 To the moon (katanya)</span>
          )}
          {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
            <span className="text-xs">👴 Boomer Pension Fund</span>
          )}
          {['AAPL','MSFT','GOOGL','GOOG','AMZN','META','NVDA','TSLA'].some((s) => symbol.endsWith(s)) && (
            <span className="text-xs">🧰 Magnificent 7</span>
          )}
        </div>
      </div>

      {loading && (
        <>
          <Card className="overflow-hidden bg-transparent border-none rounded-none">
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded w-32 mb-2 animate-pulse"></div>
                  <div className="flex justify-between items-start">
                    <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
                    <div className="flex gap-2">
                      <div className="h-8 w-16 bg-muted rounded-md animate-pulse"></div>
                      <div className="h-8 w-24 bg-muted rounded-md animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 -mr-5 pb-0">
              <div className="w-full h-[280px] bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 h-6 bg-muted rounded-md animate-pulse"></div>
            ))}
          </div>

          <div className="h-11 bg-muted rounded-md animate-pulse"></div>

          <div className="h-10 bg-muted rounded-md animate-pulse"></div>

          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
            </div>
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
            </div>
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && chartData.chartArray && chartData.chartArray.length > 0 && (
        <>
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
                      className={`text-sm font-medium ${symbolInfo.dailyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {symbolInfo.dailyChange >= 0 ? '+' : ''}
                      {symbolInfo.dailyChange.toFixed(2)} ({symbolInfo.dailyChangePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
                <RadioGroup value={scaleChoice} onValueChange={setScaleChoice} className="flex gap-2">
                  <div className="flex-1">
                    <RadioGroupItem value="linear" id="linear" className="peer sr-only" />
                    <Label
                      htmlFor="linear"
                      className="flex items-center justify-center h-6 px-2 rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-colors text-xs"
                    >
                      Linear
                    </Label>
                  </div>
                  <div className="flex-1">
                    <RadioGroupItem value="log" id="log" className="peer sr-only" />
                    <Label
                      htmlFor="log"
                      className="flex items-center justify-center h-6 px-2 rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-colors text-xs"
                    >
                      Logarithmic
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardHeader>
            <CardContent className="px-0 -mr-5 pb-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart 
                  data={filteredChartData}
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                >
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
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      stroke={line.color}
                      name={line.name}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
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

          <Select
            className="w-full"
            value={selectedCycles.join(',')}
            onValueChange={(value) => setSelectedCycles(value.split(','))}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select cycles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pre,current">Pre-Election + Current</SelectItem>
              <SelectItem value="election,current">Election + Current</SelectItem>
              <SelectItem value="mid,current">Mid-Term + Current</SelectItem>
              <SelectItem value="post,current">Post-Election + Current</SelectItem>
              <SelectItem value="all,current">All Years + Current</SelectItem>
              {/* <SelectItem value="pre,election,mid,post,current">All Cycles + Current</SelectItem> */}
            </SelectContent>
          </Select>

          <Button 
            onClick={() => setPortfolioDialogOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold text-sm"
          >
            Add to Your Portfolio
          </Button>

          {(fundamentalsLoading || fundamentals) && (
            <div className="space-y-3">
              <Card className="p-4">
                <CardHeader>
                  <CardTitle className="text-base">Fundamental Snapshot</CardTitle>
                  <CardDescription className="text-xs">
                    Latest valuation ratios and price context
                  </CardDescription>
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
                          <dd className="text-sm font-medium">{item.value}</dd>
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

              <Card className="p-4">
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Fundamental Trends</CardTitle>
                      <CardDescription className="text-xs">{metricPeriodDescription}</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={metricView} onValueChange={setMetricView}>
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue placeholder="Metric" />
                        </SelectTrigger>
                        <SelectContent>
                          {metricOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        {periodOptions.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={metricPeriod === option.value ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => setMetricPeriod(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fundamentalsLoading ? (
                    <div className="h-48 w-full rounded-lg bg-muted animate-pulse"></div>
                  ) : metricSeriesData.length > 0 ? (
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{metricLatestDisplay}</span>
                        {metricLatestDate && (
                          <span className="text-xs text-muted-foreground">As of {metricLatestDate}</span>
                        )}
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={metricSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10 }}
                            minTickGap={16}
                          />
                          <YAxis
                            tickFormatter={metricYAxisFormatter}
                            width={50}
                            axisLine={false}
                            tick={{ fontSize: 10 }}
                          />
                          <Tooltip
                            formatter={(value) => metricTooltipFormatter(value)}
                            labelFormatter={(_, payload) => {
                              const iso = payload?.[0]?.payload?.iso;
                              if (!iso) return '';
                              const date = new Date(iso);
                              if (Number.isNaN(date.getTime())) return iso;
                              return date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              });
                            }}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke={CURRENT_LINE_COLOR}
                            name={selectedMetric?.label}
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No {metricPeriod === 'trailing' ? 'trailing' : 'quarterly'} data for {selectedMetric?.label}.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Accordion type="single" collapsible defaultValue="quarterly" className="border rounded-lg">
            <AccordionItem value="quarterly" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline hover:bg-accent">
                Quarterly Returns
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="overflow-x-auto -mx-4 px-4">
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
                        <tr key={idx} className="border-b">
                          <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                          {[1, 2, 3, 4].map(quarter => {
                            const value = row[`Q${quarter}`];
                            const bg = cellBgStyle(value);
                            return (
                              <td key={quarter} className="text-center py-2 px-2" style={{ backgroundColor: bg }}>
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
                          const bg = cellBgStyle(value);
                          return (
                            <td key={quarter} className="text-center py-2 px-2" style={{ backgroundColor: bg }}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="monthly" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline hover:bg-accent">
                Monthly Returns
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="relative overflow-x-auto">
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
                        <tr key={idx} className="border-b">
                          <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                            const value = row[`M${month}`];
                            const bg = cellBgStyle(value);
                            return (
                              <td key={month} className="text-center py-2 px-1" style={{ backgroundColor: bg }}>
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
                          const bg = cellBgStyle(value);
                          return (
                            <td key={month} className="text-center py-2 px-1" style={{ backgroundColor: bg }}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
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
