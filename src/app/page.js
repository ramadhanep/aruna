"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Loader2, Download, Edit, BarChart3 } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ManageWatchlistDialog } from "@/components/manage-watchlist-dialog";

const WATCHLIST_KEY = 'aruna_watchlist';
const DEFAULT_WATCHLIST = [
  { symbol: 'BBCA.JK', order: 1 },
  { symbol: 'BTC-USD', order: 2 },
  { symbol: 'QQQ', order: 3 },
  { symbol: 'SPY', order: 4 },
  { symbol: 'NVDA', order: 5 },
];

function loadWatchlist() {
  if (typeof window === 'undefined') return DEFAULT_WATCHLIST;
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(DEFAULT_WATCHLIST));
      return DEFAULT_WATCHLIST;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse watchlist', e);
    return DEFAULT_WATCHLIST;
  }
}

function saveWatchlist(data) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save watchlist', e);
  }
}

async function fetchQuote(symbol) {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 60 * 60 * 24 * 5; // 5 days
    const res = await fetch(`/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data || [];
    if (data.length < 2) return null;
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const price = current.adjclose;
    const change = price - previous.adjclose;
    const changePercent = (change / previous.adjclose) * 100;
    const name = json.meta?.name || symbol;
    
    return {
      symbol,
      name,
      price,
      change,
      changePercent,
      chartData: data.slice(-30).map(d => d.adjclose) // Last 30 points for mini chart
    };
  } catch (e) {
    console.warn(`Failed to fetch ${symbol}`, e);
    return null;
  }
}

function MiniChart({ data, isPositive }) {
  if (!data || data.length === 0) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 30;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StockItem({ quote }) {
  if (!quote) return null;
  
  const isPositive = quote.change >= 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  
  return (
    <Link href={`/election-cycle?symbol=${encodeURIComponent(quote.symbol)}`} className="flex items-center gap-3 py-3 hover:bg-accent/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{quote.symbol}</div>
        <div className="text-xs text-muted-foreground truncate">{quote.name}</div>
      </div>
      <div className={`flex items-center ${color}`}>
        <MiniChart data={quote.chartData} isPositive={isPositive} />
      </div>
      <div className="flex flex-col items-end">
        <div className="font-semibold text-sm">{quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
    <div className="flex items-center gap-3 py-3 px-4 animate-pulse">
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-muted rounded w-16 mb-1"></div>
        <div className="h-3 bg-muted rounded w-32"></div>
      </div>
      <div className="w-[60px] h-[30px] bg-muted rounded"></div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-4 bg-muted rounded w-20"></div>
        <div className="h-3 bg-muted rounded w-16"></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [watchlist, setWatchlist] = useState(() => loadWatchlist());
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

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
    const sorted = [...watchlist].sort((a, b) => a.order - b.order);
    const quotesData = await Promise.all(
      sorted.map(item => fetchQuote(item.symbol))
    );
    
    setQuotes(quotesData.filter(q => q !== null));
  }, [watchlist]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadQuotes();
      setLoading(false);
    };
    init();
  }, [loadQuotes]);

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
      <div className="flex flex-col">
        <div className="border rounded-lg overflow-hidden">
          <SectionHeader title="Watchlist" />
          <div className="divide-y">
            {[...Array(6)].map((_, i) => <ShimmerItem key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex flex-col gap-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="flex items-center justify-center transition-all duration-200"
          style={{ 
            height: `${pullDistance}px`,
            opacity: Math.min(pullDistance / 80, 1)
          }}
        >
          <Loader2 className={`h-6 w-6 text-muted-foreground ${pullDistance > 80 || isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      <div className="overflow-hidden">
        <SectionHeader title="Watchlist" />
        <div className="divide-y">
          {quotes.map(quote => (
            <StockItem key={quote.symbol} quote={quote} />
          ))}
        </div>
        <div className="border-t py-2">
          <button
            onClick={() => setManageDialogOpen(true)}
            className="w-full flex items-center gap-2 justify-center text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <Edit className="h-4 w-4" />
            <span className="text-sm font-medium">Add Watchlist</span>
          </button>
        </div>
      </div>

      {marketPulse && marketPulse.topGainer && marketPulse.topLoser && (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-sm">Highlights</CardTitle>
            </div>
            <CardDescription className="text-xs">How your watchlist is moving today</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 grid gap-3">
            <div className="flex items-center justify-between rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Top Gainer</p>
                <p className="text-sm font-semibold uppercase">{marketPulse.topGainer.symbol}</p>
                <p className={`text-xs font-medium ${marketPulse.topGainer.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {marketPulse.topGainer.change >= 0 ? '+' : ''}{marketPulse.topGainer.change.toFixed(2)} ({marketPulse.topGainer.changePercent.toFixed(2)}%)
                </p>
              </div>
              <div className={`flex items-center ${marketPulse.topGainer.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <MiniChart data={marketPulse.topGainer.chartData} isPositive={marketPulse.topGainer.change >= 0} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Top Loser</p>
                <p className="text-sm font-semibold uppercase">{marketPulse.topLoser.symbol}</p>
                <p className={`text-xs font-medium ${marketPulse.topLoser.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {marketPulse.topLoser.change >= 0 ? '+' : ''}{marketPulse.topLoser.change.toFixed(2)} ({marketPulse.topLoser.changePercent.toFixed(2)}%)
                </p>
              </div>
              <div className={`flex items-center ${marketPulse.topLoser.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <MiniChart data={marketPulse.topLoser.chartData} isPositive={marketPulse.topLoser.change >= 0} />
              </div>
            </div>
            <div className="rounded-lg">
              <p className="text-xs text-muted-foreground">Average Change</p>
              <p className={`text-sm font-semibold ${marketPulse.averageChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {marketPulse.averageChange >= 0 ? '+' : ''}{marketPulse.averageChange.toFixed(2)}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showInstallButton && deferredPrompt && (
        <Button 
          onClick={handleInstall}
          className="w-full bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Install App
        </Button>
      )}

      <ManageWatchlistDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        watchlist={watchlist}
        onSave={(newWatchlist) => {
          saveWatchlist(newWatchlist);
          setWatchlist(newWatchlist);
          loadQuotes();
        }}
      />
    </div>
  );
}
