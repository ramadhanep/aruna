"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MoreVertical, Pencil, Trash2, Loader2, Wallet, Coins, TrendingUp, DollarSign, ArrowUpDown, Check, Eye, EyeOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth-provider';
import { fetchEncodedJson } from '@/lib/api-client';
import { TickerAvatar } from '@/components/ticker-avatar';

// Dynamic chart component to keep page light and avoid SSR issues
const PortfolioPie = dynamic(() => import('./pie').then(m => m.PortfolioPie), { ssr: false });

// LocalStorage key for currency preference
const PORTFOLIO_CURRENCY_KEY = 'portfolio_currency';
const PORTFOLIO_VISIBILITY_KEY = 'portfolio_visibility_hidden';
const DEFAULT_PORTFOLIO_ENTRIES = [
  { symbol: 'BTC-USD', name: 'Bitcoin', amount: 1, unit: 'share', avgPrice: 65000, type: 'digital' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', amount: 100, unit: 'share', avgPrice: 120, type: 'digital' },
  { symbol: 'BBCA.JK', name: 'Bank Central Asia Tbk', amount: 1000, unit: 'lot', avgPrice: 7500, type: 'digital' },
];

function getDefaultPortfolio() {
  return DEFAULT_PORTFOLIO_ENTRIES.map((entry) => ({ ...entry }));
}

// Minimal asset search (reuses existing API route if present)
async function searchSymbols(query) {
  if (!query) return [];
  try {
    const { response, data } = await fetchEncodedJson(
      `/api/symbol-search?q=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error(data?.error || 'Search failed');
    }
    return data.symbols || [];
  } catch (e) {
    console.warn('Symbol search failed', e);
    return [];
  }
}

function loadCurrencyPreference() {
  if (typeof window === 'undefined') return 'IDR';
  try {
    const raw = localStorage.getItem(PORTFOLIO_CURRENCY_KEY);
    if (raw === 'USD' || raw === 'IDR') {
      return raw;
    }
    return 'IDR';
  } catch (e) {
    return 'IDR';
  }
}

function saveCurrencyPreference(currency) {
  try {
    localStorage.setItem(PORTFOLIO_CURRENCY_KEY, currency);
  } catch (e) {
    console.warn('Failed to save currency preference', e);
  }
}

function loadPortfolioVisibility() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PORTFOLIO_VISIBILITY_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

function savePortfolioVisibility(hidden) {
  try {
    localStorage.setItem(PORTFOLIO_VISIBILITY_KEY, hidden ? 'true' : 'false');
  } catch (e) {
    console.warn('Failed to persist portfolio visibility', e);
  }
}

export default function PortfolioTrackerPage() {
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [holdingsSort, setHoldingsSort] = useState('alpha');
  const [currency, setCurrency] = useState(() => loadCurrencyPreference());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState([]);
  const [assetType, setAssetType] = useState('digital'); // 'digital' or 'cash'
  const [form, setForm] = useState({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '', type: 'digital', category: '', cashCurrency: 'IDR' });
  const [priceMap, setPriceMap] = useState({}); // { symbol: currentPrice }
  const [logoMap, setLogoMap] = useState({}); // { symbol: logoUrl }
  const [initialLoading, setInitialLoading] = useState(true);
  const [fxRate, setFxRate] = useState(0); // USD per IDR (e.g., 1/16500 = 0.0000606)
  const [idrPerUsd, setIdrPerUsd] = useState(0); // IDR per USD (e.g., 16500)
  const justSelectedRef = React.useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPortfolioHidden, setIsPortfolioHidden] = useState(() => loadPortfolioVisibility());
  const touchStartY = React.useRef(0);
  const containerRef = React.useRef(null);
  const remotePortfolioSeedRef = React.useRef(false);
  const hydratePortfolioRef = React.useRef(false);
  const {
    user,
    loading: authLoading,
    remotePortfolio,
    portfolioLoaded,
    syncPortfolio,
  } = useAuth();
  const isAuthenticated = Boolean(user);
  const redirectToSignIn = useCallback(() => {
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '/portfolio-tracker';
    router.push(`/signin?redirect=${encodeURIComponent(currentPath)}`);
  }, [router]);
  const ensureAuthenticated = useCallback(() => {
    if (isAuthenticated) {
      return true;
    }
    redirectToSignIn();
    return false;
  }, [isAuthenticated, redirectToSignIn]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      redirectToSignIn();
    }
  }, [authLoading, isAuthenticated, redirectToSignIn]);
  
  // Fetch latest prices (simple batch sequential)
  const fetchPrice = useCallback(async (symbol) => {
    try {
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - 60 * 60 * 24 * 5; // last ~5 days window
      const { response, data } = await fetchEncodedJson(
        `/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) return null;
      const series = data.data || [];
      if (series.length === 0) return null;
      const last = series[series.length - 1];
      const logo = data?.meta?.logo || null;
      return {
        price: last.adjclose ?? null,
        logo,
      };
    } catch (e) {
      return null;
    }
  }, []);

  const refreshPrices = useCallback(async (list) => {
    const uniqueSymbols = [...new Set(list.map(e => e.symbol))];
    const updates = {};
    const logos = {};
    for (const sym of uniqueSymbols) {
      const result = await fetchPrice(sym);
      if (!result) continue;
      if (result.price != null) {
        updates[sym] = result.price;
      }
      if (result.logo) {
        logos[sym] = result.logo;
      }
    }
    if (Object.keys(updates).length) {
      setPriceMap(pm => ({ ...pm, ...updates }));
    }
    if (Object.keys(logos).length) {
      setLogoMap((prev) => ({ ...prev, ...logos }));
    }
  }, [fetchPrice]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    const digitalEntries = entries.filter(e => e.type !== 'cash');
    if (digitalEntries.length === 0) return; // Only refresh if there are digital assets
    
    setIsRefreshing(true);
    try {
      // Fetch FX rate
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - 60 * 60 * 24 * 5;
      const { response, data } = await fetchEncodedJson(
        `/api/finance?symbol=IDR=X&startDate=${startDate}&endDate=${endDate}`
      );
      if (response.ok) {
        const series = data.data || [];
        if (series.length > 0) {
          const last = series[series.length - 1];
          const idrPerUsdVal = last.adjclose;
          if (idrPerUsdVal) {
            setIdrPerUsd(idrPerUsdVal);
            setFxRate(1 / idrPerUsdVal);
          }
        }
      }
      // Refresh prices only for digital assets
      await refreshPrices(digitalEntries);
    } catch (e) {
      console.warn('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, entries, refreshPrices]);

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

  // Initial load handled by lazy initializer above

  // Fetch FX rate IDR=X (IDR per 1 USD) once on mount
  useEffect(() => {
    (async () => {
      try {
        // Fetch IDR=X from Yahoo Finance to get USD per IDR
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - 60 * 60 * 24 * 5;
        const { response, data } = await fetchEncodedJson(
          `/api/finance?symbol=IDR=X&startDate=${startDate}&endDate=${endDate}`
        );
        if (response.ok) {
          const series = data.data || [];
          if (series.length > 0) {
            const last = series[series.length - 1];
            const idrPerUsdVal = last.adjclose;
            if (idrPerUsdVal) {
              setIdrPerUsd(idrPerUsdVal);
              setFxRate(1 / idrPerUsdVal);
            }
          }
        }
      } catch (e) {
        console.warn('FX rate fetch failed', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      hydratePortfolioRef.current = true;
      setEntries([]);
      setInitialLoading(false);
      return;
    }

    if (!portfolioLoaded) {
      return;
    }

    if (Array.isArray(remotePortfolio)) {
      hydratePortfolioRef.current = true;
      setEntries(remotePortfolio);
      return;
    }

    if (!remotePortfolioSeedRef.current) {
      remotePortfolioSeedRef.current = true;
      const defaults = getDefaultPortfolio();
      hydratePortfolioRef.current = true;
      setEntries(defaults);
      syncPortfolio(defaults)
        .catch(() => null)
        .finally(() => {
          remotePortfolioSeedRef.current = false;
        });
    }
  }, [isAuthenticated, portfolioLoaded, remotePortfolio, syncPortfolio]);

  // Persist changes and refresh prices when entries mutate
  useEffect(() => {
    if (hydratePortfolioRef.current) {
      hydratePortfolioRef.current = false;
    } else if (isAuthenticated) {
      syncPortfolio(entries).catch(() => {});
    }

    const digitalEntries = entries.filter((e) => e.type !== 'cash');
    let cancelled = false;

    (async () => {
      try {
        if (digitalEntries.length > 0) {
          await refreshPrices(digitalEntries);
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, isAuthenticated, refreshPrices, syncPortfolio]);

  // Persist currency preference
  useEffect(() => {
    saveCurrencyPreference(currency);
  }, [currency]);

  useEffect(() => {
    savePortfolioVisibility(isPortfolioHidden);
  }, [isPortfolioHidden]);

  // Search debounce
  useEffect(() => {
    const handle = setTimeout(async () => {
      // Skip search if we just selected a symbol
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      if (!symbolQuery) { setSymbolResults([]); return; }
      setLoadingSearch(true);
      const res = await searchSymbols(symbolQuery);
      setSymbolResults(res);
      setLoadingSearch(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [symbolQuery]);

  function resetForm() {
    setForm({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '', type: 'digital', category: '', cashCurrency: 'IDR' });
    setSymbolQuery('');
    setSymbolResults([]);
    setEditingIndex(null);
    setAssetType('digital');
  }

  // User selected a symbol from search results: set symbol, name, unit (lot for .JK),
  // and try to autofill avgPrice with latest market price
  async function handleSelectSymbol(result) {
    const symbol = result.symbol;
    const name = result.name || '';
    const isJk = symbol.endsWith('.JK');
    let latestResult = null;
    try {
      latestResult = await fetchPrice(symbol);
      if (latestResult?.price != null) {
        setPriceMap((pm) => ({ ...pm, [symbol]: latestResult.price }));
      }
      if (latestResult?.logo) {
        setLogoMap((prev) => ({ ...prev, [symbol]: latestResult.logo }));
      }
    } catch (e) {
      // ignore
    }
    setForm((f) => ({
      ...f,
      symbol,
      name,
      unit: isJk ? 'lot' : f.unit,
      avgPrice: latestResult?.price != null ? String(latestResult.price) : f.avgPrice,
    }));
    // Set flag to prevent search trigger, then update query and clear results
    justSelectedRef.current = true;
    setSymbolQuery(symbol);
    setSymbolResults([]);
  }

  function openAdd() {
    if (!ensureAuthenticated()) return;
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(idx) {
    if (!ensureAuthenticated()) return;
    const e = entries[idx];
    const isCash = e.type === 'cash';
    let cashAmountDisplay = '';
    if (isCash) {
      if (typeof e.nativeAmount === 'number') {
        cashAmountDisplay = String(e.nativeAmount);
      } else {
        const usdValue = e.avgPrice * e.amount;
        if (e.cashCurrency === 'IDR' && fxRate > 0) {
          cashAmountDisplay = String(usdValue / fxRate);
        } else {
          cashAmountDisplay = String(usdValue);
        }
      }
    }
    setForm({
      symbol: e.symbol || '',
      name: e.name || '',
      amount: String(isCash ? cashAmountDisplay : e.amount),
      unit: e.unit || 'share',
      avgPrice: isCash ? '' : String(e.avgPrice),
      type: e.type || 'digital',
      category: e.category || '',
      cashCurrency: e.cashCurrency || 'IDR'
    });
    setSymbolQuery(e.symbol || '');
    setAssetType(e.type || 'digital');
    setEditingIndex(idx);
    setDialogOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!ensureAuthenticated()) return;
    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum)) return;

    const targetIndex = editingIndex;

    if (assetType === 'cash') {
      // Cash asset
      if (!form.category.trim()) {
        alert('Please enter a category for cash asset (e.g., Bank BCA)');
        return;
      }

      const nativeAmount = amountNum;
      if (nativeAmount <= 0 || isNaN(nativeAmount)) {
        alert('Please enter the cash amount');
        return;
      }

      // Convert to USD for storage
      let totalUSD = nativeAmount;
      if (form.cashCurrency === 'IDR') {
        if (fxRate <= 0) {
          alert('FX rate unavailable. Please refresh to update rates.');
          return;
        }
        totalUSD = nativeAmount * fxRate; // IDR * (USD per IDR) = USD
      }

      const entry = {
        symbol: `CASH_${form.cashCurrency}`,
        name: form.category,
        amount: 1,
        unit: 'unit',
        avgPrice: totalUSD,
        type: 'cash',
        category: form.category,
        cashCurrency: form.cashCurrency,
        nativeAmount,
      };
      setEntries((prev) => {
        const next = [...prev];
        if (targetIndex != null && targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = entry;
        } else {
          next.push(entry);
        }
        return next;
      });
      setDialogOpen(false);
      resetForm();
    } else {
      // Digital asset
      if (!form.symbol) {
        alert('Please select a symbol');
        return;
      }

      // Ensure avgPrice is set; if not, attempt to fetch latest price
      let avgPriceNum = parseFloat(form.avgPrice);
      if (isNaN(avgPriceNum) || avgPriceNum <= 0) {
        avgPriceNum = null;
        try {
          const result = await fetchPrice(form.symbol);
          if (result?.price != null) {
            avgPriceNum = result.price;
            setPriceMap((pm) => ({
              ...pm,
              [form.symbol]: result.price,
            }));
            if (result.logo) {
              setLogoMap((prev) => ({
                ...prev,
                [form.symbol]: result.logo,
              }));
            }
          }
        } catch (err) {
          // ignore
        }
      }
      if (avgPriceNum == null || isNaN(avgPriceNum)) {
        alert('Could not determine average price for this symbol. Please enter it manually.');
        return;
      }

      const unit = form.unit;
      const entry = { symbol: form.symbol, name: form.name, amount: amountNum, unit, avgPrice: avgPriceNum, type: 'digital' };
      setEntries((prev) => {
        const next = [...prev];
        if (targetIndex != null && targetIndex >= 0 && targetIndex < next.length) {
          next[targetIndex] = entry;
        } else {
          next.push(entry);
        }
        return next;
      });
      setDialogOpen(false);
      resetForm();
    }
  }

  const navigateToSymbol = useCallback(
    (nextSymbol) => {
      if (!nextSymbol) return;
      router.push(`/chart?symbol=${encodeURIComponent(nextSymbol)}&cycle=normal`);
    },
    [router]
  );

  function removeEntry(idx) {
    if (!ensureAuthenticated()) return;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  // Effective unit (.JK defaults to lot)
  const effectiveUnit = useMemo(() => {
    if (form.symbol.endsWith('.JK')) return 'lot';
    return form.unit;
  }, [form.symbol, form.unit]);
  const unitLocked = form.symbol.endsWith('.JK');

  // Fetch latest prices (simple batch sequential)
  // (Removed duplicated non-hoisted implementations)

  // Compute portfolio metrics
  const isIDR = useCallback((symbol) => symbol.endsWith('.JK'), []);
  const isLot = useCallback((unit) => unit === 'lot', []);

  // Convert a value expressed in its native currency to USD
  const toUSD = useCallback((symbol, pricePerUnit) => {
    if (pricePerUnit == null) return 0;
    if (!isIDR(symbol)) return pricePerUnit; // already USD
    if (fxRate <= 0) return pricePerUnit; // fallback treat as USD if rate missing
    return pricePerUnit * fxRate; // IDR price * (USD per IDR) = USD
  }, [fxRate, isIDR]);

  // Get effective amount: if unit is 'lot', convert to shares by multiplying by 100
  // (effective shares = amount * 100)
  const getEffectiveAmount = useCallback((amount, unit) => {
    return isLot(unit) ? amount * 100 : amount;
  }, [isLot]);

  // Separate digital and cash assets
  const digitalAssets = entries.filter(e => e.type !== 'cash');
  const cashAssets = entries.filter(e => e.type === 'cash');

  const holdingsWithMetrics = useMemo(() => {
    return entries.map((entry, index) => {
      const isCash = entry.type === 'cash';
      const effectiveAmount = isCash ? 1 : getEffectiveAmount(entry.amount, entry.unit);
      const baseValueUSD = isCash
        ? entry.avgPrice * entry.amount
        : toUSD(entry.symbol, entry.avgPrice) * effectiveAmount;
      const livePrice = priceMap[entry.symbol];
      const currentValueUSD = isCash
        ? baseValueUSD
        : (livePrice != null
            ? toUSD(entry.symbol, livePrice) * effectiveAmount
            : baseValueUSD);
      const pnl = currentValueUSD - baseValueUSD;
      const cashDisplayAmount = isCash
        ? (typeof entry.nativeAmount === 'number'
            ? entry.nativeAmount
            : (entry.cashCurrency === 'IDR' && fxRate > 0
                ? baseValueUSD / fxRate
                : baseValueUSD))
        : null;

      return {
        entry,
        index,
        isCash,
        effectiveAmount,
        baseValueUSD,
        currentValueUSD,
        pnl,
        cashDisplayAmount,
      };
    });
  }, [entries, priceMap, fxRate, getEffectiveAmount, toUSD]);

  const sortedHoldings = useMemo(() => {
    const digital = holdingsWithMetrics.filter((item) => !item.isCash);
    const cash = holdingsWithMetrics.filter((item) => item.isCash);

    const compareAlphaDigital = (a, b) =>
      (a.entry.symbol || '').localeCompare(b.entry.symbol || '');
    const compareAlphaCash = (a, b) =>
      (a.entry.category || a.entry.symbol || '').localeCompare(
        b.entry.category || b.entry.symbol || ''
      );

    const sortWithFallback = (arr, comparator, fallback) => {
      arr.sort((a, b) => {
        const result = comparator(a, b);
        if (result !== 0) return result;
        return fallback(a, b);
      });
    };

    if (holdingsSort === 'market') {
      sortWithFallback(
        digital,
        (a, b) => b.currentValueUSD - a.currentValueUSD,
        compareAlphaDigital
      );
      sortWithFallback(
        cash,
        (a, b) => b.currentValueUSD - a.currentValueUSD,
        compareAlphaCash
      );
    } else if (holdingsSort === 'pnl') {
      sortWithFallback(
        digital,
        (a, b) => (b.pnl ?? 0) - (a.pnl ?? 0),
        compareAlphaDigital
      );
      sortWithFallback(
        cash,
        (a, b) => (b.pnl ?? 0) - (a.pnl ?? 0),
        compareAlphaCash
      );
    } else {
      sortWithFallback(digital, compareAlphaDigital, compareAlphaDigital);
      sortWithFallback(cash, compareAlphaCash, compareAlphaCash);
    }

    return [...digital, ...cash];
  }, [holdingsWithMetrics, holdingsSort]);

  // Calculate digital assets metrics (in USD)
  const digitalCost = digitalAssets.reduce((sum, e) => {
    const effectiveAmount = getEffectiveAmount(e.amount, e.unit);
    return sum + toUSD(e.symbol, e.avgPrice) * effectiveAmount;
  }, 0);
  
  const digitalMarket = digitalAssets.reduce((sum, e) => {
    const live = priceMap[e.symbol];
    const costOrLive = live != null ? live : e.avgPrice;
    const effectiveAmount = getEffectiveAmount(e.amount, e.unit);
    return sum + toUSD(e.symbol, costOrLive) * effectiveAmount;
  }, 0);
  
  const digitalPnL = digitalMarket - digitalCost;

  // Calculate total cash (already in USD)
  const totalCash = cashAssets.reduce((sum, e) => {
    return sum + e.avgPrice * e.amount;
  }, 0);

  // Total Net Worth
  const totalNetWorth = digitalMarket + totalCash;
  const totalPnL = digitalPnL;

  function formatUSD(v) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  function formatIDR(v) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  }
  
  // Convert USD amount to IDR for display
  function usdToIdr(usdAmount) {
    if (idrPerUsd <= 0) return 0;
    return usdAmount * idrPerUsd;
  }

  // Format value based on selected currency
  function formatValue(usdAmount) {
    if (currency === 'IDR') {
      const idrAmount = usdToIdr(usdAmount);
      return { primary: formatIDR(idrAmount), secondary: formatUSD(usdAmount) };
    } else {
      const idrAmount = usdToIdr(usdAmount);
      return { primary: formatUSD(usdAmount), secondary: formatIDR(idrAmount) };
    }
  }

  const maskToken = currency === 'IDR' ? '*********' : '******';
  const getDisplayValue = (usdAmount) => (isPortfolioHidden ? { primary: maskToken, secondary: maskToken } : formatValue(usdAmount));
  const getPnLColor = (value) => (isPortfolioHidden ? 'text-muted-foreground' : value >= 0 ? 'text-emerald-600' : 'text-red-600');
  const totalNetWorthDisplay = getDisplayValue(totalNetWorth);
  const totalPnLDisplay = getDisplayValue(totalPnL);
  const digitalMarketDisplay = getDisplayValue(digitalMarket);
  const digitalPnLDisplay = getDisplayValue(digitalPnL);
  const totalCashDisplay = getDisplayValue(totalCash);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (initialLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-24 rounded-full shimmer"></div>
            <div className="h-8 w-24 rounded-2xl shimmer"></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="h-3 w-28 rounded-full shimmer"></div>
              <div className="h-8 w-36 rounded-2xl shimmer"></div>
              <div className="h-3 w-32 rounded-full shimmer"></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...Array(2)].map((_, idx) => (
                <div key={idx} className="h-20 rounded-xl shimmer"></div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-4 w-24 rounded-full shimmer"></div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl shimmer"></div>
            ))}
          </CardContent>
        </Card>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="font-semibold text-sm">Overview</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-pressed={isPortfolioHidden}
              aria-label={isPortfolioHidden ? 'Show portfolio' : 'Hide portfolio'}
              onClick={() => setIsPortfolioHidden((prev) => !prev)}
            >
              {isPortfolioHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IDR">IDR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Top summary always visible */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
              <p className="text-lg font-bold">{totalNetWorthDisplay.primary}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{totalNetWorthDisplay.secondary}</p>
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-xs font-medium ${getPnLColor(totalPnL)}`}>
                  {isPortfolioHidden ? maskToken : `${totalPnL >= 0 ? '+' : ''}${totalPnLDisplay.primary}`}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {isPortfolioHidden ? maskToken : `(${totalPnLDisplay.secondary})`}
                </span>
              </div>
            </div>
            <div className="p-2 rounded-full bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="rounded-md border">
              <details>
                <summary className="list-none cursor-pointer select-none text-center text-sm text-emerald-700 py-2">
                  View Detail
                </summary>
                <div className="space-y-3 p-3 pt-1">
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Digital Assets</p>
                      <p className="text-base font-semibold">{digitalMarketDisplay.primary}</p>
                      <p className="text-xs text-muted-foreground">{digitalMarketDisplay.secondary}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`text-xs font-medium ${getPnLColor(digitalPnL)}`}>
                          {isPortfolioHidden ? maskToken : `${digitalPnL >= 0 ? '+' : ''}${digitalPnLDisplay.primary}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isPortfolioHidden ? maskToken : `(${digitalPnLDisplay.secondary})`}
                        </span>
                      </div>
                    </div>
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Total Cash</p>
                      <p className="text-base font-semibold">{totalCashDisplay.primary}</p>
                      <p className="text-xs text-muted-foreground">{totalCashDisplay.secondary}</p>
                    </div>
                    <div className="p-2 rounded-full bg-emerald-700/10">
                      <Coins className="h-5 w-5 text-emerald-800 dark:text-emerald-500" />
                    </div>
                  </div>
                </div>
              </details>
            </div>

            <div className="rounded-md border">
              <details>
                <summary className="list-none cursor-pointer select-none text-center text-sm text-emerald-700 underline py-2">
                  View Distribution Chart
                </summary>
                <div className="space-y-3 p-3 pt-1">
                  <div className="rounded-lg border p-3">
                    <PortfolioPie
                      digitalUSD={digitalMarket}
                      cashUSD={totalCash}
                      currency={currency}
                      idrPerUsd={idrPerUsd}
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        FX Rate: {idrPerUsd > 0 ? formatIDR(idrPerUsd) : 'loading...'} per USD
      </p>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Holdings</CardTitle>
          {entries.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0"
                  aria-label="Sort holdings"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => setHoldingsSort('alpha')}
                  className="text-xs flex items-center gap-2"
                >
                  <Check
                    className={`h-3 w-3 ${holdingsSort === 'alpha' ? 'opacity-100' : 'opacity-0'}`}
                  />
                  A to Z
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setHoldingsSort('market')}
                  className="text-xs flex items-center gap-2"
                >
                  <Check
                    className={`h-3 w-3 ${holdingsSort === 'market' ? 'opacity-100' : 'opacity-0'}`}
                  />
                  Market Value
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setHoldingsSort('pnl')}
                  className="text-xs flex items-center gap-2"
                >
                  <Check
                    className={`h-3 w-3 ${holdingsSort === 'pnl' ? 'opacity-100' : 'opacity-0'}`}
                  />
                  P&L
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
        <CardContent>
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Tap the plus button below to add your first asset.
            </p>
          )}
          {entries.length > 0 && (
            <div className="space-y-2 mb-24">
              {sortedHoldings.map(({ entry, index: originalIndex, isCash, currentValueUSD, pnl, cashDisplayAmount }) => {
                const formatted = getDisplayValue(currentValueUSD);
                const livePnl = isCash ? 0 : pnl;
                const pnlDisplay = getDisplayValue(Math.abs(livePnl));
                const pnlText = isPortfolioHidden
                  ? maskToken
                  : `${livePnl >= 0 ? '+' : '-'}${pnlDisplay.primary}`;
                return (
                  <div
                    key={originalIndex}
                    className="flex items-center gap-3 border-b rounded-lg min-h-16"
                  >
                    {isCash ? (
                      <div className="flex flex-1 min-w-0 items-center gap-2 px-1 py-2">
                        <div className="p-2 rounded-full bg-muted">
                          <DollarSign className="h-4 w-4 text-emerald-800 dark:text-emerald-500" />
                        </div>
                        <div className="flex flex-col justify-start">
                          <p className="font-semibold text-xs truncate">
                            {entry.category}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isPortfolioHidden
                              ? maskToken
                              : `${(cashDisplayAmount ?? 0).toLocaleString()} ${entry.cashCurrency}`}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex flex-1 min-w-0 items-center gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
                        onClick={() => navigateToSymbol(entry.symbol)}
                      >
                        <TickerAvatar
                          symbol={entry.symbol}
                          logo={logoMap[entry.symbol]}
                          sizeClass="h-8 w-8"
                          backgroundClass="bg-muted"
                        />
                        <div className="flex flex-col justify-start">
                          <p className="font-semibold text-xs truncate">
                            {entry.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isPortfolioHidden ? maskToken : `${entry.amount} ${entry.unit}`}
                          </p>
                        </div>
                      </button>
                    )}
                    <div className="flex items-center gap-2" data-holdings-actions="true">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatted.primary}</p>
                        <p className="text-[10px] text-muted-foreground">{formatted.secondary}</p>
                        {!isCash && livePnl !== 0 && (
                          <p className="text-[10px]">
                            <span className={getPnLColor(livePnl)}>
                              {pnlText}
                            </span>
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openEdit(originalIndex);
                            }}
                            className="text-xs"
                          >
                            <Pencil className="mr-1 size-3" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              removeEntry(originalIndex);
                            }}
                            className="text-xs text-red-600"
                          >
                            <Trash2 className="mr-1 size-3" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen && isAuthenticated}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDialogOpen(false);
            return;
          }
          if (!ensureAuthenticated()) {
            return;
          }
          setDialogOpen(true);
        }}
      >
        <DialogContent className="fixed max-w-none m-0 h-screen rounded-none p-0 flex flex-col" closeButtonPosition="right">
          <div className="flex items-center gap-2 p-4 border-b">
            <DialogTitle className="text-base">{editingIndex != null ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </div>
          
          <div className="flex-1 overflow-auto">
            <div className="px-4">
              <DialogDescription className="mb-4 text-xs">
                Record your {assetType === 'cash' ? 'cash' : 'digital asset'} details. 
                {assetType === 'digital'}
              </DialogDescription>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Asset Type Selection */}
                <div className="flex flex-col gap-2">
                  <Label>Asset Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={assetType === 'digital' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAssetType('digital')}
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Digital Assets
                    </Button>
                    <Button
                      type="button"
                      variant={assetType === 'cash' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAssetType('cash')}
                      className="flex-1"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Cash
                    </Button>
                  </div>
                </div>

                {assetType === 'digital' ? (
                  <>
                    {/* Digital Asset Fields */}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="symbolSearch">Symbol</Label>
                      <input
                        id="symbolSearch"
                        value={symbolQuery}
                        onChange={(e) => { setSymbolQuery(e.target.value); setForm(f => ({ ...f, symbol: e.target.value })); }}
                        placeholder="Search ticker (e.g. AAPL, BBCA.JK)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {loadingSearch && <p className="text-xs text-muted-foreground">Searching...</p>}
                      {!loadingSearch && symbolResults.length > 0 && (
                        <div className="max-h-40 overflow-auto rounded-md border border-border bg-background shadow-sm p-1 flex flex-col gap-2">
                          {symbolResults.map(r => (
                            <button
                              type="button"
                              key={r.symbol}
                              onClick={() => handleSelectSymbol(r)}
                              className="w-full text-left px-2 py-1 rounded hover:bg-accent text-xs"
                            >
                              <span className="font-medium">{r.symbol}</span> <span className="text-muted-foreground">{r.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="amount">Amount</Label>
                        <input
                          id="amount"
                          value={form.amount}
                          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0"
                          type="number"
                          step="any"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Select
                          value={effectiveUnit}
                          onValueChange={(value) => setForm(f => ({ ...f, unit: value }))}
                          disabled={unitLocked}
                        >
                          <SelectTrigger id="unit" className="w-full h-9 px-3 text-sm">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="share">Share</SelectItem>
                            <SelectItem value="lot">Lot</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="avgPrice">Average Price</Label>
                      <input
                        id="avgPrice"
                        value={form.avgPrice}
                        onChange={(e) => setForm(f => ({ ...f, avgPrice: e.target.value }))}
                        placeholder="0"
                        type="number"
                        step="any"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <p className="text-xs text-muted-foreground">Price per {effectiveUnit === 'lot' ? 'lot' : 'share'} in native currency</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Cash Asset Fields */}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="category">Category</Label>
                      <input
                        id="category"
                        value={form.category}
                        onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                        placeholder="e.g., Bank BCA, Gopay, etc."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="cashAmount">Amount</Label>
                        <input
                          id="cashAmount"
                          value={form.amount}
                          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                          placeholder="0"
                          type="number"
                          step="any"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <p className="text-xs text-muted-foreground">Total cash in selected currency</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="cashCurrency">Currency</Label>
                        <Select
                          value={form.cashCurrency}
                          onValueChange={(value) => setForm(f => ({ ...f, cashCurrency: value }))}
                        >
                          <SelectTrigger id="cashCurrency" className="w-full h-9 px-3 text-sm">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IDR">IDR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">{editingIndex != null ? 'Save' : 'Add'}</Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        size="icon"
        className="fixed bottom-30 right-4 h-14 w-14 rounded-full bg-emerald-700 shadow-lg z-40"
        onClick={openAdd}
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}
