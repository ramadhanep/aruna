"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, Edit, BarChart3 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ManageWatchlistDialog } from "@/components/manage-watchlist-dialog";
import { useAuth } from "@/components/auth-provider";
import { fetchEncodedJson } from "@/lib/api-client";
import { MiniChart } from "@/components/mini-chart";
import { TickerRowSkeleton } from "@/components/ticker-row-skeleton";
import { TickerRow } from "@/components/ticker-row";
import { getDefaultWatchlist, readStoredWatchlist, writeStoredWatchlist } from "@/lib/default-watchlist";
import { TrendingMarquee } from "@/components/trending-marquee";
import { formatTickerDisplay } from "@/lib/utils";
import { MOTION, DURATION_CLASS } from "@/lib/motion";
import { SectionHeader } from "@/components/section-header";

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

export default function HomePage() {
  const router = useRouter();
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistReady, setWatchlistReady] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showInstallButton, setShowInstallButton] = useState(() => {
    if (typeof window === "undefined") return false;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    return !isStandalone;
  });
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
  const canUseProtectedActions = isAuthenticated;

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
      queueMicrotask(() => setQuotes([]));
      return;
    }
    let cancelled = false;
    const init = async () => {
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
    if (authLoading) return;

    queueMicrotask(() => {
      if (!isAuthenticated) {
        const stored = readStoredWatchlist();
        const seed = stored !== null ? stored : getDefaultWatchlist();
        if (!areWatchlistsEqual(seed, watchlist)) {
          setWatchlist(seed);
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
    });
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
      <div className="skeleton-stagger flex flex-col lg:grid lg:grid-cols-12 lg:content-start gap-4 pb-12">
        <div className="lg:col-span-12">
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <div className="lg:col-span-12 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full rounded-full" />
              </CardContent>
            </Card>

            <div className="overflow-hidden">
              <SectionHeader title="Watchlist" />
              <div className="skeleton-stagger lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-1">
                {[...Array(8)].map((_, i) => <TickerRowSkeleton key={i} />)}
              </div>
              <div className="border-t border-border/20 py-2.5 mt-2 flex justify-center">
                <Skeleton className="h-8 w-44 rounded-full" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-4 mt-4 lg:mt-0">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3 w-40 rounded-full" />
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {[...Array(2)].map((_, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16 rounded-full" />
                      <Skeleton className="h-3 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-12 w-24 rounded-lg" />
                  </div>
                ))}
                <Skeleton className="h-4 w-24 rounded-full" />
              </CardContent>
            </Card>
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col lg:grid lg:grid-cols-12 lg:content-start gap-4 pb-12 ${MOTION.fadeIn}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div
          className={`flex lg:col-span-12 items-center justify-center transition-all ${DURATION_CLASS.base}`}
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
          <Card>
            <CardContent className="p-4">
              <p className="text-xs leading-relaxed text-foreground/90 font-medium">
                We search through historical data looking for anomalous patterns that we would not expect to occur at random.
              </p>
            </CardContent>
          </Card>

          <div className="overflow-hidden">
            <SectionHeader title="Watchlist" />
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-1">
              {quotes.map(quote => (
                <div key={quote.symbol}>
                  <TickerRow
                    symbol={quote?.symbol}
                    href={quote ? `/chart?symbol=${encodeURIComponent(quote.symbol)}&cycle=normal` : "#"}
                    logo={quote?.logo}
                    name={quote?.name}
                    price={quote?.price}
                    change={quote?.change}
                    changePercent={quote?.changePercent}
                    chartData={quote?.chartData}
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-border/20 py-2.5 mt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!watchlistReady}
                onClick={() => {
                  if (!canUseProtectedActions) {
                    redirectToSignIn();
                    return;
                  }
                  if (!watchlistReady) {
                    return;
                  }
                  setManageDialogOpen(true);
                }}
                className="w-full flex items-center gap-2 justify-center py-1 h-auto"
              >
                <Edit className="h-4 w-4" />
                <span className="text-sm font-semibold">Edit Watchlist</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4 mt-4 lg:mt-0">
          {marketPulse && marketPulse.topGainer && marketPulse.topLoser && (
            <Card>
              <CardHeader>
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
              className="w-full bg-foreground hover:bg-foreground/90 flex items-center gap-2 text-xs text-background rounded-md"
            >
              <Download className="h-4 w-4" />
              Install App
            </Button>
          )}
        </div>
      </div>

      <ManageWatchlistDialog
        open={manageDialogOpen && canUseProtectedActions && watchlistReady}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setManageDialogOpen(false);
            return;
          }
          if (!canUseProtectedActions) {
            redirectToSignIn();
            return;
          }
          setManageDialogOpen(true);
        }}
        watchlist={watchlist}
        onSave={(newWatchlist) => {
          if (!canUseProtectedActions) {
            redirectToSignIn();
            return;
          }
          setWatchlist(newWatchlist);
          if (!isAuthenticated) {
            writeStoredWatchlist(newWatchlist);
          }
          syncWatchlist(newWatchlist).catch(() => { });
        }}
      />
    </div>
  );
}
