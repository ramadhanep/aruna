"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useId } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Lock, Download, Droplets, Axe, Magnet, Rotate3D, MessageCircleMore, Flame, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";
import { TickerAvatar } from "@/components/ticker-avatar";
import { TrendingMarquee } from "@/components/trending-marquee";
import { formatTickerDisplay } from "@/lib/utils";
import { MoneyFlowCard } from "@/components/money-flow-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CATEGORY_LABELS = {
  idx: "IDX 🇮🇩",
  us: "US 🇺🇸",
  crypto: "Crypto ⚡",
};

const CATEGORY_ORDER = ["idx", "us", "crypto"];


const HIGHLIGHT_SYMBOLS = [
  { symbol: "^JKSE", label: "IHSG", badge: "JK", group: "ID", accent: "bg-amber-500", logo: "https://s3-symbol-logo.tradingview.com/indices/jakarta-composite-index.svg" },
  { symbol: "BTC-USD", label: "Bitcoin", badge: "BTC", group: "Crypto", accent: "bg-emerald-500" },
  { symbol: "^SPX", label: "S&P 500", badge: "500", group: "US", accent: "bg-rose-500", logo: "https://s3-symbol-logo.tradingview.com/country/US.svg" },
  { symbol: "^IXIC", label: "Nasdaq", badge: "100", group: "US", accent: "bg-sky-500", logo: "https://s3-symbol-logo.tradingview.com/nasdaq.svg" },
  { symbol: "^N225", label: "Japan 225", badge: "225", group: "JP", accent: "bg-sky-500", logo: "https://s3-symbol-logo.tradingview.com/country/JP.svg" },
  { symbol: "^KS11", label: "KOSPI", badge: "KS11", group: "KR", accent: "bg-sky-500", logo: "https://s3-symbol-logo.tradingview.com/country/KR.svg" },
  { symbol: "DAX", label: "DAX", badge: "DAX", group: "DE", accent: "bg-sky-500", logo: "https://s3-symbol-logo.tradingview.com/country/DE.svg" },
  { symbol: "GC=F", label: "Gold", badge: "GC", group: "CM", accent: "bg-sky-500", logo: "https://s3-symbol-logo.tradingview.com/metal/gold.svg" },
];

function isWithinMarketHours(timeZone, openHour, openMinute, closeHour, closeMinute) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const weekday = (get("weekday") || "").slice(0, 3).toLowerCase();
    if (weekday === "sat" || weekday === "sun") return false;
    const totalMinutes = hour * 60 + minute;
    const open = openHour * 60 + openMinute;
    const close = closeHour * 60 + closeMinute;
    return totalMinutes >= open && totalMinutes <= close;
  } catch (error) {
    console.warn("Failed to evaluate market hours", error);
    return false;
  }
}

function getCategoryDisplayOrder() {
  const isUsOpen = isWithinMarketHours("America/New_York", 9, 30, 16, 0);
  const isIdxOpen = isWithinMarketHours("Asia/Jakarta", 9, 0, 15, 15);

  if (isUsOpen && !isIdxOpen) {
    return ["us", "idx", "crypto"];
  }
  if (isIdxOpen && !isUsOpen) {
    return ["idx", "us", "crypto"];
  }
  if (isUsOpen && isIdxOpen) {
    return ["us", "idx", "crypto"];
  }
  return CATEGORY_ORDER;
}

function formatCompactNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatPercent(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const numeric = Number(value);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(digits)}%`;
}

function formatLocalDateTimeLabel(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeAgo(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const diffSeconds = (date.getTime() - Date.now()) / 1000;
  const divisions = [
    { amount: 60, unit: "second" },
    { amount: 60, unit: "minute" },
    { amount: 24, unit: "hour" },
    { amount: 7, unit: "day" },
    { amount: 4.34524, unit: "week" },
    { amount: 12, unit: "month" },
    { amount: Infinity, unit: "year" },
  ];
  const formatter =
    typeof Intl !== "undefined" && typeof Intl.RelativeTimeFormat === "function"
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
      : null;
  let remainder = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(remainder) < division.amount) {
      if (formatter) {
        return formatter.format(Math.round(remainder), division.unit);
      }
      const valueAbs = Math.round(Math.abs(remainder));
      const label = valueAbs === 1 ? division.unit : `${division.unit}s`;
      return remainder <= 0 ? `${valueAbs} ${label} ago` : `in ${valueAbs} ${label}`;
    }
    remainder /= division.amount;
  }
  return "";
}

function formatLocalTimeLabel(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameCalendarDay(dateA, dateB = new Date()) {
  if (!dateA) return false;
  const a = typeof dateA === "string" ? new Date(dateA) : dateA;
  if (Number.isNaN(a.getTime())) return false;
  return (
    a.getFullYear() === dateB.getFullYear() &&
    a.getMonth() === dateB.getMonth() &&
    a.getDate() === dateB.getDate()
  );
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizePick(item) {
  if (!item) return null;
  if (typeof item === "string") {
    return { symbol: item };
  }
  if (typeof item.symbol === "string" && item.symbol.trim().length > 0) {
    return item;
  }
  return null;
}

function resolveChangePercent(pick, quote) {
  if (quote && typeof quote.changePercent === "number") {
    return quote.changePercent;
  }
  if (pick && typeof pick.changePercent === "number") {
    return pick.changePercent;
  }
  return null;
}

function resolvePrice(pick, quote) {
  if (quote && typeof quote.price === "number") {
    return quote.price;
  }
  if (pick && typeof pick.lastClose === "number") {
    return pick.lastClose;
  }
  return null;
}

function resolveName(pick, quote) {
  if (quote && typeof quote.name === "string" && quote.name.trim().length > 0) {
    return quote.name;
  }
  if (pick && typeof pick.name === "string" && pick.name.trim().length > 0) {
    return pick.name;
  }
  return pick?.symbol || "";
}

function sortPicksByDescendingChange(picks, quotes) {
  return [...picks].sort((a, b) => {
    const changeA = resolveChangePercent(a, quotes[a.symbol]);
    const changeB = resolveChangePercent(b, quotes[b.symbol]);
    const hasA = typeof changeA === "number";
    const hasB = typeof changeB === "number";
    if (hasA && hasB) {
      return changeB - changeA;
    }
    if (hasA) {
      return -1;
    }
    if (hasB) {
      return 1;
    }
    return 0;
  });
}

function ShimmerItem() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 w-16 rounded-full shimmer"></div>
        <div className="h-3 w-32 rounded-full shimmer"></div>
      </div>
      <div className="w-[72px] h-[36px] rounded-xl shimmer"></div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-3 w-20 rounded-full shimmer"></div>
        <div className="h-3 w-16 rounded-full shimmer"></div>
      </div>
    </div>
  );
}

function MiniChart({ data, isPositive, width = 72, height = 36, chartId }) {
  const generatedId = useId();
  const gradientKey = chartId ?? generatedId;
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className="rounded-full bg-muted/40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coordinates = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const linePath = coordinates
    .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${coordinates[coordinates.length - 1].x.toFixed(2)},${height} L0,${height} Z`;
  const strokeColor = isPositive ? "#10b981" : "#ef4444";
  const gradientId = `${gradientKey}-fill`;

  // Calculate baseline at first data point (represents 0% change)
  const firstValue = data[0];
  const baselineY = height - ((firstValue - min) / range) * height;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Baseline reference line */}
      <line
        x1="0"
        y1={baselineY}
        x2={width}
        y2={baselineY}
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2,2"
        opacity="0.3"
        className="text-muted-foreground"
      />
      <path d={areaPath} fill={`url(#${gradientId})`} opacity="0.9" />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coordinates[coordinates.length - 1].x}
        cy={coordinates[coordinates.length - 1].y}
        r={2.4}
        fill={strokeColor}
      />
    </svg>
  );
}


