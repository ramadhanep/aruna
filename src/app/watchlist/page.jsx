"use client";

import { useEffect, useState, useCallback, useRef, useMemo, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Loader2, Download, Edit, BarChart3 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ManageWatchlistDialog } from "@/components/manage-watchlist-dialog";
import { useAuth } from "@/components/auth-provider";
import { fetchEncodedJson } from "@/lib/api-client";
import { TickerAvatar } from "@/components/ticker-avatar";
import { DEFAULT_WATCHLIST, getDefaultWatchlist } from "@/lib/default-watchlist";
import { TrendingMarquee } from "@/components/trending-marquee";
import { formatTickerDisplay } from "@/lib/utils";

function areWatchlistsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].symbol !== b[i].symbol || (a[i].order ?? i) !== (b[i].order ?? i)) {
      return false;
    }
  }
  return true;
}

async function fetchBatchQuotes(symbols) {
  try {
    const { response, data } = await fetchEncodedJson('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
    });
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load quotes');
    }
    return data?.quotes || {};
  } catch (e) {
    console.warn('Failed to fetch batch quotes', e);
    return {};
  }
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

  const coordinates = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
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

function StockItem({ quote }) {
  if (!quote) return null;

  const isPositive = quote.change >= 0;
  const color = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
  const logo = quote.logo;
  const symbol = quote.symbol || '';

  return (
    <Link
      href={`/chart?symbol=${encodeURIComponent(quote.symbol)}&cycle=normal`}
      className="flex items-center gap-3 py-3.5 px-1 hover:bg-accent/40 transition-all duration-200 rounded-xl -mx-1"
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="flex-shrink-0">
          <TickerAvatar symbol={symbol} logo={logo} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{formatTickerDisplay(quote.symbol)}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{quote.name}</div>
        </div>
      </div>
      <div className={`flex items-center ${color}`}>
        <MiniChart
          data={quote.chartData}
          isPositive={isPositive}
          chartId={`watch-${quote.symbol}`}
        />
      </div>
      <div className="flex flex-col items-end">
        <div className="font-semibold text-sm tabular-nums">{quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className={`text-xs font-medium flex items-center gap-1 ${color}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
    </div>
  );
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

export default function HomePage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistReady, setWatchlistReady] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);
  const remoteDefaultSeedRef = useRef(false);
  const {
    supabase,
    user,
    loading: authLoading,
    remoteWatchlist,
    watchlistLoaded,
    syncWatchlist,
  } = useAuth();
  const isAuthenticated = Boolean(user);

  const redirectToSignIn = useCallback(() => {
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/';
    router.push(`/signin?redirect=${encodeURIComponent(currentPath)}`);
  }, [router]);

  const marketPulse = useMemo(() => {
    if (!quotes.length) {
      return null;
    }
    const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
    const topGainer = sorted[0];
    const topLoser = sorted[sorted.length - 1];
    const averageChange = sorted.reduce((sum, item) => sum + item.changePercent, 0) / sorted.length;
    return { topGainer, topLoser, averageChange };
  }, [quotes]);

  const loadQuotes = useCallback(async () => {
    if (!watchlistReady) {
      return;
    }
    if (watchlist.length === 0) {
      setQuotes([]);
      return;
    }
    const sorted = [...watchlist].sort((a, b) => a.order - b.order);
    const symbols = sorted.map(item => item.symbol);
    const quotesMap = await fetchBatchQuotes(symbols);

    // Convert map to ordered array matching watchlist order
    const quotesData = sorted
      .map(item => quotesMap[item.symbol.toUpperCase()] || null)
      .filter(q => q !== null);

    setQuotes(quotesData);
  }, [watchlist, watchlistReady]);

  useEffect(() => {
    if (!watchlistReady) {
      setLoading(true);
      setQuotes([]);
      return;
    }
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      await loadQuotes();
      if (!cancelled) {
        setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [loadQuotes, watchlistReady]);

  useEffect(() => {
    if (authLoading) {
      setWatchlistReady(false);
      return;
    }

    if (!isAuthenticated) {
      if (!areWatchlistsEqual(DEFAULT_WATCHLIST, watchlist)) {
        setWatchlist(getDefaultWatchlist());
      }
      setWatchlistReady(true);
      return;
    }

    if (!watchlistLoaded) {
      setWatchlistReady(false);
      return;
    }

    if (Array.isArray(remoteWatchlist)) {
      if (!areWatchlistsEqual(remoteWatchlist, watchlist)) {
        setWatchlist(remoteWatchlist);
      }
      setWatchlistReady(true);
      return;
    }

    if (!remoteDefaultSeedRef.current) {
      remoteDefaultSeedRef.current = true;
      const defaults = getDefaultWatchlist();
      setWatchlist(defaults);
      setWatchlistReady(true);
      syncWatchlist(defaults)
        .catch(() => null)
        .finally(() => {
          remoteDefaultSeedRef.current = false;
        });
    }
  }, [
    isAuthenticated,
    watchlistLoaded,
    remoteWatchlist,
    watchlist,
    syncWatchlist,
    authLoading,
  ]);

  // Check if app is installable
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

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadQuotes();
    } catch (e) {
      console.warn('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, loadQuotes]);

  // Pull to refresh touch handlers
  const handleTouchStart = useCallback((e) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (isRefreshing || touchStartY.current === 0 || !containerRef.current) return;
    if (containerRef.current.scrollTop > 0) {
      touchStartY.current = 0;
      setPullDistance(0);
      return;
    }

    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY.current;

    if (distance > 0) {
      setPullDistance(Math.min(distance, 150));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 80) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [pullDistance, handleRefresh]);

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

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="mt-4 border-none">
          <CardContent className="space-y-3 pt-0">
            <div className="h-16 w-full rounded-lg shimmer bg-white/20"></div>
          </CardContent>
        </Card>

        <Card className="border-none">
          <CardContent className="space-y-3 pt-0">
            <div className="h-3 w-full rounded-full shimmer bg-white/20"></div>
            <div className="h-3 w-3/4 rounded-full shimmer bg-white/20"></div>
          </CardContent>
        </Card>

        <div className="overflow-hidden">
          <SectionHeader title="Watchlist" />
          <div className="divide-y">
            {[...Array(8)].map((_, i) => <ShimmerItem key={i} />)}
          </div>
          <div className="border-t py-2 flex justify-center">
            <div className="h-8 w-44 rounded-full shimmer" />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full shimmer"></div>
              <div className="h-4 w-24 rounded-full shimmer"></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {[...Array(2)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="h-3 w-16 rounded-full shimmer"></div>
                  <div className="h-3 w-24 rounded-full shimmer"></div>
                </div>
                <div className="h-6 w-20 rounded-full shimmer"></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col lg:grid lg:grid-cols-12 lg:content-start gap-4 pb-12"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex lg:col-span-12 items-center justify-center transition-all duration-200"
          style={{
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / 80, 1)
          }}
        >
          <Loader2 className={`h-6 w-6 text-muted-foreground ${pullDistance > 80 || isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      <div className="lg:col-span-12">
        <TrendingMarquee supabase={supabase} />
      </div>

      <div className="lg:col-span-12 lg:grid lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="border-none bg-gradient-to-br from-emerald-950 via-[#0f172a] to-[#020617] border-border/20 text-white/90 shadow-xl p-4 rounded-3xl">
            <CardContent className="pt-0">
              <p className="text-xs leading-relaxed text-white/90 font-medium">
                We search through historical data looking for anomalous patterns that we would not expect to occur at random.
              </p>
            </CardContent>
          </Card>

          <div className="overflow-hidden">
            <SectionHeader title="Watchlist" />
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-1">
              {quotes.map(quote => (
                <div key={quote.symbol}>
                  <StockItem quote={quote} />
                </div>
              ))}
            </div>
            <div className="border-t border-border/20 py-2.5 mt-2">
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    redirectToSignIn();
                    return;
                  }
                  setManageDialogOpen(true);
                }}
                className="w-full flex items-center gap-2 justify-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors py-1"
              >
                <Edit className="h-4 w-4" />
                <span className="text-sm font-semibold">Edit Watchlist</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4 mt-4 lg:mt-0">
          {marketPulse && marketPulse.topGainer && marketPulse.topLoser && (
            <Card className="border-border/20 rounded-2xl">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm font-bold">Highlights</CardTitle>
                </div>
                <CardDescription className="text-xs">How your watchlist is moving today</CardDescription>
              </CardHeader>
              <CardContent className="mt-4 grid gap-3">
                <div className="flex items-center justify-between rounded-xl">
                  <div>
                    <p className="text-xs text-muted-foreground">Top Gainer</p>
                    <p className="text-sm font-semibold uppercase">{formatTickerDisplay(marketPulse.topGainer.symbol)}</p>
                    <p className={`text-xs font-medium ${marketPulse.topGainer.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {marketPulse.topGainer.change >= 0 ? '+' : ''}{marketPulse.topGainer.change.toFixed(2)} ({marketPulse.topGainer.changePercent.toFixed(2)}%)
                    </p>
                  </div>
                  <div className={`flex items-center ${marketPulse.topGainer.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    <MiniChart
                      data={marketPulse.topGainer.chartData}
                      isPositive={marketPulse.topGainer.change >= 0}
                      width={110}
                      height={46}
                      chartId={`pulse-top-${marketPulse.topGainer.symbol}`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Top Loser</p>
                    <p className="text-sm font-semibold uppercase">{formatTickerDisplay(marketPulse.topLoser.symbol)}</p>
                    <p className={`text-xs font-medium ${marketPulse.topLoser.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {marketPulse.topLoser.change >= 0 ? '+' : ''}{marketPulse.topLoser.change.toFixed(2)} ({marketPulse.topLoser.changePercent.toFixed(2)}%)
                    </p>
                  </div>
                  <div className={`flex items-center ${marketPulse.topLoser.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    <MiniChart
                      data={marketPulse.topLoser.chartData}
                      isPositive={marketPulse.topLoser.change >= 0}
                      width={110}
                      height={46}
                      chartId={`pulse-low-${marketPulse.topLoser.symbol}`}
                    />
                  </div>
                </div>
                <div className="rounded-xl mt-2">
                  <p className="text-xs text-muted-foreground">Average Change</p>
                  <p className={`text-sm font-semibold ${marketPulse.averageChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {marketPulse.averageChange >= 0 ? '+' : ''}{marketPulse.averageChange.toFixed(2)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {showInstallButton && deferredPrompt && (
            <Button
              onClick={handleInstall}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2 text-xs text-white rounded-xl shadow-lg shadow-emerald-500/20"
            >
              <Download className="h-4 w-4" />
              Install App
            </Button>
          )}
        </div>
      </div>

      <ManageWatchlistDialog
        open={manageDialogOpen && isAuthenticated}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setManageDialogOpen(false);
            return;
          }
          if (!isAuthenticated) {
            redirectToSignIn();
            return;
          }
          setManageDialogOpen(true);
        }}
        watchlist={watchlist}
        onSave={(newWatchlist) => {
          if (!isAuthenticated) {
            redirectToSignIn();
            return;
          }
          setWatchlist(newWatchlist);
          syncWatchlist(newWatchlist).catch(() => { });
        }}
      />
    </div>
  );
}
