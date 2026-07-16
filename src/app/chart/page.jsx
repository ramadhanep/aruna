"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
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
  getWinRateCellStyle,
} from '@/lib/seasonalData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, ErrorBar, ReferenceLine } from 'recharts';
import { Loader2, Sun, MoonStar, Clock3, Star, Lock, Bitcoin, Crown, ChevronDown, Fullscreen, ArrowLeft, Settings, CandlestickChart, LineChart, BarChart2 } from "lucide-react";
import { useTheme } from 'next-themes';
import { AddAssetModal } from "@/components/add-asset-modal";
import { SymbolSearchDialog } from "@/components/header-symbol-search";
import { useAuth } from "@/components/auth-provider";
import { NormalCandlestickChart } from "@/components/normal-candlestick-chart";
import { fetchEncodedJson } from "@/lib/api-client";
import { DEFAULT_WATCHLIST, getDefaultWatchlist } from "@/lib/default-watchlist";
import { ArunaWatermark } from "@/components/aruna-watermark";
import { TickerAvatar } from "@/components/ticker-avatar";
import { formatTickerDisplay } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CURRENT_LINE_COLOR = 'oklch(59.6% 0.145 163.225)';

const SCREENING_CATEGORIES = ['idx', 'us', 'crypto'];

/**
 * Semicircle gauge chart for analyst rating.
 * score: 1 (Strong Buy) → 5 (Strong Sell), matching Yahoo Finance's recommendationMean scale.
 */
function AnalystGaugeChart({ score }) {
  const cx = 120, cy = 104, r = 78, trackW = 15;
  const toPoint = (a, rad) => ({
    x: cx + rad * Math.cos(a),
    y: cy - rad * Math.sin(a),
  });
  const arc = (a1, a2, rad = r) => {
    const s = toPoint(a1, rad);
    const e = toPoint(a2, rad);
    const large = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${rad} ${rad} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };
  const zones = [
    [Math.PI, Math.PI * 0.8, '#ef4444'],
    [Math.PI * 0.8, Math.PI * 0.6, '#f97316'],
    [Math.PI * 0.6, Math.PI * 0.4, '#eab308'],
    [Math.PI * 0.4, Math.PI * 0.2, '#22c55e'],
    [Math.PI * 0.2, 0, '#10b981'],
  ];
  // score=1 → p=1 (right/Strong Buy), score=5 → p=0 (left/Strong Sell)
  const p = score != null ? Math.min(1, Math.max(0, (5 - score) / 4)) : null;
  const needleAngle = p != null ? Math.PI * (1 - p) : null;
  const tip = needleAngle != null ? toPoint(needleAngle, r * 0.68) : null;
  // Labels at each zone midpoint, placed outside the arc
  const labelDefs = [
    { angle: Math.PI * 0.9, text: 'Strong\nSell', anchor: 'end', offR: 22 },
    { angle: Math.PI * 0.7, text: 'Sell', anchor: 'end', offR: 18 },
    { angle: Math.PI * 0.5, text: 'Neutral', anchor: 'middle', offR: 18 },
    { angle: Math.PI * 0.3, text: 'Buy', anchor: 'start', offR: 18 },
    { angle: Math.PI * 0.1, text: 'Strong\nBuy', anchor: 'start', offR: 22 },
  ];
  return (
    <svg viewBox="0 0 240 128" className="w-full max-w-[260px] mx-auto select-none">
      {/* Subtle background track */}
      <path d={arc(Math.PI, 0)} fill="none" stroke="currentColor" strokeOpacity={0.07} strokeWidth={trackW + 8} />
      {/* Colored zone segments */}
      {zones.map(([a1, a2, col], i) => (
        <path key={i} d={arc(a1, a2)} fill="none" stroke={col} strokeWidth={trackW} strokeLinecap="butt" />
      ))}
      {/* Zone labels */}
      {labelDefs.map(({ angle, text, anchor, offR }, i) => {
        const pt = toPoint(angle, r + offR);
        const lines = text.split('\n');
        return (
          <text key={i} x={pt.x.toFixed(1)} y={pt.y.toFixed(1)} textAnchor={anchor} fontSize="7.5" fill="currentColor" opacity="0.5">
            {lines.map((ln, j) => (
              <tspan key={j} x={pt.x.toFixed(1)} dy={j === 0 ? 0 : '1.3em'}>{ln}</tspan>
            ))}
          </text>
        );
      })}
      {/* Needle */}
      {tip && (
        <>
          <line
            x1={cx} y1={cy}
            x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={6} fill="currentColor" />
          <circle cx={cx} cy={cy} r={3.5} fill="currentColor" opacity="0.2" />
        </>
      )}
    </svg>
  );
}

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
        return { symbol: candidate, signal_date: null, is_warning: false, trading_plan: null };
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
        trading_plan: candidate.trading_plan ?? null,
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

/**
 * Formats a date/datetime value as a clean ISO 8601-style string in the client's local timezone.
 * @param {string|number|Date} v - A date string, Unix timestamp (ms), or Date object
 * @param {{ dateOnly?: boolean }} options
 * @returns {string|null}
 */
function formatTimestamp(v, { dateOnly = false } = {}) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    if (dateOnly) return `${year}-${month}-${day}`;
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return null;
  }
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

const BASE_INFO_TABS = [
  { value: 'keystats', label: 'KEYSTATS' },
  { value: 'analysis', label: 'ANALYSIS' },
  { value: 'financials', label: 'FINANCIALS' },
  { value: 'seasonality', label: 'SEASONALITY' },
  { value: 'profile', label: 'ABOUT' },
];

// Fallback rationale/action metadata for take-profit targets missing the newer, richer
// trading-plan fields (e.g. plans generated before this schema existed).
const TP_FALLBACK_META = [
  { reason: 'Momentum Target', sellPercent: 30, action: 'Move Stop Loss to Breakeven' },
  { reason: 'Momentum Target', sellPercent: 40, action: 'Trail Stop to EMA20' },
  { reason: 'Momentum Target', sellPercent: 30, action: 'Exit Remaining Position' },
];

const INFO_TAB_QUERY_LOOKUP = {
  tradingplan: 'trading-plan',
  keystats: 'keystats',
  analysis: 'analysis',
  financials: 'financials',
  seasonality: 'seasonality',
  profile: 'profile',
  about: 'profile',
};

function normalizeInfoTabParam(value) {
  if (!value) return null;
  const sanitized = String(value).replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (!sanitized) return null;
  return INFO_TAB_QUERY_LOOKUP[sanitized] ?? null;
}