function PickItem({ pick, quote }) {
  const symbol = typeof pick === "string" ? pick : pick?.symbol;
  if (!symbol) return null;
  const pickData = pick && typeof pick === "object" ? pick : {};
  const isNewSignal = isSameCalendarDay(pickData?.signal_date);
  const change =
    typeof quote?.change === "number"
      ? quote.change
      : typeof pickData?.change === "number"
        ? pickData.change
        : 0;
  const changePercent =
    typeof quote?.changePercent === "number"
      ? quote.changePercent
      : typeof pickData?.changePercent === "number"
        ? pickData.changePercent
        : 0;
  const price =
    typeof quote?.price === "number"
      ? quote.price
      : typeof pickData?.lastClose === "number"
        ? pickData.lastClose
        : null;
  const isPositive = change >= 0;
  const color = isPositive ? "text-emerald-600" : "text-red-600";
  const formattedPrice = typeof price === "number"
    ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";
  const displayName = quote?.name || pickData?.name || symbol;
  const isWarning = Boolean(pickData?.is_warning);
  const chartData =
    Array.isArray(quote?.chartData) && quote.chartData.length > 0
      ? quote.chartData
      : Array.isArray(pickData?.sparkline)
        ? pickData.sparkline
        : [];
  const logo = quote?.logo || null;

  return (
    <Link
      href={`/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal&tab=tradingPlan`}
      className="flex items-center gap-3 py-3.5 px-1 hover:bg-accent/40 transition-all duration-200 rounded-xl -mx-1"
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="flex-shrink-0">
          <TickerAvatar symbol={symbol} logo={logo} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            <span>{formatTickerDisplay(symbol)}</span>
            {isNewSignal ? (
              <span className="text-[9px] font-bold tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-1.5 py-[2px] rounded-md">
                NEW
              </span>
            ) : null}
            {isWarning ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title="High volume vs market cap" />
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{displayName}</div>
        </div>
      </div>
      <div className={`flex items-center ${Array.isArray(chartData) ? color : "text-muted-foreground"}`}>
        <MiniChart data={chartData} isPositive={isPositive} chartId={`explore-${symbol}`} />
      </div>
      <div className="flex flex-col items-end">
        <div className="font-semibold text-sm tabular-nums">{formattedPrice}</div>
        <div className={`text-xs font-medium flex items-center gap-1 ${color}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? "+" : ""}
          {changePercent?.toFixed ? changePercent.toFixed(2) : "0.00"}%
        </div>
      </div>
    </Link>
  );
}

function formatMoneyFlowDelta(value) {
  const numeric = Number(value || 0) * 100;
  const sign = numeric >= 0 ? "+" : "";
  return `${sign}${numeric.toFixed(2)}%`;
}



export default function ExplorePage() {
  const { supabase, user } = useAuth();
  const [snapshots, setSnapshots] = useState({});
  const [quotes, setQuotes] = useState({});
  const [moneyFlowReports, setMoneyFlowReports] = useState([]);
  const [moneyFlowUpdatedAt, setMoneyFlowUpdatedAt] = useState(null);
  const [moneyFlowLoading, setMoneyFlowLoading] = useState(true);
  const [moneyFlowError, setMoneyFlowError] = useState("");
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isHighlightsExpanded, setIsHighlightsExpanded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [manualLoading, setManualLoading] = useState({ idx: false, us: false, crypto: false });
  const [categoryDisplayOrder] = useState(() => getCategoryDisplayOrder());
  const touchStartY = useRef(0);
  const containerRef = useRef(null);
  const quoteRequestRef = useRef(0);

  const loadQuotesForSnapshots = useCallback(async (snapshotMap) => {
    const requestId = ++quoteRequestRef.current;

    const symbolSet = new Set();
    CATEGORY_ORDER.forEach((category) => {
      const picks = Array.isArray(snapshotMap?.[category]?.results)
        ? snapshotMap[category].results
        : [];
      picks.forEach((pick) => {
        const symbol = typeof pick === "string" ? pick : pick?.symbol;
        if (symbol) {
          symbolSet.add(symbol);
        }
      });
    });
    HIGHLIGHT_SYMBOLS.forEach(({ symbol }) => symbolSet.add(symbol));

    if (symbolSet.size === 0) {
      if (quoteRequestRef.current === requestId) {
        setQuotes({});
      }
      return;
    }

    const symbolsArray = Array.from(symbolSet);

    try {
      const { response, data } = await fetchEncodedJson('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: symbolsArray }),
      });

      if (quoteRequestRef.current !== requestId) {
        return;
      }

      if (!response.ok) {
        console.warn('Failed to fetch batch quotes:', data?.error);
        return;
      }

      const batchQuotes = data?.quotes || {};

      setQuotes((prev) => {
        const next = {};
        symbolsArray.forEach((symbol) => {
          const upperSymbol = symbol.toUpperCase();
          if (batchQuotes[upperSymbol]) {
            next[symbol] = batchQuotes[upperSymbol];
          } else if (prev[symbol]) {
            next[symbol] = prev[symbol];
          }
        });
        return next;
      });
    } catch (error) {
      console.warn('Failed to fetch batch quotes', error);
    }
  }, []);

  const loadSnapshots = useCallback(async () => {
    if (!supabase) {
      setSnapshots({});
      setQuotes({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("screening_snapshots")
        .select("*")
        .in("category", CATEGORY_ORDER);
      if (error) {
        console.warn("Failed to load screening snapshots", error);
        setSnapshots({});
        setQuotes({});
        return;
      }
      const mapped = {};
      data?.forEach((item) => {
        mapped[item.category] = item;
      });
      setSnapshots(mapped);
      await loadQuotesForSnapshots(mapped);
    } finally {
      setLoading(false);
    }
  }, [supabase, loadQuotesForSnapshots]);

  const loadMoneyFlow = useCallback(async () => {
    setMoneyFlowLoading(true);
    setMoneyFlowError("");
    try {
      const params = new URLSearchParams({
        timeframe: "weekly",
        sort: "score",
        order: "desc",
        limit: "5",
      });
      const { response, data } = await fetchEncodedJson(`/api/money-flow?${params.toString()}`);
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to load money-flow highlights");
      }
      setMoneyFlowReports(Array.isArray(data?.reports) ? data.reports : []);
      if (data?.updated_at) {
        setMoneyFlowUpdatedAt(new Date(data.updated_at));
      }
    } catch (error) {
      console.warn("Failed to load money-flow highlights", error);
      setMoneyFlowError(error?.message || "Failed to load money-flow highlights");
      setMoneyFlowReports([]);
      setMoneyFlowUpdatedAt(null);
    } finally {
      setMoneyFlowLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    loadMoneyFlow();
  }, [loadMoneyFlow]);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setShowInstallButton(!isStandalone);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(!isStandalone);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }

    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("screening_snapshots_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "screening_snapshots" },
        (payload) => {
          const record = payload?.new;
          if (!record?.category) {
            return;
          }
          setSnapshots((prev) => {
            const next = { ...prev, [record.category]: record };
            loadQuotesForSnapshots(next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadQuotesForSnapshots]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([loadSnapshots(), loadMoneyFlow()]);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, loadMoneyFlow, loadSnapshots]);

  const handleTouchStart = useCallback((event) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = event.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (event) => {
      if (isRefreshing || touchStartY.current === 0 || !containerRef.current) return;
      if (containerRef.current.scrollTop > 0) {
        touchStartY.current = 0;
        setPullDistance(0);
        return;
      }
      const touchY = event.touches[0].clientY;
      const distance = touchY - touchStartY.current;
      if (distance > 0) {
        setPullDistance(Math.min(distance, 150));
      }
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 80) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [pullDistance, handleRefresh]);

  const triggerBatch = useCallback(
    async (category) => {
      if (manualLoading[category]) return;
      setManualLoading((prev) => ({ ...prev, [category]: true }));
      try {
        const { response, data } = await fetchEncodedJson(`/api/screeners/${category}`);
        if (!response.ok) {
          throw new Error(data?.error || "Failed to trigger screener");
        }
        const message = data?.status
          ? `${category.toUpperCase()} → ${data.status.toUpperCase()}`
          : `${category.toUpperCase()} → failed`;
        alert(message);
        await loadSnapshots();
      } catch (error) {
        console.warn("Trigger failed", error);
        alert(`${category.toUpperCase()} → error`);
      } finally {
        setManualLoading((prev) => ({ ...prev, [category]: false }));
      }
    },
    [manualLoading, loadSnapshots]
  );

  const isAuthenticated = Boolean(user);

  const breakoutInsights = useMemo(() => {
    const categories = [];
    const allSignals = [];
    let totalChange = 0;
    let changers = 0;
    let latestTimestamp = null;

    CATEGORY_ORDER.forEach((category) => {
      const snapshot = snapshots[category];
      const rawResults = Array.isArray(snapshot?.results) ? snapshot.results : [];
      const normalized = rawResults
        .map((item) => normalizePick(item))
        .filter(Boolean);
      if (normalized.length === 0) {
        return;
      }
      const lastScreened = snapshot?.updated_at ? new Date(snapshot.updated_at) : null;
      if (lastScreened && (!latestTimestamp || lastScreened > latestTimestamp)) {
        latestTimestamp = lastScreened;
      }

      let categoryChangeSum = 0;
      let categoryChangeCount = 0;

      const enriched = normalized.map((pick) => {
        const symbol = pick.symbol;
        const quote = quotes[symbol];
        const changePercent = resolveChangePercent(pick, quote);
        if (typeof changePercent === "number") {
          totalChange += changePercent;
          changers += 1;
          categoryChangeSum += changePercent;
          categoryChangeCount += 1;
        }
        const detail = {
          symbol,
          pick,
          quote,
          changePercent,
          price: resolvePrice(pick, quote),
        };
        allSignals.push(detail);
        return detail;
      });
      const sortedPicks = sortPicksByDescendingChange(normalized, quotes);

      categories.push({
        category,
        title: CATEGORY_LABELS[category] ?? category,
        snapshot,
        picks: sortedPicks,
        enriched,
        lastScreened,
        averageChange:
          categoryChangeCount > 0 ? categoryChangeSum / categoryChangeCount : null,
      });
    });

    const averageChange = changers > 0 ? totalChange / changers : null;

    const bestGainer = allSignals.reduce((best, signal) => {
      if (typeof signal.changePercent !== "number") return best;
      if (!best || signal.changePercent > best.changePercent) {
        return signal;
      }
      return best;
    }, null);

    const bestLoser = allSignals.reduce((worst, signal) => {
      if (typeof signal.changePercent !== "number") return worst;
      if (!worst || signal.changePercent < worst.changePercent) {
        return signal;
      }
      return worst;
    }, null);

    return {
      categories,
      totalBreakouts: allSignals.length,
      averageChange,
      lastUpdated: latestTimestamp,
      bestGainer,
      bestLoser,
    };
  }, [quotes, snapshots]);

  const highlightClusters = useMemo(
    () =>
      HIGHLIGHT_SYMBOLS.map((meta) => ({
        ...meta,
        quote: quotes[meta.symbol],
      })),
    [quotes]
  );

  const categoriesWithSignals = breakoutInsights.categories;
  const orderedCategories = useMemo(() => {
    if (!Array.isArray(categoriesWithSignals)) {
      return [];
    }
    const rank = categoryDisplayOrder.reduce((map, category, index) => {
      map[category] = index;
      return map;
    }, {});
    return [...categoriesWithSignals].sort((a, b) => {
      const orderA = rank[a.category] ?? 999;
      const orderB = rank[b.category] ?? 999;
      return orderA - orderB;
    });
  }, [categoriesWithSignals, categoryDisplayOrder]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <section className="bg-background/80">
          <div className="grid grid-cols-2 gap-3">
            {HIGHLIGHT_SYMBOLS.slice(0, 4).map((symbol) => (
              <div key={symbol.symbol}>
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-2">
                    <div className="h-3 w-16 rounded-full shimmer" />
                    <div className="h-3 w-20 rounded-full shimmer" />
                  </div>
                  <div className="h-3 w-10 rounded-full shimmer" />
                </div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div className="space-y-2">
                    <div className="h-4 w-20 rounded-full shimmer" />
                    <div className="h-3 w-16 rounded-full shimmer" />
                  </div>
                  <div className="h-12 w-24 rounded-xl shimmer" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <Card className="mt-4 border-none">
          <CardContent className="space-y-3 pt-0">
            <div className="h-16 w-full rounded-lg shimmer bg-white/20"></div>
          </CardContent>
        </Card>

        <Card className="mt-4 border-none">
          <CardContent className="space-y-3 pt-0">
            <div className="h-3 w-full rounded-full shimmer bg-white/20"></div>
            <div className="h-3 w-5/6 rounded-full shimmer bg-white/20"></div>
          </CardContent>
        </Card>

        {["idx", "us"].map((category) => (
          <section key={category} className="rounded-xl bg-background/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="h-3 w-32 rounded-full shimmer" />
                <div className="h-3 w-40 rounded-full shimmer" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 rounded-full shimmer" />
                <div className="h-6 w-20 rounded-full shimmer" />
              </div>
            </div>
            <div>
              {[...Array(5)].map((_, idx) => (
                <ShimmerItem key={`${category}-shimmer-${idx}`} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/80">
              <div className="h-3 w-24 rounded-full shimmer" />
              <div className="h-3 w-20 rounded-full shimmer" />
            </div>
          </section>
        ))}

        <section className="rounded-xl bg-background/80 p-4">
          <div className="h-4 w-48 rounded-full shimmer" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {CATEGORY_ORDER.map((category) => (
              <div key={`trigger-${category}`} className="space-y-2 text-center">
                <div className="h-8 rounded-full shimmer" />
                <div className="h-3 w-24 mx-auto rounded-full shimmer" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col md:grid md:grid-cols-12 gap-6 pb-12"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="flex md:col-span-12 items-center justify-center transition-all duration-200"
          style={{ height: `${Math.min(pullDistance, 120)}px` }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className={`h-6 w-6 text-muted-foreground ${pullDistance > 80 || isRefreshing ? "animate-spin" : ""}`} />
          </div>
        </div>
      )}

      <div className="md:col-span-12 grid grid-cols-1">

        <div className="w-full flex flex-col md:flex-col-reverse">
          <section className="w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(isHighlightsExpanded ? highlightClusters : highlightClusters.slice(0, 4)).map((item, idx) => {
                const changeValue = item.quote?.change ?? 0;
                const isPositive = changeValue >= 0;
                return (
                  <Link
                    key={item.symbol}
                    href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
                    className={`rounded-3xl p-3.5 overflow-hidden border border-border/40 hover:border-border/80 transition-all duration-200 block card-hover bg-card ${!isHighlightsExpanded && idx >= 4 ? 'hidden md:block' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TickerAvatar symbol={item.symbol} logo={item.logo ? item.logo : item.quote?.logo} />
                        <div>
                          <p className="text-sm font-bold text-foreground tracking-tight">{item.label}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${item.quote ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground bg-muted/50'}`}>
                        {item.quote ? "Live" : "Sync"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-foreground tabular-nums">
                          {item.quote ? formatPrice(item.quote.price) : "—"}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                          {item.quote && typeof item.quote.changePercent === "number"
                            ? `${isPositive ? "+" : ""}${item.quote.changePercent.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className={`flex items-center ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                        <MiniChart
                          data={item.quote?.chartData || []}
                          isPositive={isPositive}
                          width={80}
                          height={48}
                          chartId={`highlight-${item.symbol}`}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
              {/* Show all on desktop, toggle on mobile */}
              {!isHighlightsExpanded && highlightClusters.slice(4).map((item) => {
                const changeValue = item.quote?.change ?? 0;
                const isPositive = changeValue >= 0;
                return (
                  <Link
                    key={item.symbol}
                    href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
                    className="hidden md:block rounded-3xl p-3.5 overflow-hidden border border-border/40 hover:border-border/80 transition-all duration-200 block card-hover bg-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TickerAvatar symbol={item.symbol} logo={item.logo ? item.logo : item.quote?.logo} />
                        <div>
                          <p className="text-sm font-bold text-foreground tracking-tight">{item.label}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${item.quote ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-muted-foreground bg-muted/50'}`}>
                        {item.quote ? "Live" : "Sync"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-foreground tabular-nums">
                          {item.quote ? formatPrice(item.quote.price) : "—"}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                          {item.quote && typeof item.quote.changePercent === "number"
                            ? `${isPositive ? "+" : ""}${item.quote.changePercent.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className={`flex items-center ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                        <MiniChart
                          data={item.quote?.chartData || []}
                          isPositive={isPositive}
                          width={80}
                          height={48}
                          chartId={`highlight-${item.symbol}`}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {/* Expand/Collapse Button (Mobile Only) */}
            <div className="mt-4 md:hidden flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsHighlightsExpanded(!isHighlightsExpanded)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1 px-4 rounded-full border border-border/40 text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {isHighlightsExpanded ? (
                  <>Show Less <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Show More <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </Button>
            </div>
          </section>

          <div className="w-full">
            <TrendingMarquee supabase={supabase} />
          </div>
        </div>

        <div className="w-full relative overflow-x-auto overflow-y-hidden py-3 scrollbar-hide">
          <div className="flex justify-center whitespace-nowrap gap-5">
            <Link href="/idx-momentum" className="w-20">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-slate-600 to-emerald-700 shadow-md shadow-emerald-500/15">
                  <Axe className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Momentum</span>
              </div>
            </Link>
            <Link href="/idx-bubbles" className="w-20">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-slate-600 to-teal-700 shadow-md shadow-teal-500/15">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Bubbles</span>
              </div>
            </Link>
            <Link href="/idx-rotation" className="w-20">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-slate-600 to-emerald-700 shadow-md shadow-emerald-500/15">
                  <Rotate3D className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Rotation</span>
              </div>
            </Link>
            <Link href="/msci" className="w-20">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-slate-600 to-emerald-700 shadow-md shadow-emerald-500/15">
                  <Magnet className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">MSCI</span>
              </div>
            </Link>
            <Link href="/discussion" className="w-20">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 rounded-full bg-gradient-to-br from-slate-600 to-emerald-700 shadow-md shadow-emerald-500/15">
                  <MessageCircleMore className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Chat</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="md:col-span-4 flex flex-col gap-6">
        <section>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  IDX Money Flow 🇮🇩
                </p>
              </div>
              {moneyFlowUpdatedAt && (
                <p className="text-[11px] text-muted-foreground/70 ml-3.5 mt-0.5">
                  Updated {formatTimeAgo(moneyFlowUpdatedAt)}
                </p>
              )}
            </div>
          </div>

          {moneyFlowLoading && (
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 rounded-2xl shimmer" />
              ))}
            </div>
          )}

          {!moneyFlowLoading && moneyFlowError && (
            <Card className="mt-3 border border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">{moneyFlowError}</p>
              </CardContent>
            </Card>
          )}

          {!moneyFlowLoading && !moneyFlowError && moneyFlowReports.length > 0 && (
            <Accordion type="single" collapsible className="mt-3 space-y-3">
              {moneyFlowReports.map((report) => (
                <MoneyFlowCard key={`${report.symbol}-${report.report_date}`} report={report} />
              ))}
            </Accordion>
          )}

          {/* View All Money Flow (Mobile & Desktop) */}
          <div className="mt-4 flex justify-center">
            <Link
              href="/money-flow?timeframe=weekly"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1.5 px-4 rounded-full border border-border/40 w-full justify-center transition-colors hover:bg-muted/30 text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View All Money Flow <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>

      <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 content-start">
        {orderedCategories.map((section) => {
          const gatedPicks = section.picks.slice(5);
          const firstPicks = section.picks.slice(0, 5);
          const shouldGate = !isAuthenticated && gatedPicks.length > 0;
          return (
            <section key={section.category} className="py-5 fade-in">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Technical Breakout in {section.title}
                    </p>
                  </div>
                  {section.lastScreened && (
                    <p className="text-[11px] text-muted-foreground/70 ml-3.5">
                      Updated {formatTimeAgo(section.lastScreened)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums font-medium">{section.picks.length} found</span>
                  <span className="rounded-lg border border-border/60 px-2.5 py-1 uppercase tracking-wider text-[10px] font-semibold bg-muted/30">
                    {section.snapshot?.status ?? "idle"}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-0.5">
                {firstPicks.map((pick) => (
                  <PickItem key={pick.symbol} pick={pick} quote={quotes[pick.symbol]} />
                ))}
              </div>
              {gatedPicks.length > 0 && (
                <div className="mt-1 relative">
                  <div
                    className={`space-y-1 divide-y divide-border/70 border-t border-border/70 pt-1 ${shouldGate ? "pointer-events-none select-none blur-[2px] opacity-60" : ""}`}
                  >
                    {gatedPicks.map((pick) => (
                      <PickItem key={pick.symbol} pick={pick} quote={quotes[pick.symbol]} />
                    ))}
                  </div>
                  {shouldGate && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg px-6 text-center">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Sign in to explore all signals
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {typeof section.averageChange === "number" ? (
                  <span>Average move {formatPercent(section.averageChange)}</span>
                ) : null}
                {section.snapshot?.metadata?.batchProcessed != null && (
                  <span>Batch {section.snapshot.metadata.batchProcessed} symbols</span>
                )}
                {section.snapshot?.metadata?.lastBatchDurationMs != null && (
                  <span>Last run {(section.snapshot.metadata.lastBatchDurationMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            </section>
          );
        })}
        <section className="p-4 rounded-3xl bg-card border border-border/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Run a fresh screening pass for fresh breakout signals.
              </p>
            </div>
          </div>
          {showInstallButton && deferredPrompt && (
            <div className="mt-4">
              <Button
                onClick={handleInstall}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2 text-xs text-white rounded-xl shadow-lg shadow-emerald-500/20"
              >
                <Download className="h-4 w-4" />
                Install App
              </Button>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {CATEGORY_ORDER.map((category) => {
              const snapshot = snapshots[category];
              const lastScreened = snapshot?.updated_at ? new Date(snapshot.updated_at) : null;
              const screenedToday = isSameCalendarDay(lastScreened);
              const label = category.toUpperCase();
              return (
                <div key={category} className="space-y-1 text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs font-semibold border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors"
                    onClick={() => triggerBatch(category)}
                    disabled={manualLoading[category]}
                  >
                    {manualLoading[category] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      label
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {lastScreened
                      ? `Last ${screenedToday ? "today" : formatLocalDateTimeLabel(lastScreened)}`
                      : "Never screened"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>

    </div>
  );
}
