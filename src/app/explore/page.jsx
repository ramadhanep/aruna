"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Download, Flame, Globe, Zap, ArrowUpRight, ArrowDownRight, Gem, Magnet, Rotate3D, Axe, MessageCircleMore, Droplets } from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";
import { SUPABASE_STORAGE_BASE } from "@/lib/supabase-storage";
import { MOTION, DURATION_CLASS } from "@/lib/motion";
import { TickerRowSkeleton } from "@/components/ticker-row-skeleton";
import { TickerRow } from "@/components/ticker-row";
import { TickerAvatar } from "@/components/ticker-avatar";
import { TrendingMarquee } from "@/components/trending-marquee";
import { MiniChart } from "@/components/mini-chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { cn, formatPercent, formatPrice, formatTickerDisplay, getChangeTone } from "@/lib/utils";
import { toast } from "sonner";

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

const MARKET_CATEGORIES = [
  {
    id: "us",
    title: "United States",
    emoji: "🇺🇸",
    icon: null,
    marketTz: "America/New_York",
    marketOpen: [9, 30],
    marketClose: [16, 0],
    symbols: [
      { symbol: "NVDA", label: "NVIDIA Corporation", logo: `${SUPABASE_STORAGE_BASE}/us/NVDA.svg` },
      { symbol: "AVGO", label: "Broadcom Inc.", logo: `${SUPABASE_STORAGE_BASE}/us/AVGO.svg` },
      { symbol: "MU", label: "Micron Technology", logo: `${SUPABASE_STORAGE_BASE}/us/MU.svg` },
      { symbol: "SNDK", label: "Sandisk Corporation", logo: `${SUPABASE_STORAGE_BASE}/us/SNDK.svg` },
      { symbol: "ARM", label: "Arm Holdings plc", logo: `${SUPABASE_STORAGE_BASE}/us/ARM.svg` },
      { symbol: "BE", label: "Bloom Energy Corporation", logo: `${SUPABASE_STORAGE_BASE}/us/BE.svg` },
    ],
  },
  {
    id: "indonesia",
    title: "Indonesia",
    emoji: "🇮🇩",
    icon: null,
    marketTz: "Asia/Jakarta",
    marketOpen: [9, 0],
    marketClose: [15, 15],
    symbols: [
      { symbol: "^JKSE", label: "IHSG", logo: "https://s3-symbol-logo.tradingview.com/indices/jakarta-composite-index.svg" },
      { symbol: "BBCA.JK", label: "Bank Central Asia Tbk", logo: `${SUPABASE_STORAGE_BASE}/idx/BBCA.png` },
      { symbol: "ANTM.JK", label: "PT Antam (Persero) Tbk", logo: `${SUPABASE_STORAGE_BASE}/idx/ANTM.png` },
      { symbol: "BMRI.JK", label: "Bank Mandiri (Persero) Tbk", logo: `${SUPABASE_STORAGE_BASE}/idx/BMRI.png` },
      { symbol: "BBRI.JK", label: "Bank Rakyat Indonesia (Persero) Tbk", logo: `${SUPABASE_STORAGE_BASE}/idx/BBRI.png` },
      { symbol: "BRPT.JK", label: "Barito Pacific Tbk", logo: `${SUPABASE_STORAGE_BASE}/idx/BRPT.png` },
    ],
  },
  {
    id: "global",
    title: "Global Index",
    emoji: null,
    icon: Globe,
    marketTz: "America/New_York",
    marketOpen: [9, 30],
    marketClose: [16, 0],
    symbols: [
      { symbol: "^IXIC", label: "Nasdaq", logo: "https://s3-symbol-logo.tradingview.com/nasdaq.svg" },
      { symbol: "^SPX", label: "S&P 500", logo: "https://s3-symbol-logo.tradingview.com/country/US.svg" },
      { symbol: "^DJI", label: "Dow Jones", logo: "https://s3-symbol-logo.tradingview.com/country/US.svg" },
      { symbol: "^N225", label: "Nikkei 225", logo: "https://s3-symbol-logo.tradingview.com/country/JP.svg" },
      { symbol: "^KS11", label: "KOSPI", logo: "https://s3-symbol-logo.tradingview.com/country/KR.svg" },
      { symbol: "^GDAXI", label: "DAX", logo: "https://s3-symbol-logo.tradingview.com/country/DE.svg" },
    ],
  },
  {
    id: "crypto",
    title: "Crypto",
    emoji: null,
    icon: Zap,
    marketTz: null,
    marketOpen: null,
    marketClose: null,
    symbols: [
      { symbol: "BTC-USD", label: "Bitcoin", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg" },
      { symbol: "ETH-USD", label: "Ethereum", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCETH.svg" },
      { symbol: "SOL-USD", label: "Solana", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCSOL.svg" },
      { symbol: "BNB-USD", label: "BNB", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCBNB.svg" },
      { symbol: "XRP-USD", label: "XRP", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCXRP.svg" },
      { symbol: "DOGE-USD", label: "Doge", logo: "https://s3-symbol-logo.tradingview.com/crypto/XTVCDOGE.svg" },
    ],
  },
  {
    id: "commodities",
    title: "Commodities",
    emoji: null,
    icon: Gem,
    marketTz: "America/New_York",
    marketOpen: [9, 30],
    marketClose: [16, 0],
    symbols: [
      { symbol: "CL=F", label: "WTI Oil", logo: "https://s3-symbol-logo.tradingview.com/crude-oil.svg" },
      { symbol: "BZ=F", label: "Brent", logo: "https://s3-symbol-logo.tradingview.com/crude-oil.svg" },
      { symbol: "GC=F", label: "Gold", logo: "https://s3-symbol-logo.tradingview.com/metal/gold.svg" },
      { symbol: "SI=F", label: "Silver", logo: "https://s3-symbol-logo.tradingview.com/metal/silver.svg" },
      { symbol: "NG=F", label: "Nat Gas", logo: "https://s3-symbol-logo.tradingview.com/natural-gas.svg" },
      { symbol: "HG=F", label: "Copper", logo: "https://s3-symbol-logo.tradingview.com/metal/copper.svg" },
    ],
  },
];

const MARKET_TIMEFRAMES = ["1D", "1W", "1M", "3M", "YTD", "1Y", "2Y", "5Y", "ATH"];
const MARKET_PULSE_SYMBOLS = [
  { symbol: "^JKSE", label: "IHSG" },
  { symbol: "^SPX", label: "S&P" },
  { symbol: "BTC-USD", label: "BTC" },
  { symbol: "GC=F", label: "Gold" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "USDIDR=X", label: "USD/IDR" },
];

function getMarketCategoryById(categoryId) {
  return MARKET_CATEGORIES.find((category) => category.id === categoryId) || null;
}

function getTimeframeChange(quote, timeframe) {
  if (!quote) return null;
  const price = quote.price;
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (
    timeframe !== "1D" &&
    quote.timeframe === timeframe &&
    typeof quote.timeframeChange === "number" &&
    Number.isFinite(quote.timeframeChange)
  ) {
    return quote.timeframeChange;
  }

  if (timeframe === "ATH") {
    const high = quote.meta?.fiftyTwoWeekHigh;
    if (typeof high === "number" && high > 0) {
      return ((price - high) / high) * 100;
    }
    // Fallback: compute from chartData max
    if (Array.isArray(quote.chartData) && quote.chartData.length > 0) {
      const maxPrice = Math.max(...quote.chartData);
      if (maxPrice > 0) return ((price - maxPrice) / maxPrice) * 100;
    }
    return null;
  }

  if (timeframe === "1D") return quote.changePercent ?? null;

  // For timeframes based on chartData history
  const data = quote.chartData;
  if (!Array.isArray(data) || data.length < 2) return null;

  let daysBack;
  switch (timeframe) {
    case "1W": daysBack = 5; break;
    case "1M": daysBack = 22; break;
    case "3M": daysBack = 66; break;
    case "YTD": daysBack = data.length; break;
    case "1Y": daysBack = 252; break;
    case "2Y": daysBack = 504; break;
    case "5Y": daysBack = 1260; break;
    default: daysBack = data.length;
  }

  const idx = Math.max(0, data.length - Math.min(daysBack, data.length));
  const basePrice = data[idx];
  if (typeof basePrice !== "number" || basePrice === 0) return null;
  return ((price - basePrice) / basePrice) * 100;
}

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

function MarketSymbolCardSkeleton() {
  return (
    <div className="rounded-xl p-3.5 border border-border bg-card">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-[72px] rounded-xl" />
      </div>
    </div>
  );
}

function MarketSymbolCard({ item, marketTimeframe }) {
  const q = item.quote;
  const tfChange = getTimeframeChange(q, marketTimeframe);
  const changeValue = tfChange ?? (q?.change ?? 0);
  const isPositive = changeValue >= 0;
  const isAtATH = marketTimeframe === "ATH" && tfChange !== null && Math.abs(tfChange) < 0.5;
  return (
    <Link
      href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
      className={cn(
        "rounded-xl p-3.5 border transition-all block card-hover bg-card",
        DURATION_CLASS.base,
        MOTION.fadeIn,
        isAtATH
          ? "border-amber-500/40 bg-card ring-1 ring-amber-500/20"
          : "border-border/20 hover:border-border/40"
      )}
    >
      <div className="flex items-center gap-2.5">
        <TickerAvatar symbol={item.symbol} logo={item.logo || q?.logo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground tracking-tight truncate">{item.symbol.replace('.JK', '')}</p>
            {isAtATH && <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
          </div>
          <p className="text-1xs text-muted-foreground truncate">{formatTickerDisplay(item.label)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-base font-bold text-foreground tabular-nums">
            {q ? formatPrice(q.price, { locale: "en-US", minimumFractionDigits: 2, maximumFractionDigits: 2, zeroIsEmpty: false }) : "—"}
          </p>
          <p className={`text-xs font-semibold mt-0.5 ${getChangeTone(isPositive ? 1 : -1)}`}>
            {tfChange !== null
              ? `${isPositive ? "+" : ""}${tfChange.toFixed(2)}%`
              : q && typeof q.changePercent === "number"
                ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%`
                : "—"}
            {marketTimeframe !== "1D" && tfChange !== null && (
              <span className="text-muted-foreground font-normal ml-1">({marketTimeframe})</span>
            )}
          </p>
        </div>
        <div className={`flex items-center ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
          <MiniChart
            data={q?.chartData || []}
            isPositive={isPositive}
            width={72}
            height={40}
          />
        </div>
      </div>
    </Link>
  );
}

function ToolCard({ href, icon, title, subtitle, trailing = "Open →" }) {
  const className = "group card-hover flex items-center justify-between gap-3 rounded-xl";
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-foreground">
          {icon}
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">{title}</div>
          <div className="text-1xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <span className="whitespace-nowrap text-xs font-medium text-foreground">{trailing}</span>
    </>
  );
  if (href.startsWith("#")) {
    return <a href={href} className={className}>{content}</a>;
  }
  return <Link href={href} className={className}>{content}</Link>;
}

function pickToRowProps(pick, quote) {
  const symbol = typeof pick === "string" ? pick : pick?.symbol;
  const pickData = pick && typeof pick === "object" ? pick : {};
  return {
    symbol,
    href: symbol ? `/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal&tab=tradingPlan` : "#",
    logo: quote?.logo || null,
    name: quote?.name || pickData?.name || symbol,
    price: typeof quote?.price === "number" ? quote.price : typeof pickData?.lastClose === "number" ? pickData.lastClose : null,
    change: typeof quote?.change === "number" ? quote.change : typeof pickData?.change === "number" ? pickData.change : 0,
    changePercent: typeof quote?.changePercent === "number" ? quote.changePercent : typeof pickData?.changePercent === "number" ? pickData.changePercent : 0,
    chartData: Array.isArray(quote?.chartData) && quote.chartData.length > 0 ? quote.chartData : Array.isArray(pickData?.sparkline) ? pickData.sparkline : [],
    isNew: isSameCalendarDay(pickData?.signal_date),
    isWarning: Boolean(pickData?.is_warning),
  };
}

function MarketPulseMarquee({ items }) {
  const validItems = items.filter((item) => item.quote);
  if (validItems.length === 0) {
    return (
      <div className="flex items-center gap-3">
        {MARKET_PULSE_SYMBOLS.map((item) => (
          <Skeleton key={`pulse-mq-loading-${item.symbol}`} className="h-9 w-28 rounded-xl shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="flex items-center whitespace-nowrap animate-marquee" style={{ "--marquee-duration": "18s" }}>
        {validItems.map((item) => {
          const q = item.quote;
          const isPos = (q?.change ?? 0) >= 0;
          return (
            <Link
              key={`pulse-mq-${item.symbol}`}
              href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors"
            >
              <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
              <span className="text-xs font-bold tabular-nums">{q ? formatPrice(q.price, { locale: "en-US", minimumFractionDigits: 2, maximumFractionDigits: 2, zeroIsEmpty: false }) : "—"}</span>
              {q && typeof q.changePercent === "number" ? (
                <span className={`text-1xs font-semibold flex items-center gap-0.5 ${getChangeTone(isPos ? 1 : -1)}`}>
                  {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {isPos ? "+" : ""}
                  {q.changePercent.toFixed(2)}%
                </span>
              ) : null}
            </Link>
          );
        })}
        {validItems.map((item) => {
          const q = item.quote;
          const isPos = (q?.change ?? 0) >= 0;
          return (
            <Link
              key={`pulse-mq-dup-${item.symbol}`}
              href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors"
            >
              <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
              <span className="text-xs font-bold tabular-nums">{q ? formatPrice(q.price, { locale: "en-US", minimumFractionDigits: 2, maximumFractionDigits: 2, zeroIsEmpty: false }) : "—"}</span>
              {q && typeof q.changePercent === "number" ? (
                <span className={`text-1xs font-semibold flex items-center gap-0.5 ${getChangeTone(isPos ? 1 : -1)}`}>
                  {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {isPos ? "+" : ""}
                  {q.changePercent.toFixed(2)}%
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}



export default function ExplorePage() {
  const { supabase, user } = useAuth();
  const [snapshots, setSnapshots] = useState({});
  const [quotes, setQuotes] = useState({});
  const [msciData, setMsciData] = useState(null);
  const [msciLoading, setMsciLoading] = useState(true);
  const [rotationData, setRotationData] = useState(null);
  const [rotationLoading, setRotationLoading] = useState(true);
  const [showInstallButton, setShowInstallButton] = useState(() => {
    if (typeof window === "undefined") return false;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    return !isStandalone;
  });
  const [activeMarketTab, setActiveMarketTab] = useState("us");
  const [marketTimeframe, setMarketTimeframe] = useState("1W");
  const [activeMarketQuotes, setActiveMarketQuotes] = useState({});
  const [activeMarketLoading, setActiveMarketLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualLoading, setManualLoading] = useState({ idx: false, us: false, crypto: false });
  const [categoryDisplayOrder] = useState(() => getCategoryDisplayOrder());
  const coreQuoteRequestRef = useRef(0);
  const activeMarketQuoteRequestRef = useRef(0);

  const loadCoreQuotesForSnapshots = useCallback(async (snapshotMap) => {
    const requestId = ++coreQuoteRequestRef.current;
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
    MARKET_PULSE_SYMBOLS.forEach(({ symbol }) => symbolSet.add(symbol));

    const symbolsArray = Array.from(symbolSet);
    if (symbolsArray.length === 0) {
      if (coreQuoteRequestRef.current === requestId) {
        setQuotes({});
      }
      return;
    }

    try {
      const { response, data } = await fetchEncodedJson("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: symbolsArray, timeframe: "1D" }),
      });

      if (coreQuoteRequestRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        console.warn("Failed to fetch core quotes:", data?.error);
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
      console.warn("Failed to fetch core quotes", error);
    }
  }, []);

  const loadActiveMarketQuotes = useCallback(async (categoryId, timeframe) => {
    const requestId = ++activeMarketQuoteRequestRef.current;
    const category = getMarketCategoryById(categoryId);
    if (!category) {
      if (activeMarketQuoteRequestRef.current === requestId) {
        setActiveMarketQuotes({});
      }
      return;
    }

    const symbols = category.symbols.map((item) => item.symbol);
    if (symbols.length === 0) {
      if (activeMarketQuoteRequestRef.current === requestId) {
        setActiveMarketQuotes({});
      }
      return;
    }

    setActiveMarketQuotes({});
    setActiveMarketLoading(true);
    try {
      const { response, data } = await fetchEncodedJson("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, timeframe }),
      });

      if (activeMarketQuoteRequestRef.current !== requestId) {
        return;
      }
      if (!response.ok) {
        console.warn("Failed to fetch active market quotes:", data?.error);
        return;
      }

      const batchQuotes = data?.quotes || {};
      const next = {};
      symbols.forEach((symbol) => {
        const upperSymbol = symbol.toUpperCase();
        if (batchQuotes[upperSymbol]) {
          next[symbol] = batchQuotes[upperSymbol];
        }
      });
      setActiveMarketQuotes(next);
    } catch (error) {
      console.warn("Failed to fetch active market quotes", error);
    } finally {
      if (activeMarketQuoteRequestRef.current === requestId) {
        setActiveMarketLoading(false);
      }
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
      loadCoreQuotesForSnapshots(mapped);
    } finally {
      setLoading(false);
    }
  }, [supabase, loadCoreQuotesForSnapshots]);

  const loadMsci = useCallback(async () => {
    setMsciLoading(true);
    try {
      const { response, data } = await fetchEncodedJson("/api/msci?index=standard");
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to load MSCI candidates");
      }
      setMsciData(data);
    } catch (error) {
      console.warn("Failed to load MSCI candidates", error);
      setMsciData(null);
    } finally {
      setMsciLoading(false);
    }
  }, []);

  const loadRotation = useCallback(async () => {
    setRotationLoading(true);
    try {
      const { response, data } = await fetchEncodedJson("/api/rotation");
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to load rotation data");
      }
      setRotationData(data);
    } catch (error) {
      console.warn("Failed to load rotation data", error);
      setRotationData(null);
    } finally {
      setRotationLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => loadSnapshots(), 0);
  }, [loadSnapshots]);

  useEffect(() => {
    setTimeout(() => loadActiveMarketQuotes(activeMarketTab, marketTimeframe), 0);
  }, [activeMarketTab, marketTimeframe, loadActiveMarketQuotes]);

  useEffect(() => {
    setTimeout(() => {
      loadMsci();
      loadRotation();
    }, 0);
  }, [loadMsci, loadRotation]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
      setShowInstallButton(!standalone);
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
            loadCoreQuotesForSnapshots(next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadCoreQuotesForSnapshots]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadSnapshots(),
        loadActiveMarketQuotes(activeMarketTab, marketTimeframe),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadSnapshots, loadActiveMarketQuotes, activeMarketTab, marketTimeframe]);

  const { pullDistance, handleTouchStart, handleTouchMove, handleTouchEnd } = usePullToRefresh({
    onRefresh: handleRefresh,
    isRefreshing,
  });

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
        toast.success(message);
        await loadSnapshots();
      } catch (error) {
        console.warn("Trigger failed", error);
        toast.error(error?.message || `${category.toUpperCase()} → error`);
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

  const msciPreview = useMemo(() => {
    const stocks = Array.isArray(msciData?.stocks) ? msciData.stocks : [];
    if (stocks.length === 0) return null;
    const strongest = [...stocks].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
    return {
      totalStocks: msciData?.summary?.standard?.totalStocks ?? stocks.length,
      nearestProgress: msciData?.summary?.standard?.nearestProgress ?? strongest?.progress ?? 0,
      strongest,
    };
  }, [msciData]);

  const rotationPreview = useMemo(() => {
    const stocks = Array.isArray(rotationData?.stocks) ? rotationData.stocks : [];
    if (stocks.length === 0) return null;
    const leading = stocks.filter((s) => s.quadrant === "leading");
    const lagging = stocks.filter((s) => s.quadrant === "lagging");
    const strongest = [...leading].sort((a, b) => b.monthlyChange - a.monthlyChange)[0] || null;
    const weakest = [...lagging].sort((a, b) => a.monthlyChange - b.monthlyChange)[0] || null;
    return {
      strongest,
      weakest,
      lastUpdated: rotationData?.lastUpdated || null,
    };
  }, [rotationData]);

  const topMoversPreview = useMemo(() => {
    return {
      bestGainer: breakoutInsights.bestGainer,
      bestLoser: breakoutInsights.bestLoser,
    };
  }, [breakoutInsights]);

  const marketCategoryData = useMemo(() => {
    return MARKET_CATEGORIES.map((cat) => ({
      ...cat,
      symbols: cat.symbols.map((s) => ({
        ...s,
        quote:
          cat.id === activeMarketTab
            ? activeMarketQuotes[s.symbol] ?? quotes[s.symbol]
            : null,
      })),
    }));
  }, [quotes, activeMarketQuotes, activeMarketTab]);

  const activeCategory = useMemo(() => {
    return marketCategoryData.find((c) => c.id === activeMarketTab) || marketCategoryData[0];
  }, [marketCategoryData, activeMarketTab]);

  const marketPulse = useMemo(() => {
    return MARKET_PULSE_SYMBOLS.map((item) => ({
      ...item,
      quote: quotes[item.symbol],
    }));
  }, [quotes]);

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
        <section className="w-full overflow-x-auto scrollbar-hide -mx-1 px-1">
          <div className="flex items-center gap-3 min-w-max">
            {MARKET_PULSE_SYMBOLS.map((item) => (
              <Skeleton key={`pulse-loading-${item.symbol}`} className="h-9 w-28 rounded-xl" />
            ))}
          </div>
        </section>

        <section className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 w-full">
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide w-full">
              {MARKET_CATEGORIES.map((cat) => (
                <Skeleton key={`tab-loading-${cat.id}`} className="h-8 w-24 rounded-full shrink-0" />
              ))}
            </div>
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
              {MARKET_TIMEFRAMES.map((tf) => (
                <Skeleton key={`tf-loading-${tf}`} className="h-7 w-9 rounded-lg shrink-0" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <MarketSymbolCardSkeleton key={`market-card-loading-${idx}`} />
            ))}
          </div>
        </section>

        <Skeleton className="h-10 w-full rounded-xl" />

        <section className="w-full space-y-4">
          <Skeleton className="h-4 w-24 rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-3 w-32 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-4 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-y-2 lg:block lg:columns-2 lg:gap-6">
          {["idx", "us", "crypto"].map((category) => (
            <section key={category} className="lg:[break-inside:avoid] lg:mb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44 rounded-full" />
                  <Skeleton className="h-3 w-28 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-lg" />
                </div>
              </div>
              <div className="mt-4">
                {[...Array(5)].map((_, idx) => (
                  <TickerRowSkeleton key={`${category}-shimmer-${idx}`} />
                ))}
              </div>
              <div className="mt-3">
                <Skeleton className="h-4 w-32 rounded-full" />
              </div>
            </section>
          ))}
        </div>
        <section className="p-4 rounded-xl border border-border bg-card mt-4 lg:mt-2">
          <Skeleton className="h-4 w-48 rounded-full" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1 text-center">
                <Skeleton className="h-8 w-full rounded-xl" />
                <Skeleton className="h-3 w-20 rounded-full mx-auto" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-6 pb-12", MOTION.fadeIn)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className={cn("flex items-center justify-center transition-all", DURATION_CLASS.base)}
          style={{ height: `${Math.min(pullDistance, 120)}px` }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className={`h-6 w-6 text-muted-foreground ${pullDistance > 80 || isRefreshing ? "animate-spin" : ""}`} />
          </div>
        </div>
      )}

      {/* ───── Market Pulse Ticker Strip ───── */}
      <section className="w-full overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="hidden md:flex items-center gap-3 min-w-max">
          {marketPulse.map((item) => {
            const q = item.quote;
            const isPos = (q?.change ?? 0) >= 0;
            return (
              <Link
                key={item.symbol}
                href={`/chart?symbol=${encodeURIComponent(item.symbol)}&cycle=normal`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-semibold text-muted-foreground">{item.label}</span>
                <span className="text-xs font-bold tabular-nums">{q ? formatPrice(q.price, { locale: "en-US", minimumFractionDigits: 2, maximumFractionDigits: 2, zeroIsEmpty: false }) : "—"}</span>
                {q && typeof q.changePercent === "number" ? (
                  <span className={`text-1xs font-semibold flex items-center gap-0.5 ${getChangeTone(isPos ? 1 : -1)}`}>
                    {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPos ? "+" : ""}{q.changePercent.toFixed(2)}%
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="md:hidden">
          <MarketPulseMarquee items={marketPulse} />
        </div>
      </section>

      {/* ───── Market Categories (Tabbed) ───── */}
      <section className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 w-full">
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide w-full">
            <SegmentedControl
              value={activeMarketTab}
              onValueChange={setActiveMarketTab}
              variant="ghost"
              className="rounded-full text-xs font-semibold px-4 py-2 h-auto"
              activeClassName="bg-primary text-primary-foreground hover:bg-primary dark:hover:bg-primary"
              inactiveClassName="bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              options={MARKET_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                return {
                  value: cat.id,
                  label: (
                    <>
                      {cat.emoji ? <span>{cat.emoji}</span> : CatIcon ? <CatIcon className="h-3.5 w-3.5" /> : null}
                      {cat.title}
                    </>
                  ),
                };
              })}
            />
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
            <SegmentedControl
              value={marketTimeframe}
              onValueChange={setMarketTimeframe}
              variant="ghost"
              className="px-2.5 py-1 rounded-lg text-xs font-semibold h-auto"
              activeClassName="bg-foreground text-background hover:bg-foreground dark:hover:bg-foreground"
              inactiveClassName="text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              options={MARKET_TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
            />
            {activeMarketLoading && (
              <span className="ml-1 inline-flex items-center text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {activeMarketLoading
            ? activeCategory.symbols.map((item) => (
              <MarketSymbolCardSkeleton key={`loading-${item.symbol}`} />
            ))
            : activeCategory.symbols.map((item) => (
              <MarketSymbolCard key={item.symbol} item={item} marketTimeframe={marketTimeframe} />
            ))}
        </div>
      </section>

      {/* ───── Trending Marquee ───── */}
      <div className="w-full">
        <TrendingMarquee supabase={supabase} />
      </div>

      {/* ───── Explore Tools Hub ───── */}
      <section className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Explore Tools</h2>
        </div>

        {/* Compact widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ToolCard
            href="/msci"
            icon={<Magnet className="h-4 w-4" />}
            title="MSCI Tracker"
            subtitle={
              msciLoading ? (
                <Skeleton className="mt-1 h-3 w-28 rounded-full" />
              ) : msciPreview ? (
                <span>
                  {msciPreview.totalStocks} candidates
                  {" · "}Top: <span className="text-emerald-500 font-medium">{formatTickerDisplay(msciPreview.strongest?.ticker) || "—"}</span>
                </span>
              ) : (
                "MSCI free-float thresholds"
              )
            }
          />

          <ToolCard
            href="/idx-rotation"
            icon={<Rotate3D className="h-4 w-4" />}
            title="IDX Rotation"
            subtitle={
              rotationLoading ? (
                <Skeleton className="mt-1 h-3 w-28 rounded-full" />
              ) : rotationPreview ? (
                <span>
                  Lead: <span className="text-emerald-500 font-medium">{formatTickerDisplay(rotationPreview.strongest?.code) || "—"}</span>
                  {" · "}Lag: <span className="text-red-500 font-medium">{formatTickerDisplay(rotationPreview.weakest?.code) || "—"}</span>
                </span>
              ) : (
                "Sector momentum rotation"
              )
            }
          />

          <ToolCard
            href="/idx-momentum"
            icon={<Axe className="h-4 w-4" />}
            title="Momentum"
            subtitle="IDX momentum scanner"
          />

          <ToolCard
            href="/discussion"
            icon={<MessageCircleMore className="h-4 w-4" />}
            title="Chat"
            subtitle="Community discussion"
          />

          <ToolCard
            href="#breakout-signals"
            icon={<Zap className="h-4 w-4" />}
            title="Technical Breakout"
            subtitle={
              <span>
                {breakoutInsights.totalBreakouts} signals
                {breakoutInsights.bestGainer ? (
                  <>
                    {" · "}Top: <span className="text-emerald-500 font-medium">{formatTickerDisplay(breakoutInsights.bestGainer.symbol)}</span>
                  </>
                ) : null}
              </span>
            }
            trailing="View →"
          />

          <ToolCard
            href="/idx-bubbles"
            icon={<Droplets className="h-4 w-4" />}
            title="Top Movers"
            subtitle={
              <span>
                {topMoversPreview.bestGainer ? (
                  <>
                    Gainer: <span className="text-emerald-500 font-medium">{formatTickerDisplay(topMoversPreview.bestGainer.symbol)}</span>
                  </>
                ) : (
                  "Market bubble view"
                )}
                {topMoversPreview.bestLoser ? (
                  <>
                    {" · "}Loser: <span className="text-red-500 font-medium">{formatTickerDisplay(topMoversPreview.bestLoser.symbol)}</span>
                  </>
                ) : null}
              </span>
            }
          />
        </div>
      </section>

      {/* ───── Main Content Grid ───── */}
      <div className="grid grid-cols-1 gap-6">

        {/* ───── Breakout Signals ───── */}
        <div id="breakout-signals" className="scroll-mt-20">
          <div className="grid grid-cols-1 gap-y-2 lg:block lg:columns-2 lg:gap-6">
            {orderedCategories.map((section) => {
              const gatedPicks = section.picks.slice(5);
              const firstPicks = section.picks.slice(0, 5);
              const shouldGate = !isAuthenticated && gatedPicks.length > 0;
              return (
                <section key={section.category} className="py-5 fade-in lg:[break-inside:avoid] lg:mb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-1xs uppercase tracking-wider font-semibold text-muted-foreground">
                          Technical Breakout in {section.title}
                        </p>
                      </div>
                      {section.lastScreened && (
                        <p className="text-1xs text-muted-foreground/70">
                          Updated {formatTimeAgo(section.lastScreened)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-1xs text-muted-foreground">
                      <span className="tabular-nums font-medium">{section.picks.length} found</span>
                      <Badge className="rounded-lg px-2.5 py-1 uppercase tracking-wider">
                        {section.snapshot?.status ?? "idle"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 space-y-0.5">
                    {firstPicks.map((pick) => (
                      <TickerRow key={pick.symbol} {...pickToRowProps(pick, quotes[pick.symbol])} />
                    ))}
                  </div>
                  {gatedPicks.length > 0 && (
                    <div className="mt-1 relative">
                      <div
                        className={`space-y-1 divide-y divide-border/20 border-t border-border/20 pt-1 ${shouldGate ? "pointer-events-none select-none opacity-40" : ""}`}
                      >
                        {gatedPicks.map((pick) => (
                          <TickerRow key={pick.symbol} {...pickToRowProps(pick, quotes[pick.symbol])} />
                        ))}
                      </div>
                      {shouldGate && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg px-6 text-center">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <p className="text-1xs font-semibold text-muted-foreground">
                            Sign in to explore all signals
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-1xs text-muted-foreground">
                    {typeof section.averageChange === "number" ? (
                      <span>Average move {formatPercent(section.averageChange, { fractionDigits: 2, showPositiveSign: true })}</span>
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
          </div>

          {/* ───── Screener Triggers ───── */}
          <section className="p-4 rounded-xl bg-card border border-border/20 mt-4 lg:mt-2">
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
                  className="w-full bg-foreground hover:bg-foreground/90 flex items-center gap-2 text-xs text-background rounded-md"
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
                      className="w-full rounded-xl text-xs font-semibold border-border/30 bg-muted/30 hover:bg-muted/60 transition-colors"
                      onClick={() => triggerBatch(category)}
                      disabled={manualLoading[category]}
                    >
                      {manualLoading[category] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        label
                      )}
                    </Button>
                    <p className="text-2xs text-muted-foreground">
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

    </div>
  );
}