function infoTabToQueryValue(value) {
  if (!value) return null;
  const str = String(value);
  if (str === 'trading-plan') return 'tradingPlan';
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

const EMA_PERIOD = 31;
const EMA_COLOR = '#0ea5e9';
const BUY_SIGNAL_COLOR = '#10b981'; // emerald-500, matches candlestick up/bullish color
const LIVERMORE_LOOKBACK = 31;
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

function computeLivermoreKeyLevels(points = [], lookback = 31) {
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

function isIdxLotSymbol(symbol = '') {
  return /\.JK$/i.test(symbol?.trim?.() ?? '');
}

function toFiniteNumber(value) {
  if (value === '' || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
  const tabParam = searchParams.get('tab');
  const searchParamsString = searchParams.toString();
  const requestedInfoTab = normalizeInfoTabParam(tabParam);
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
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {}, winRate: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {}, winRate: {} });
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [portfolioEntries, setPortfolioEntries] = useState([]);
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const fundamentalsCacheRef = useRef({});
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [showLivermoreKey, setShowLivermoreKey] = useState(false);
  const [chartDisplayType, setChartDisplayType] = useState('heikinAshi'); // 'candle' | 'heikinAshi' | 'line'
  const [watchlist, setWatchlist] = useState(() => getDefaultWatchlist());
  const [screeningSignal, setScreeningSignal] = useState(null);
  const [infoTab, setInfoTab] = useState(() => requestedInfoTab || 'keystats');
  const infoTabRef = useRef(infoTab);
  const [tradingPlanEntryInput, setTradingPlanEntryInput] = useState('');
  const [tradingPlanBalanceInput, setTradingPlanBalanceInput] = useState('');
  const [tradingPlanRiskPercentInput, setTradingPlanRiskPercentInput] = useState('1');
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
  const tradingPlanPayload = screeningSignal?.trading_plan ?? null;
  const screeningCategory = screeningSignal?.category ?? null;
  const lotEligible = useMemo(() => isIdxLotSymbol(symbol), [symbol]);
  const hasTradingPlan = Boolean(tradingPlanPayload);
  const infoTabs = useMemo(() => {
    if (hasTradingPlan) {
      return [{ value: 'trading-plan', label: 'TRADING PLAN' }, ...BASE_INFO_TABS];
    }
    return BASE_INFO_TABS;
  }, [hasTradingPlan]);

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
    const params = new URLSearchParams(searchParamsString);
    let dirty = false;

    const normalizedCycles = selectedCycles.join(',');
    const currentCycle = params.get('cycle') ?? '';
    if (normalizedCycles) {
      if (currentCycle !== normalizedCycles) {
        params.set('cycle', normalizedCycles);
        dirty = true;
      }
    } else if (currentCycle) {
      params.delete('cycle');
      dirty = true;
    }

    const tabQueryValue = infoTabToQueryValue(infoTab);
    const currentTab = params.get('tab') ?? '';
    if (tabQueryValue) {
      if (currentTab !== tabQueryValue) {
        params.set('tab', tabQueryValue);
        dirty = true;
      }
    } else if (currentTab) {
      params.delete('tab');
      dirty = true;
    }

    if (!dirty) return;
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [selectedCycles, infoTab, searchParamsString, pathname, router]);

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

  useEffect(() => {
    infoTabRef.current = infoTab;
  }, [infoTab]);

  useEffect(() => {
    if (!requestedInfoTab) {
      return;
    }
    const available = infoTabs.some((tab) => tab.value === requestedInfoTab);
    if (!available) {
      return;
    }
    if (infoTabRef.current === requestedInfoTab) {
      return;
    }
    setInfoTab(requestedInfoTab);
  }, [requestedInfoTab, infoTabs]);

  useEffect(() => {
    const isTabAvailable = infoTabs.some((tab) => tab.value === infoTab);
    if (isTabAvailable || (requestedInfoTab && requestedInfoTab === infoTab)) {
      return;
    }
    const fallback = infoTabs[0]?.value ?? 'keystats';
    if (fallback && fallback !== infoTab) {
      setInfoTab(fallback);
    }
  }, [infoTabs, infoTab, requestedInfoTab]);

  useEffect(() => {
    if (!tradingPlanPayload) {
      setTradingPlanEntryInput('');
      setTradingPlanBalanceInput('');
      setTradingPlanRiskPercentInput('1');
      return;
    }
    setTradingPlanEntryInput(
      tradingPlanPayload.entry_price != null ? String(tradingPlanPayload.entry_price) : ''
    );
    setTradingPlanBalanceInput(
      tradingPlanPayload.account_size != null ? String(tradingPlanPayload.account_size) : ''
    );
    setTradingPlanRiskPercentInput(
      tradingPlanPayload.risk_percent != null ? String(tradingPlanPayload.risk_percent) : '1'
    );
  }, [tradingPlanPayload]);

  // Persist last viewed symbol
  useEffect(() => {
    try {
      localStorage.setItem(LAST_SYMBOL_KEY, symbol);
    } catch { }
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

  // Lazy-load fundamentals only when the user switches to a tab that needs them
  // Cache per symbol so switching tabs back doesn't re-fetch
  useEffect(() => {
    if (!symbol) {
      return;
    }

    // Only fetch for tabs that need fundamentals data
    const needsFundamentals = ['keystats', 'analysis', 'profile', 'financials'].includes(infoTab);
    if (!needsFundamentals) {
      return;
    }

    // Check cache — skip fetch if we already have data for this symbol
    if (fundamentalsCacheRef.current[symbol]) {
      setFundamentals(fundamentalsCacheRef.current[symbol]);
      setFundamentalsLoading(false);
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
          // Cache the result for this symbol
          fundamentalsCacheRef.current[symbol] = data;
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
  }, [symbol, infoTab]);

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
        logo: data.meta?.logo,
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

  function getReturnCellStyle(value) {
    if (value == null || isNaN(value)) return {};
    const abs = Math.abs(value);
    const t = Math.min(1, abs / 10);
    const alpha = (0.15 + t * 0.65).toFixed(2);
    if (value > 0) return { backgroundColor: `rgba(34, 197, 94, ${alpha})`, color: t > 0.3 ? 'white' : undefined };
    if (value < 0) return { backgroundColor: `rgba(239, 68, 68, ${alpha})`, color: t > 0.3 ? 'white' : undefined };
    return {};
  }

  const [quarterFilter, setQuarterFilter] = useState('all');

  const getQuarterDateRange = (quarter) => {
    switch (quarter) {
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
    const ema20Series = calculateEMA(closingPrices, EMA_PERIOD);
    const firstClose =
      closingPrices.find((value) => typeof value === 'number' && Number.isFinite(value)) ?? null;

    return normalizedPoints.map((point, index) => {
      const ema20 = Number.isFinite(ema20Series[index]) ? ema20Series[index] : point.close;
      const changePct =
        firstClose && firstClose !== 0 ? ((point.close - firstClose) / firstClose) * 100 : null;
      return {
        ...point,
        changePct,
        ema20,
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
      pct: symbolInfo.dailyChangePct
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
        chartDisplayType,
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

      let open, close, high, low;
      if (chartDisplayType === 'heikinAshi') {
        open = typeof point.heikinOpen === 'number' && Number.isFinite(point.heikinOpen) ? point.heikinOpen : actualOpen;
        close = typeof point.heikinClose === 'number' && Number.isFinite(point.heikinClose) ? point.heikinClose : actualClose;
        high = typeof point.heikinHigh === 'number' && Number.isFinite(point.heikinHigh) ? point.heikinHigh : actualHigh;
        low = typeof point.heikinLow === 'number' && Number.isFinite(point.heikinLow) ? point.heikinLow : actualLow;
      } else {
        open = actualOpen;
        close = actualClose;
        high = actualHigh;
        low = actualLow;
      }

      candles.push({ time, open, high, low, close });
      if (typeof point.ema20 === 'number' && Number.isFinite(point.ema20)) {
        ema.push({ time, value: point.ema20 });
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
        ema20:
          typeof point.ema20 === 'number' && Number.isFinite(point.ema20) ? point.ema20 : close,
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
      chartDisplayType,
    };
  }, [filteredNormalChartData, isNormalView, chartDisplayType]);

  const normalChartReady = normalCandlestickSeries.candles.length > 0;

  const renderTimeframeButtons = ({ includeFullscreenToggle = false } = {}) => (
    <>
      {NORMAL_TIMEFRAME_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={normalTimeframe === option.value ? 'default' : 'ghost'}
          className={`rounded-sm px-2 min-w-[2.1rem] font-bold py-0 text-[11px] ${normalTimeframe === option.value
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 rounded-full border border-border/30 p-0 text-muted-foreground"
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

  const renderChartTypeSwitcher = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 rounded-md border border-border/30 px-2 gap-1.5 text-muted-foreground text-[11px] font-semibold"
          title="Chart Type"
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
  );

  const renderChartSettings = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 rounded-full border border-border/30 p-0 text-muted-foreground"
          title="Chart Settings"
          aria-label="Chart settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 z-[130]">
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setScaleChoice(scaleChoice === 'log' ? 'linear' : 'log');
          }}
        >
          <div className={`h-4 w-4 rounded border flex items-center justify-center ${scaleChoice === 'log' ? 'bg-emerald-700 border-emerald-700' : 'border-muted-foreground/30'
            }`}>
            {scaleChoice === 'log' && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm">Logarithmic</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setShowLivermoreKey((prev) => !prev);
          }}
        >
          <div className={`h-4 w-4 rounded border flex items-center justify-center ${showLivermoreKey ? 'bg-emerald-700 border-emerald-700' : 'border-muted-foreground/30'
            }`}>
            {showLivermoreKey && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className="text-sm">Livermore Key</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
        color: BUY_SIGNAL_COLOR,
        text: 'Buy',
      },
    ];
  }, [filteredNormalChartData, screeningSignal?.signal_date, isNormalView]);
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

  const formatPlanCurrencyValue = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const formatted = formatDetailedCurrency(value);
    return currencyCode ? `${formatted} ${currencyCode}` : formatted;
  }, [currencyCode, formatDetailedCurrency]);

  const formatPlanPriceDelta = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    return `${numeric >= 0 ? '+' : '-'}${Math.abs(numeric).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, []);

  const formatPlanCurrencyDelta = useCallback((value) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const numeric = Number(value);
    const formatted = formatDetailedCurrency(Math.abs(numeric));
    const prefix = numeric >= 0 ? '+' : '-';
    return currencyCode ? `${prefix}${formatted} ${currencyCode}` : `${prefix}${formatted}`;
  }, [currencyCode, formatDetailedCurrency]);

  const tradingPlanEntryPrice = useMemo(() => {
    const manual = toFiniteNumber(tradingPlanEntryInput);
    if (manual != null && manual > 0) {
      return manual;
    }
    return toFiniteNumber(tradingPlanPayload?.entry_price);
  }, [tradingPlanEntryInput, tradingPlanPayload]);

  const tradingPlanStopLossPrice = useMemo(() => toFiniteNumber(tradingPlanPayload?.stop_loss), [tradingPlanPayload]);

  const tradingPlanStopLossReason = useMemo(
    () => tradingPlanPayload?.stop_loss_reason || 'Below Key Technical Level',
    [tradingPlanPayload]
  );

  const tradingPlanStopLossDiff = useMemo(() => {
    if (tradingPlanEntryPrice == null || tradingPlanStopLossPrice == null) {
      return null;
    }
    return tradingPlanStopLossPrice - tradingPlanEntryPrice;
  }, [tradingPlanEntryPrice, tradingPlanStopLossPrice]);

  const tradingPlanStopLossPct = useMemo(() => {
    if (
      tradingPlanEntryPrice == null ||
      tradingPlanEntryPrice === 0 ||
      tradingPlanStopLossPrice == null
    ) {
      return null;
    }
    return ((tradingPlanStopLossPrice - tradingPlanEntryPrice) / tradingPlanEntryPrice) * 100;
  }, [tradingPlanEntryPrice, tradingPlanStopLossPrice]);

  // Risk distance per unit (always positive for a valid long setup) — the backbone of every
  // R-multiple and position-sizing calculation below.
  const tradingPlanRiskPerUnit = useMemo(() => {
    if (tradingPlanEntryPrice == null || tradingPlanStopLossPrice == null) return null;
    const diff = tradingPlanEntryPrice - tradingPlanStopLossPrice;
    return diff > 0 ? diff : null;
  }, [tradingPlanEntryPrice, tradingPlanStopLossPrice]);

  const tradingPlanEntryZone = useMemo(() => {
    const low = toFiniteNumber(tradingPlanPayload?.entry_zone_low) ?? tradingPlanEntryPrice;
    const high = toFiniteNumber(tradingPlanPayload?.entry_zone_high) ?? tradingPlanEntryPrice;
    return {
      low: low != null ? Math.min(low, high ?? low) : null,
      high: high != null ? Math.max(low ?? high, high) : null,
      type: tradingPlanPayload?.entry_type || 'Market',
      reason: tradingPlanPayload?.entry_reason || 'Breakout confirmed by trend and volume',
    };
  }, [tradingPlanPayload, tradingPlanEntryPrice]);

  const tradingPlanTargets = useMemo(() => {
    if (!tradingPlanPayload?.tp_targets) {
      return [];
    }
    return tradingPlanPayload.tp_targets
      .map((target, index) => {
        const price = toFiniteNumber(target?.price);
        if (price == null) {
          return null;
        }
        const fallback = TP_FALLBACK_META[index] || TP_FALLBACK_META[TP_FALLBACK_META.length - 1];
        const label = target?.label || `TP${index + 1}`;
        const diff = tradingPlanEntryPrice != null ? price - tradingPlanEntryPrice : null;
        const pct =
          tradingPlanEntryPrice != null && tradingPlanEntryPrice !== 0 && diff != null
            ? (diff / tradingPlanEntryPrice) * 100
            : null;
        const rMultiple =
          tradingPlanRiskPerUnit != null && diff != null ? diff / tradingPlanRiskPerUnit : null;
        return {
          label,
          price,
          diff,
          pct,
          rMultiple,
          reason: target?.reason || fallback.reason,
          sellPercent: target?.sell_percent ?? fallback.sellPercent,
          action: target?.action || fallback.action,
        };
      })
      .filter(Boolean);
  }, [tradingPlanPayload, tradingPlanEntryPrice, tradingPlanRiskPerUnit]);

  // Primary target used for the headline Risk:Reward figure and the calculator's expected
  // profit — the middle target (TP2 / measured-move) is the realistic, most-likely outcome.
  const tradingPlanPrimaryTarget = useMemo(() => {
    if (tradingPlanTargets.length === 0) return null;
    const mid = Math.floor(tradingPlanTargets.length / 2);
    return tradingPlanTargets[mid] || tradingPlanTargets[0];
  }, [tradingPlanTargets]);

  const tradingPlanRiskReward = useMemo(() => {
    const fromPayload = tradingPlanPayload?.risk_reward;
    const perTarget = tradingPlanTargets.map((target) => target.rMultiple ?? null);
    const primary =
      toFiniteNumber(fromPayload?.primary) ?? tradingPlanPrimaryTarget?.rMultiple ?? perTarget[perTarget.length - 1] ?? null;
    return { perTarget, primary };
  }, [tradingPlanPayload, tradingPlanTargets, tradingPlanPrimaryTarget]);

  const tradingPlanQualityTier = useMemo(() => {
    const rr = tradingPlanRiskReward.primary;
    const tier = tradingPlanPayload?.quality_tier ||
      (rr == null ? 'fair' : rr >= 3 ? 'excellent' : rr >= 2 ? 'good' : rr >= 1.2 ? 'fair' : 'poor');
    const meta = {
      excellent: { label: 'Excellent Setup', tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
      good: { label: 'Good Setup', tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
      fair: { label: 'Fair Setup', tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
      poor: { label: 'Weak Setup', tone: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    };
    return { tier, ...(meta[tier] || meta.fair) };
  }, [tradingPlanPayload, tradingPlanRiskReward]);

  const tradingPlanBasisValues = useMemo(() => {
    if (!tradingPlanPayload?.basis) {
      return { swing: null, swingHigh: null, ema: null, atr: null };
    }
    return {
      swing: toFiniteNumber(tradingPlanPayload.basis.swing_low),
      swingHigh: toFiniteNumber(tradingPlanPayload.basis.swing_high),
      ema: toFiniteNumber(tradingPlanPayload.basis.ema20),
      atr: toFiniteNumber(tradingPlanPayload.basis.atr),
    };
  }, [tradingPlanPayload]);

  const tradingPlanTechnicalConfirmations = useMemo(() => {
    const items = [];
    items.push('Price reclaimed EMA20 with rising slope');
    const volumeRatio = toFiniteNumber(tradingPlanPayload?.volume_ratio);
    items.push(
      volumeRatio != null
        ? `Volume ${volumeRatio.toFixed(2)}x above 31-day average`
        : 'Volume above 31-day average'
    );
    const slope = toFiniteNumber(tradingPlanPayload?.ema_slope_pct);
    if (slope != null) {
      items.push(`EMA20 trending up (${slope >= 0 ? '+' : ''}${slope.toFixed(2)}%/day)`);
    }
    return items;
  }, [tradingPlanPayload]);

  const tradingPlanCategoryLabel = useMemo(() => {
    if (!screeningCategory) return null;
    return screeningCategory.toUpperCase();
  }, [screeningCategory]);

  // --- Position size calculator: risk-first, never requires manual share math ---
  const tradingPlanBalanceValue = useMemo(() => {
    const manual = toFiniteNumber(tradingPlanBalanceInput);
    if (manual != null && manual > 0) return manual;
    return toFiniteNumber(tradingPlanPayload?.account_size);
  }, [tradingPlanBalanceInput, tradingPlanPayload]);

  const tradingPlanRiskPercentValue = useMemo(() => {
    const manual = toFiniteNumber(tradingPlanRiskPercentInput);
    if (manual != null && manual > 0) return manual;
    return toFiniteNumber(tradingPlanPayload?.risk_percent) ?? 1;
  }, [tradingPlanRiskPercentInput, tradingPlanPayload]);

  const tradingPlanMaxRiskAmount = useMemo(() => {
    if (tradingPlanBalanceValue == null || tradingPlanRiskPercentValue == null) return null;
    return (tradingPlanBalanceValue * tradingPlanRiskPercentValue) / 100;
  }, [tradingPlanBalanceValue, tradingPlanRiskPercentValue]);

  const tradingPlanShareCount = useMemo(() => {
    if (tradingPlanMaxRiskAmount == null || !tradingPlanRiskPerUnit) return 0;
    return Math.max(Math.floor(tradingPlanMaxRiskAmount / tradingPlanRiskPerUnit), 0);
  }, [tradingPlanMaxRiskAmount, tradingPlanRiskPerUnit]);

  const tradingPlanLotCount = useMemo(() => {
    if (!lotEligible || tradingPlanShareCount <= 0) return null;
    return Math.floor(tradingPlanShareCount / 100);
  }, [lotEligible, tradingPlanShareCount]);

  const tradingPlanSizeSummary = useMemo(() => {
    if (tradingPlanShareCount <= 0) return null;
    const shareLabel = tradingPlanShareCount.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (lotEligible) {
      const lotShares = (tradingPlanLotCount ?? 0) * 100;
      const lotLabel = (tradingPlanLotCount ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
      return `${lotLabel} lots (${lotShares.toLocaleString('en-US')} shares)`;
    }
    return `${shareLabel} shares`;
  }, [tradingPlanShareCount, tradingPlanLotCount, lotEligible]);

  const tradingPlanPositionCost = useMemo(() => {
    if (tradingPlanShareCount <= 0 || tradingPlanEntryPrice == null) return null;
    return tradingPlanShareCount * tradingPlanEntryPrice;
  }, [tradingPlanShareCount, tradingPlanEntryPrice]);

  const tradingPlanExpectedLoss = useMemo(() => {
    if (tradingPlanShareCount <= 0 || tradingPlanRiskPerUnit == null) return null;
    return tradingPlanShareCount * tradingPlanRiskPerUnit;
  }, [tradingPlanShareCount, tradingPlanRiskPerUnit]);

  const tradingPlanExpectedProfit = useMemo(() => {
    if (tradingPlanShareCount <= 0 || tradingPlanPrimaryTarget?.diff == null) return null;
    return tradingPlanShareCount * tradingPlanPrimaryTarget.diff;
  }, [tradingPlanShareCount, tradingPlanPrimaryTarget]);

  const tradingPlanCalculatorRiskReward = useMemo(() => {
    if (tradingPlanExpectedProfit == null || !tradingPlanExpectedLoss) return tradingPlanRiskReward.primary;
    return tradingPlanExpectedProfit / tradingPlanExpectedLoss;
  }, [tradingPlanExpectedProfit, tradingPlanExpectedLoss, tradingPlanRiskReward]);

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
    const governance = fundamentals?.governance;

    const keyFacts = [
      { label: 'Exchange', value: profileInfo?.exchange },
      { label: 'Quote Type', value: profileInfo?.quoteType },
      { label: 'Market State', value: profileInfo?.marketState },
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
                        <div className="h-1.5 rounded-full bg-muted">
                          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                {governance.governanceEpochDate && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    As of {formatTimestamp(governance.governanceEpochDate, { dateOnly: true }) ?? '—'}
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

  const renderTradingPlanTab = () => {
    if (!hasTradingPlan) {
      return (
        <div className="rounded-xl border border-border/60 py-10 px-4 flex flex-col items-center justify-center gap-1.5 text-center">
          <p className="text-sm font-semibold text-foreground">No Trading Plan Available</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            A plan appears automatically once a breakout signal is detected for this symbol.
          </p>
        </div>
      );
    }

    const rr = tradingPlanRiskReward.primary;
    const rrLabel = rr != null ? `1 : ${rr.toFixed(1)}` : '—';
    const rrTone = rr == null
      ? 'text-muted-foreground'
      : rr >= 2
        ? 'text-emerald-600 dark:text-emerald-400'
        : rr >= 1.2
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';
    const perTargetRR = tradingPlanRiskReward.perTarget;
    const firstRR = perTargetRR[0];
    const lastRR = perTargetRR[perTargetRR.length - 1];
    const riskPresets = [0.5, 1, 2];

    return (
      <div className="space-y-3 text-xs">
        {/* 1. Header + Trade Quality */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            {screeningSignalDateLabel && (
              <span className="text-[10px] text-muted-foreground/70 shrink-0">{screeningSignalDateLabel}</span>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${tradingPlanQualityTier.bg} ${tradingPlanQualityTier.tone}`}>
            {tradingPlanQualityTier.label}
          </span>
        </div>

        {/* 2. Risk : Reward — the headline metric */}
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Risk : Reward</p>
            <p className={`text-2xl font-bold leading-none ${rrTone}`}>{rrLabel}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Risk {formatPriceValue(tradingPlanRiskPerUnit)} to reach {tradingPlanPrimaryTarget?.label ?? 'target'} · {tradingPlanPrimaryTarget?.reason ?? '—'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground mb-0.5">Range TP1→TP3</p>
            <p className="text-xs font-semibold text-foreground">
              {firstRR != null ? `1:${firstRR.toFixed(1)}` : '—'} → {lastRR != null ? `1:${lastRR.toFixed(1)}` : '—'}
            </p>
          </div>
        </div>

        {/* 3. Entry */}
        <div className="rounded-xl border border-border/60 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-foreground">Entry</p>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {tradingPlanEntryZone.type}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-bold text-foreground">{formatPriceValue(tradingPlanEntryPrice)}</p>
            <p className="text-[10px] text-muted-foreground text-right">
              Buy zone {formatPriceValue(tradingPlanEntryZone.low)}–{formatPriceValue(tradingPlanEntryZone.high)}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">{tradingPlanEntryZone.reason}</p>
        </div>

        {/* 4. Stop Loss */}
        <div className="rounded-xl border border-border/60 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-foreground">Stop Loss</p>
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
              {tradingPlanStopLossPct != null ? `${tradingPlanStopLossPct.toFixed(2)}%` : '—'}
            </span>
          </div>
          <p className="text-base font-bold text-red-600 dark:text-red-400">{formatPriceValue(tradingPlanStopLossPrice)}</p>
          <p className="text-[10px] text-muted-foreground">{tradingPlanStopLossReason}</p>
        </div>

        {/* 5. Take Profit Strategy */}
        <div className="rounded-xl border border-border/60 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Take Profit Strategy</p>
          <div className="space-y-2">
            {tradingPlanTargets.map((target) => (
              <div
                key={target.label}
                className="flex items-start justify-between gap-3 pb-2 border-b border-border/40 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{target.label}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{target.reason}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Sell {target.sellPercent}% · {target.action}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{formatPriceValue(target.price)}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {target.pct != null ? `+${target.pct.toFixed(1)}%` : '—'}
                    {target.rMultiple != null ? ` · ${target.rMultiple.toFixed(1)}R` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Position Size Calculator — risk-first, no manual share math */}
        <div className="rounded-xl border border-border/60 p-3 space-y-3">
          <p className="text-[11px] font-semibold text-foreground">Position Size Calculator</p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Account Balance</label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={tradingPlanBalanceInput}
                onChange={(event) => setTradingPlanBalanceInput(event.target.value)}
                className="text-xs h-8"
                placeholder="e.g. 50,000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Risk %</label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={tradingPlanRiskPercentInput}
                onChange={(event) => setTradingPlanRiskPercentInput(event.target.value)}
                className="text-xs h-8"
                placeholder="1"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {riskPresets.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="xs"
                variant={Number(tradingPlanRiskPercentInput) === preset ? 'default' : 'ghost'}
                className={`px-2 py-0.5 text-[10px] rounded-full ${Number(tradingPlanRiskPercentInput) === preset ? 'shadow-sm' : ''}`}
                onClick={() => setTradingPlanRiskPercentInput(String(preset))}
              >
                {preset}%
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Your Entry Price</label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.0001"
              min="0"
              value={tradingPlanEntryInput}
              onChange={(event) => setTradingPlanEntryInput(event.target.value)}
              className="text-xs h-8"
              placeholder={tradingPlanPayload?.entry_price ? `Default: ${tradingPlanPayload.entry_price}` : 'e.g. 125.50'}
            />
          </div>

          <div className="rounded-lg bg-muted/30 p-2.5 grid grid-cols-2 gap-y-2.5 gap-x-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Max Risk Amount</p>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{formatPlanCurrencyValue(tradingPlanMaxRiskAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Position Size</p>
              <p className="text-xs font-semibold text-foreground">{tradingPlanSizeSummary || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Position Cost</p>
              <p className="text-xs font-semibold text-foreground">{formatPlanCurrencyValue(tradingPlanPositionCost)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Risk : Reward</p>
              <p className="text-xs font-semibold text-foreground">
                {tradingPlanCalculatorRiskReward != null ? `1 : ${tradingPlanCalculatorRiskReward.toFixed(1)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Expected Loss (at SL)</p>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                {formatPlanCurrencyDelta(tradingPlanExpectedLoss != null ? -tradingPlanExpectedLoss : null)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Expected Profit ({tradingPlanPrimaryTarget?.label ?? 'TP'})</p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {formatPlanCurrencyDelta(tradingPlanExpectedProfit)}
              </p>
            </div>
          </div>
        </div>

        {/* 7. Technical Confirmation */}
        <div className="rounded-xl border border-border/60 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Technical Confirmation</p>
          <ul className="space-y-1">
            {tradingPlanTechnicalConfirmations.map((line, index) => (
              <li key={index} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <span className="mt-[5px] h-1 w-1 rounded-full bg-emerald-500 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-border/40">
            <div>
              <p className="text-[10px] text-muted-foreground">Swing Low</p>
              <p className="text-[11px] font-semibold">{formatPriceValue(tradingPlanBasisValues.swing)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">EMA20</p>
              <p className="text-[11px] font-semibold">{formatPriceValue(tradingPlanBasisValues.ema)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">ATR(14)</p>
              <p className="text-[11px] font-semibold">{formatPriceValue(tradingPlanBasisValues.atr)}</p>
            </div>
          </div>
        </div>
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
          <div className="grid gap-2 grid-cols-1">
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
        { label: 'Market State', value: marketData.marketState || null },
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
        { label: 'Timezone', value: marketData.exchangeTimezoneName || null },
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
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {snapshotRows.map((item) => (
                  <div key={item.label} className="space-y-0.5">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="font-semibold text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
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
                        {[
                          { value: 'annual', label: 'Annual', disabled: !hasAnnualRevenue },
                          { value: 'quarterly', label: 'Quarterly', disabled: false },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            size="xs"
                            variant={revenuePeriod === option.value ? 'default' : 'ghost'}
                            className={`px-2 py-1 text-xs rounded-full ${revenuePeriod === option.value ? 'shadow-sm' : ''
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

    const { breakdown = [], totalOpinions, ratingLabel, ratingBgClass, ratingTextClass, ratingScore, priceTargets } =
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
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
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
                  <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Low</p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {lowTarget != null ? formatDetailedCurrency(lowTarget) : '—'}
                  </p>
                  {lowTarget != null && currentPrice != null && (
                    <p className={`text-[10px] mt-0.5 font-medium ${lowTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
                      {lowTarget >= currentPrice ? '+' : ''}{(((lowTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-500/8 p-3 text-center ring-1 ring-emerald-500/20">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Average</p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {averageTarget != null ? formatDetailedCurrency(averageTarget) : '—'}
                  </p>
                  {averageTarget != null && currentPrice != null && (
                    <p className={`text-[10px] mt-0.5 font-medium ${averageTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
                      {averageTarget >= currentPrice ? '+' : ''}{(((averageTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-emerald-500/8 p-3 text-center">
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">High</p>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {highTarget != null ? formatDetailedCurrency(highTarget) : '—'}
                  </p>
                  {highTarget != null && currentPrice != null && (
                    <p className={`text-[10px] mt-0.5 font-medium ${highTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>
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
                <div className="flex justify-between text-[10px] text-muted-foreground px-2">
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
                        <p className="text-[10px] text-muted-foreground font-medium">{entry.periodLabel}</p>
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
                      <span className="font-semibold text-foreground">{entry.period || `-${idx}m`}</span>
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
                    <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
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
                <div className="h-4 w-32 rounded-full shimmer" />
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-20 rounded-full shimmer" />
                      <div className="h-4 w-24 rounded-full shimmer" />
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
              <dl className="grid grid-cols-1 gap-3">
                {cal.earningsDate?.length > 0 && (
                  <div className="flex items-center justify-between py-2 border-b border-border/20">
                    <dt className="text-xs text-muted-foreground">Next Earnings</dt>
                    <dd className="text-xs font-medium">{formatDate(cal.earningsDate[0])}</dd>
                  </div>
                )}
                {cal.exDividendDate && (
                  <div className="flex items-center justify-between py-2 border-b border-border/20">
                    <dt className="text-xs text-muted-foreground">Ex-Dividend Date</dt>
                    <dd className="text-xs font-medium">{formatDate(cal.exDividendDate)}</dd>
                  </div>
                )}
                {cal.dividendDate && (
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-xs text-muted-foreground">Dividend Pay Date</dt>
                    <dd className="text-xs font-medium">{formatDate(cal.dividendDate)}</dd>
                  </div>
                )}
                {marketData?.earningsCallTimestampStart && (
                  <div className="flex items-center justify-between py-2 border-t border-border/20">
                    <dt className="text-xs text-muted-foreground">Earnings Call</dt>
                    <dd className="text-xs font-medium">{formatTimestamp(marketData.earningsCallTimestampStart) ?? '—'}</dd>
                  </div>
                )}
              </dl>
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
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
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
                  <div key={item.label} className="space-y-0.5">
                    <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                    <dd className={`text-xs font-semibold ${item.highlight === 'pos' ? 'text-emerald-500' : item.highlight === 'neg' ? 'text-red-500' : ''}`}>
                      {item.value}
                    </dd>
                  </div>
                ))}
              </div>
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
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${Math.min(100, Math.max(0, (item.value || 0) * 100))}%` }}
                      />
                    </div>
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
                      <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                      <dd className={`text-xs font-semibold ${item.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
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
                    <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
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
                    <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
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
                    <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
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
                        <p className="text-[11px] text-muted-foreground">
                          {entry.fromGrade ? `${entry.fromGrade} → ` : ''}{entry.toGrade || '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[11px] font-semibold ${actionColor}`}>{actionLabel}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(entry.date)}</p>
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

  const renderSeasonalityTab = () => {
    if (quarterlyHeatmap.rows.length === 0 && monthlyHeatmap.rows.length === 0) {
      return (
        <Card>
          <CardContent className="text-xs text-muted-foreground py-6 text-center">
            Seasonality data unavailable for {symbol}.
          </CardContent>
        </Card>
      );
    }

    // Compute summary stats
    const qAvgs = [1, 2, 3, 4]
      .map((q) => quarterlyHeatmap.average?.[`Q${q}`])
      .filter((v) => typeof v === 'number' && !isNaN(v));
    const mAvgs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      .map((m) => monthlyHeatmap.average?.[`M${m}`])
      .filter((v) => typeof v === 'number' && !isNaN(v));
    const bestQIdx = qAvgs.length ? qAvgs.indexOf(Math.max(...qAvgs)) : -1;
    const worstQIdx = qAvgs.length ? qAvgs.indexOf(Math.min(...qAvgs)) : -1;
    const bestQ = bestQIdx >= 0 ? qAvgs[bestQIdx] : null;
    const worstQ = worstQIdx >= 0 ? qAvgs[worstQIdx] : null;
    const qWinRate = qAvgs.length ? Math.round((qAvgs.filter((v) => v > 0).length / qAvgs.length) * 100) : null;
    const bestMIdx = mAvgs.length ? mAvgs.indexOf(Math.max(...mAvgs)) : -1;
    const worstMIdx = mAvgs.length ? mAvgs.indexOf(Math.min(...mAvgs)) : -1;
    const bestM = bestMIdx >= 0 ? mAvgs[bestMIdx] : null;
    const worstM = worstMIdx >= 0 ? mAvgs[worstMIdx] : null;
    const mWinRate = mAvgs.length ? Math.round((mAvgs.filter((v) => v > 0).length / mAvgs.length) * 100) : null;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const qNames = ['Q1', 'Q2', 'Q3', 'Q4'];

    return (
      <div className="space-y-3">
        {/* Stats header */}
        {(bestQ != null || bestM != null) && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Best Avg</p>
              <p className="text-xs font-bold text-emerald-500">
                {bestQ != null ? `${bestQ >= 0 ? '+' : ''}${bestQ.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{bestQIdx >= 0 ? qNames[bestQIdx] : ''}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Worst Avg</p>
              <p className={`text-xs font-bold ${worstQ != null && worstQ < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {worstQ != null ? `${worstQ >= 0 ? '+' : ''}${worstQ.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{worstQIdx >= 0 ? qNames[worstQIdx] : ''}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Q Win Rate</p>
              <p className={`text-xs font-bold ${qWinRate != null && qWinRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                {qWinRate != null ? `${qWinRate}%` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{qAvgs.filter((v) => v > 0).length}/{qAvgs.length} pos</p>
            </div>
          </div>
        )}
        {mAvgs.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Best Month</p>
              <p className="text-xs font-bold text-emerald-500">
                {bestM != null ? `${bestM >= 0 ? '+' : ''}${bestM.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{bestMIdx >= 0 ? monthNames[bestMIdx] : ''}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Worst Month</p>
              <p className={`text-xs font-bold ${worstM != null && worstM < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {worstM != null ? `${worstM >= 0 ? '+' : ''}${worstM.toFixed(1)}%` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{worstMIdx >= 0 ? monthNames[worstMIdx] : ''}</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium mb-1">M Win Rate</p>
              <p className={`text-xs font-bold ${mWinRate != null && mWinRate >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>
                {mWinRate != null ? `${mWinRate}%` : '—'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{mAvgs.filter((v) => v > 0).length}/{mAvgs.length} pos</p>
            </div>
          </div>
        )}

        <Accordion type="multiple" defaultValue={['quarterly', 'monthly']}>
          <AccordionItem value="quarterly" className="border-b-0">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              Quarterly Returns
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">Year</th>
                      {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, idx) => (
                        <th key={idx} className="text-center py-2 px-2 font-medium">{quarter}</th>
                      ))}
                      <th className="text-center py-2 px-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b-2 font-semibold bg-muted/50">
                      <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg.</td>
                      {[1, 2, 3, 4].map((quarter) => {
                        const value = quarterlyHeatmap.average[`Q${quarter}`];
                        return (
                          <td key={quarter} className="text-center py-2 px-2 transition-colors font-bold" style={getReturnCellStyle(value)}>
                            {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                          </td>
                        );
                      })}
                      {(() => {
                        const value = quarterlyHeatmap.average?.Total;
                        return (
                          <td className="text-center py-2 px-2 transition-colors font-bold" style={getReturnCellStyle(value)}>
                            {value !== null && value !== undefined ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                          </td>
                        );
                      })()}
                    </tr>
                    {quarterlyHeatmap.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                        {[1, 2, 3, 4].map((quarter) => {
                          const value = row[`Q${quarter}`];
                          return (
                            <td key={quarter} className="text-center py-2 px-2 transition-colors" style={getReturnCellStyle(value)}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-2 transition-colors font-bold" style={getReturnCellStyle(row.Total)}>
                          {row.Total !== null && row.Total !== undefined ? `${row.Total >= 0 ? '+' : ''}${row.Total.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold bg-muted/50">
                      <td className="py-2 px-1 sticky left-0 bg-muted/50">Prob.</td>
                      {[1, 2, 3, 4].map((quarter) => {
                        const value = quarterlyHeatmap.winRate?.[`Q${quarter}`];
                        return (
                          <td key={quarter} className="text-center py-2 px-2 transition-colors font-bold" style={getWinRateCellStyle(value)}>
                            {value !== null && value !== undefined ? `${value.toFixed(0)}%` : '-'}
                          </td>
                        );
                      })}
                      {(() => {
                        const value = quarterlyHeatmap.winRate?.Total;
                        return (
                          <td className="text-center py-2 px-2 transition-colors font-bold" style={getWinRateCellStyle(value)}>
                            {value !== null && value !== undefined ? `${value.toFixed(0)}%` : '-'}
                          </td>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="monthly" className="border-b-0">
            <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
              Monthly Returns
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">Year</th>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                        <th key={idx} className="text-center py-2 px-1 font-medium">{month}</th>
                      ))}
                      <th className="text-center py-2 px-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b-2 font-semibold bg-muted/50">
                      <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg.</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                        const value = monthlyHeatmap.average[`M${month}`];
                        return (
                          <td key={month} className="text-center py-2 px-1 transition-colors font-bold" style={getReturnCellStyle(value)}>
                            {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                          </td>
                        );
                      })}
                      {(() => {
                        const value = monthlyHeatmap.average?.Total;
                        return (
                          <td className="text-center py-2 px-1 transition-colors font-bold" style={getReturnCellStyle(value)}>
                            {value !== null && value !== undefined ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                          </td>
                        );
                      })()}
                    </tr>
                    {monthlyHeatmap.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                          const value = row[`M${month}`];
                          return (
                            <td key={month} className="text-center py-2 px-1 transition-colors" style={getReturnCellStyle(value)}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-1 transition-colors font-bold" style={getReturnCellStyle(row.Total)}>
                          {row.Total !== null && row.Total !== undefined ? `${row.Total >= 0 ? '+' : ''}${row.Total.toFixed(1)}%` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold bg-muted/50">
                      <td className="py-2 px-1 sticky left-0 bg-muted/50">Prob.</td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => {
                        const value = monthlyHeatmap.winRate?.[`M${month}`];
                        return (
                          <td key={month} className="text-center py-2 px-1 transition-colors font-bold" style={getWinRateCellStyle(value)}>
                            {value !== null && value !== undefined ? `${value.toFixed(0)}%` : '-'}
                          </td>
                        );
                      })}
                      {(() => {
                        const value = monthlyHeatmap.winRate?.Total;
                        return (
                          <td className="text-center py-2 px-1 transition-colors font-bold" style={getWinRateCellStyle(value)}>
                            {value !== null && value !== undefined ? `${value.toFixed(0)}%` : '-'}
                          </td>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pb-8">
      <div className="lg:col-span-12 flex justify-between gap-2 mb-4 lg:mb-0">
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
            {formatTickerDisplay(symbol)} <ChevronDown className="size-4 dark:text-white/70" />
          </h1>
          <span className="text-muted">|</span>
          {symbol.endsWith('.JK') && (
            <span className="dark:text-white/70 text-xs">🇮🇩</span>
          )}
          {symbol.endsWith('-USD') && (
            <span className="dark:text-white/70 text-xs flex items-center gap-1"><Bitcoin className="size-4 text-amber-600" /></span>
          )}
          {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
            <span className="dark:text-white/70 text-xs">🇺🇸</span>
          )}
          {['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'AVGO'].some((s) => symbol.endsWith(s)) && (
            <span className="dark:text-white/70 text-xs flex items-center gap-1">🇺🇸</span>
          )}
        </div>
        <div className="flex gap-3">
          <Select
            className="w-full"
            value={selectedCycles.join(',')}
            onValueChange={(value) => setSelectedCycles(value.split(','))}
          >
            <SelectTrigger className="h-8 text-[11px]">
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
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remove ${symbol} from favorites` : `Add ${symbol} to favorites`}
            className={`rounded-full p-1 transition-colors ${isFavorite ? 'text-amber-600 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Star
              className="size-5.5"
              strokeWidth={isFavorite ? 1.2 : 1.5}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      </div>

      <div className="lg:col-span-8 flex flex-col gap-2">
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
                <div className="w-full h-[380px] lg:h-[500px] rounded-xl shimmer"></div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex-1 h-7 rounded-full shimmer"></div>
              ))}
            </div>

            <div className="h-10 rounded-xl shimmer"></div>
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
                            <span className="text-[10px] text-muted-foreground">
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
                    <div className="flex h-[380px] lg:h-[500px] items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading {normalTimeframeLabel} candles…
                    </div>
                  ) : filteredNormalChartData.length > 0 ? (
                    <>
                      <div className="relative left-1/2 right-1/2 -translate-x-1/2 w-screen max-w-[768px] lg:max-w-[calc(100vw-3rem)]">
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
                          valueLabelPrefix={chartDisplayType === 'heikinAshi' ? "HA" : ""}
                          showTooltip={false}
                          priceScaleType={scaleChoice}
                          height={450}
                          seriesType={chartDisplayType === 'line' ? 'line' : 'candlestick'}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[380px] lg:h-[500px] items-center justify-center text-xs text-muted-foreground">
                      {normalSeriesError || `Price data unavailable for the ${normalTimeframeLabel} timeframe.`}
                    </div>
                  )
                ) : (
                  <div className="relative h-[380px] lg:h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={filteredChartData}
                        margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                      >
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
                            fill="transparent"
                            fillOpacity={0}
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
                <div className="flex flex-wrap justify-center items-center gap-1 mt-4 lg:mt-2">
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
                        className="absolute top-5 left-5 cursor-pointer"
                        onClick={() => setNormalFullscreenOpen(false)}
                      >
                        <ArrowLeft className="size-6 text-muted-foreground" />
                      </div>
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
                        showTimeScale={showIntradayScale}
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
                {['all', 'Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                  <button
                    key={q}
                    className={`w-16 h-6 text-xs font-semibold rounded-sm border-1.5 transition-colors ${quarterFilter === q
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
          </>
        )}
      </div>

      <div className="lg:col-span-4 flex flex-col gap-4">
        {loading && (
          <div className="mt-4 flex flex-col gap-8 lg:mt-0">
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
            <div className="grid gap-2">
              <Card>
                <CardHeader className="gap-1">
                  <CardTitle className="text-sm">Earnings Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[240px] rounded-xl shimmer"></div>
                </CardContent>
              </Card>
            </div>
            <div className="border-b border-border/20 pb-2 flex flex-wrap gap-2">
              {[...Array(4)].map((_, idx) => (
                <div key={`tab-${idx}`} className="h-8 w-16 rounded-full shimmer" />
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {[...Array(5)].map((_, idx) => (
                  <div key={`analysis-${idx}`} className="h-3 rounded-full shimmer w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {showChartSection && (
          <div className="space-y-4 mt-6 lg:mt-0">
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
                <div className="flex gap-2 border-b border-border/30 text-[11px] overflow-x-auto whitespace-nowrap flex-nowrap pb-1 hide-scrollbar">
                  {infoTabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      className={`flex-shrink-0 px-2 py-2 uppercase font-semibold transition-colors ${infoTab === tab.value
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
                  {infoTab === 'trading-plan' && renderTradingPlanTab()}
                  {infoTab === 'profile' && renderProfileTab()}
                  {infoTab === 'keystats' && renderKeyStatsTab()}
                  {infoTab === 'analysis' && renderAnalysisTab()}
                  {infoTab === 'financials' && renderFinancialsTab()}
                  {infoTab === 'seasonality' && renderSeasonalityTab()}
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
