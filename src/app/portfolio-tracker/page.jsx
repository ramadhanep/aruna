"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MoreVertical, Pencil, Trash2, Loader2, CreditCard, TrendingUp, ArrowUpDown, Check, Eye, EyeClosed } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth-provider';
import { fetchEncodedJson } from '@/lib/api-client';
import { TickerAvatar } from '@/components/ticker-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTickerDisplay } from '@/lib/utils';
import { useTrial } from '@/components/trial-provider';
import { GoogleGlyph } from '@/components/google-glyph';

// Dynamic chart component to keep page light and avoid SSR issues
const PortfolioPie = dynamic(() => import('./pie').then(m => m.PortfolioPie), { ssr: false });

// LocalStorage keys
const PORTFOLIO_CURRENCY_KEY = 'portfolio_currency';
const PORTFOLIO_VISIBILITY_KEY = 'portfolio_visibility_hidden';
const GUEST_PORTFOLIO_KEY = 'aruna_guest_portfolio';
const GUEST_PORTFOLIO_SEEDED_KEY = 'aruna_guest_portfolio_seeded';
const MOBILE_BREAKPOINT = 1024;
const CURRENCY_META = {
  IDR: {
    code: 'IDR',
    flag: '🇮🇩',
    label: 'Indonesian Rupiah',
    description: 'Mata uang resmi Indonesia.',
  },
  USD: {
    code: 'USD',
    flag: '🇺🇸',
    label: 'United States Dollar',
    description: 'Mata uang resmi Amerika Serikat.',
  },
  SGD: {
    code: 'SGD',
    flag: '🇸🇬',
    label: 'Singapore Dollar',
    description: 'Mata uang resmi Singapura.',
  },
};
const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META);
const DEFAULT_PORTFOLIO_ENTRIES = [
  { symbol: 'BTC-USD', name: 'Bitcoin', amount: 1, unit: 'share', avgPrice: 65000, type: 'digital' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', amount: 100, unit: 'share', avgPrice: 120, type: 'digital' },
  { symbol: 'AAPL', name: 'Apple Inc.', amount: 50, unit: 'share', avgPrice: 175, type: 'digital' },
  { symbol: 'BBCA.JK', name: 'Bank Central Asia Tbk', amount: 1000, unit: 'lot', avgPrice: 7500, type: 'digital' },
  { symbol: 'CASH_IDR', name: 'Cash (IDR)', amount: 1, unit: 'unit', avgPrice: 30000, type: 'cash', category: 'Cash (IDR)', cashCurrency: 'IDR', nativeAmount: 500000000 },
];

function getDefaultPortfolio() {
  return DEFAULT_PORTFOLIO_ENTRIES.map((entry) => ({ ...entry }));
}

// Guest portfolio localStorage helpers
function loadGuestPortfolio() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_PORTFOLIO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function saveGuestPortfolio(entries) {
  try {
    localStorage.setItem(GUEST_PORTFOLIO_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save guest portfolio', e);
  }
}

function hasGuestPortfolioBeenSeeded() {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(GUEST_PORTFOLIO_SEEDED_KEY) === 'true'; } catch { return false; }
}

function markGuestPortfolioSeeded() {
  try { localStorage.setItem(GUEST_PORTFOLIO_SEEDED_KEY, 'true'); } catch { /* ignore */ }
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
    if (SUPPORTED_CURRENCIES.includes(raw)) {
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

function PortfolioMiniChart({ data, isPositive, width = 92, height = 44, fullWidth = false, className = '' }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className="rounded-full bg-muted/40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const baseWidth = fullWidth ? 100 : width;
  const baseHeight = height;
  const coordinates = data.map((value, index) => {
    const x = (index / (data.length - 1)) * baseWidth;
    const y = baseHeight - ((value - min) / range) * baseHeight;
    return { x, y };
  });

  const linePath = coordinates
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const firstValue = data[0];
  const baselineY = baseHeight - ((firstValue - min) / range) * baseHeight;

  return (
    <svg
      width={fullWidth ? '100%' : width}
      height={fullWidth ? '100%' : height}
      viewBox={`0 0 ${baseWidth} ${baseHeight}`}
      preserveAspectRatio={fullWidth ? 'none' : 'xMidYMid meet'}
      className={`overflow-visible ${className}`}
    >
      <line
        x1="0"
        y1={baselineY}
        x2={baseWidth}
        y2={baselineY}
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2,2"
        opacity="0.25"
        className="text-muted-foreground"
      />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coordinates[coordinates.length - 1].x}
        cy={coordinates[coordinates.length - 1].y}
        r={2.2}
        fill={strokeColor}
      />
    </svg>
  );
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
  const [sgdPerUsd, setSgdPerUsd] = useState(0); // SGD per USD (e.g., 1.34)
  const justSelectedRef = React.useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPortfolioHidden, setIsPortfolioHidden] = useState(() => loadPortfolioVisibility());
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [isMobileExperience, setIsMobileExperience] = useState(false);
  const [portfolioMiniSeries, setPortfolioMiniSeries] = useState([]);
  const [portfolioMiniLoading, setPortfolioMiniLoading] = useState(false);
  const touchStartY = React.useRef(0);
  const containerRef = React.useRef(null);
  const remotePortfolioSeedRef = React.useRef(false);
  const hydratePortfolioRef = React.useRef(true);
  const guestSyncedRef = React.useRef(false);
  const {
    user,
    loading: authLoading,
    remotePortfolio,
    portfolioLoaded,
    syncPortfolio,
    signInWithGoogle,
    supabaseConfigured,
  } = useAuth();
  const { initialized: _trialInitialized } = useTrial();
  const isAuthenticated = Boolean(user);
  const [authError, setAuthError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const handleGoogleSignIn = useCallback(async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle('/portfolio-tracker');
    } catch (error) {
      console.error('Failed to start Google sign-in', error);
      setAuthError(
        supabaseConfigured
          ? 'Failed to sign in with Google. Please try again.'
          : 'Sign-in is not configured yet.'
      );
      setSigningIn(false);
    }
  }, [signInWithGoogle, supabaseConfigured]);

  useEffect(() => {
    if (authLoading) return;
  }, [authLoading]);

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
      const validLast = series.slice().reverse().find(s => s?.adjclose != null);
      const logo = data?.meta?.logo || null;
      return {
        price: validLast?.adjclose ?? null,
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

  const refreshFxRates = useCallback(async () => {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 60 * 60 * 24 * 5;

    const [idrResponse, sgdResponse] = await Promise.all([
      fetchEncodedJson(`/api/finance?symbol=IDR=X&startDate=${startDate}&endDate=${endDate}`),
      fetchEncodedJson(`/api/finance?symbol=SGD=X&startDate=${startDate}&endDate=${endDate}`),
    ]);

    const idrSeries = idrResponse.data?.data || [];
    if (idrResponse.response.ok && idrSeries.length > 0) {
      const idrLast = idrSeries.slice().reverse().find(s => s?.adjclose != null)?.adjclose;
      if (idrLast) {
        setIdrPerUsd(idrLast);
        setFxRate(1 / idrLast);
      }
    }

    const sgdSeries = sgdResponse.data?.data || [];
    if (sgdResponse.response.ok && sgdSeries.length > 0) {
      const sgdLast = sgdSeries.slice().reverse().find(s => s?.adjclose != null)?.adjclose;
      if (sgdLast) {
        setSgdPerUsd(sgdLast);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const updateMode = () => setIsMobileExperience(media.matches);
    updateMode();
    media.addEventListener('change', updateMode);
    return () => media.removeEventListener('change', updateMode);
  }, []);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    const digitalEntries = entries.filter(e => e.type !== 'cash');
    if (digitalEntries.length === 0) return; // Only refresh if there are digital assets

    setIsRefreshing(true);
    try {
      await refreshFxRates();
      // Refresh prices only for digital assets
      await refreshPrices(digitalEntries);
    } catch (e) {
      console.warn('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, entries, refreshFxRates, refreshPrices]);

  // Pull to refresh touch handlers
  const handleTouchStart = useCallback((e) => {
    if (!isMobileExperience) return;
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, [isMobileExperience]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobileExperience) return;
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
  }, [isMobileExperience, isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobileExperience) return;
    if (pullDistance > 80) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  }, [isMobileExperience, pullDistance, handleRefresh]);

  // Initial load handled by lazy initializer above

  // Fetch FX rates once on mount
  useEffect(() => {
    (async () => {
      try {
        await refreshFxRates();
      } catch (e) {
        console.warn('FX rate fetch failed', e);
      }
    })();
  }, [refreshFxRates]);

  // Guest mode: load from localStorage, seed starter portfolio once
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) return; // handled by remote effect below

    const saved = loadGuestPortfolio();
    if (saved !== null) {
      hydratePortfolioRef.current = true;
      setEntries(saved);
    } else if (!hasGuestPortfolioBeenSeeded()) {
      markGuestPortfolioSeeded();
      const defaults = getDefaultPortfolio();
      hydratePortfolioRef.current = true;
      setEntries(defaults);
      saveGuestPortfolio(defaults);
    } else {
      hydratePortfolioRef.current = true;
      setEntries([]);
    }
    setInitialLoading(false);
    setPortfolioReady(true);
  }, [authLoading, isAuthenticated]);

  // Authenticated mode: load from remote
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    if (!portfolioLoaded) {
      setPortfolioReady(false);
      return;
    }

    if (Array.isArray(remotePortfolio)) {
      hydratePortfolioRef.current = true;
      setEntries(remotePortfolio);
      setPortfolioReady(true);
      return;
    }

    if (!remotePortfolioSeedRef.current) {
      remotePortfolioSeedRef.current = true;
      // On first sign-in, import guest portfolio if it exists, otherwise seed defaults
      const guestData = loadGuestPortfolio();
      const initialEntries = (guestData && guestData.length > 0) ? guestData : getDefaultPortfolio();
      hydratePortfolioRef.current = true;
      setEntries(initialEntries);
      setPortfolioReady(true);
      syncPortfolio(initialEntries)
        .catch(() => null)
        .finally(() => { remotePortfolioSeedRef.current = false; });
    }
  }, [authLoading, isAuthenticated, portfolioLoaded, remotePortfolio, syncPortfolio]);

  // On sign-in with existing remote data: offer to import local if remote is empty
  useEffect(() => {
    if (!isAuthenticated || !portfolioLoaded || guestSyncedRef.current) return;
    if (Array.isArray(remotePortfolio) && remotePortfolio.length === 0) {
      const guestData = loadGuestPortfolio();
      if (guestData && guestData.length > 0) {
        guestSyncedRef.current = true;
        syncPortfolio(guestData).catch(() => null);
      }
    }
  }, [isAuthenticated, portfolioLoaded, remotePortfolio, syncPortfolio]);

  // Persist changes and refresh prices when entries mutate
  useEffect(() => {
    if (!portfolioReady) {
      return;
    }

    if (hydratePortfolioRef.current) {
      hydratePortfolioRef.current = false;
    } else if (isAuthenticated) {
      syncPortfolio(entries).catch(() => { });
    } else {
      // Guest mode: persist to localStorage
      saveGuestPortfolio(entries);
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
  }, [entries, isAuthenticated, refreshPrices, syncPortfolio, portfolioReady]);

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
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(idx) {
    const e = entries[idx];
    const isCash = e.type === 'cash';
    let cashAmountDisplay = '';
    if (isCash) {
      if (typeof e.nativeAmount === 'number') {
        cashAmountDisplay = String(e.nativeAmount);
      } else {
        const usdValue = e.avgPrice * e.amount;
        if (e.cashCurrency === 'IDR' && fxRate > 0) cashAmountDisplay = String(usdValue / fxRate);
        else if (e.cashCurrency === 'SGD' && sgdPerUsd > 0) cashAmountDisplay = String(usdValue * sgdPerUsd);
        else cashAmountDisplay = String(usdValue);
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
          alert('IDR FX rate unavailable. Please refresh to update rates.');
          return;
        }
        totalUSD = nativeAmount * fxRate; // IDR * (USD per IDR) = USD
      } else if (form.cashCurrency === 'SGD') {
        if (sgdPerUsd <= 0) {
          alert('SGD FX rate unavailable. Please refresh to update rates.');
          return;
        }
        totalUSD = nativeAmount / sgdPerUsd; // SGD / (SGD per USD) = USD
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

  useEffect(() => {
    let cancelled = false;

    const buildMiniSeries = async () => {
      const digital = entries.filter((entry) => entry.type !== 'cash');
      const cashTotalUSD = entries
        .filter((entry) => entry.type === 'cash')
        .reduce((sum, entry) => sum + (entry.avgPrice * entry.amount), 0);

      if (digital.length === 0) {
        setPortfolioMiniSeries(cashTotalUSD > 0 ? [cashTotalUSD, cashTotalUSD] : []);
        return;
      }

      setPortfolioMiniLoading(true);
      try {
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - 60 * 60 * 24 * 45;
        const uniqueSymbols = [...new Set(digital.map((entry) => entry.symbol))];

        const responses = await Promise.all(
          uniqueSymbols.map((symbol) =>
            fetchEncodedJson(
              `/api/finance?symbol=${encodeURIComponent(symbol)}&startDate=${startDate}&endDate=${endDate}`
            )
          )
        );

        const seriesBySymbol = {};
        const allDatesSet = new Set();
        uniqueSymbols.forEach((symbol, idx) => {
          const payload = responses[idx];
          const points = (payload?.data?.data || [])
            .filter((row) => row?.date && typeof row?.adjclose === 'number')
            .map((row) => ({ date: row.date.slice(0, 10), price: row.adjclose }));
          if (points.length > 0) {
            seriesBySymbol[symbol] = points;
            points.forEach((row) => allDatesSet.add(row.date));
          }
        });

        const orderedDates = [...allDatesSet].sort((a, b) => a.localeCompare(b));
        if (orderedDates.length === 0) {
          setPortfolioMiniSeries([]);
          return;
        }

        const lastKnownPriceBySymbol = {};
        const mapByDateBySymbol = {};
        uniqueSymbols.forEach((symbol) => {
          const rows = seriesBySymbol[symbol] || [];
          mapByDateBySymbol[symbol] = new Map(rows.map((row) => [row.date, row.price]));
          if (rows.length > 0) {
            lastKnownPriceBySymbol[symbol] = rows[0].price;
          }
        });

        const values = orderedDates.map((dateKey) => {
          let dailyValue = cashTotalUSD;

          digital.forEach((entry) => {
            const dateMap = mapByDateBySymbol[entry.symbol];
            if (!dateMap) return;
            const nextPrice = dateMap.get(dateKey);
            if (typeof nextPrice === 'number') {
              lastKnownPriceBySymbol[entry.symbol] = nextPrice;
            }
            const activePrice = lastKnownPriceBySymbol[entry.symbol];
            if (typeof activePrice !== 'number') return;
            const priceInUSD = isIDR(entry.symbol) && fxRate > 0 ? activePrice * fxRate : activePrice;
            const effectiveAmount = getEffectiveAmount(entry.amount, entry.unit);
            dailyValue += priceInUSD * effectiveAmount;
          });

          return dailyValue;
        });

        if (!cancelled) {
          setPortfolioMiniSeries(values.slice(-30));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to build portfolio mini chart series', error);
          setPortfolioMiniSeries([]);
        }
      } finally {
        if (!cancelled) {
          setPortfolioMiniLoading(false);
        }
      }
    };

    buildMiniSeries();
    return () => {
      cancelled = true;
    };
  }, [entries, fxRate, getEffectiveAmount, isIDR]);

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
            : (entry.cashCurrency === 'SGD' && sgdPerUsd > 0
              ? baseValueUSD * sgdPerUsd
              : baseValueUSD)))
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
  }, [entries, priceMap, fxRate, sgdPerUsd, getEffectiveAmount, toUSD]);

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

  // Holdings allocation for chart
  const holdingsAllocation = useMemo(() => {
    return holdingsWithMetrics.map((h) => {
      return {
        name: h.isCash ? h.entry.category : formatTickerDisplay(h.entry.symbol),
        value: h.currentValueUSD,
      };
    });
  }, [holdingsWithMetrics]);

  const digitalAllocation = useMemo(() => {
    const digitalHoldings = holdingsWithMetrics.filter((h) => !h.isCash);
    return digitalHoldings.map((h) => {
      return {
        name: formatTickerDisplay(h.entry.symbol),
        symbol: h.entry.symbol,
        logo: logoMap[h.entry.symbol] || null,
        value: h.currentValueUSD,
      };
    });
  }, [holdingsWithMetrics, logoMap]);

  const cashTypeAllocation = useMemo(() => {
    const totals = new Map();
    holdingsWithMetrics
      .filter((h) => h.isCash)
      .forEach((h) => {
        const code = h.entry.cashCurrency || 'USD';
        const prev = totals.get(code) || 0;
        totals.set(code, prev + h.currentValueUSD);
      });

    return [...totals.entries()].map(([code, value]) => {
      return {
        name: code,
        value,
      };
    });
  }, [holdingsWithMetrics]);

  // Total Net Worth
  const totalNetWorth = digitalMarket + totalCash;
  const totalPnL = digitalPnL;

  function formatUSD(v) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  function formatIDR(v) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  }
  function formatSGD(v) {
    return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }

  // Convert USD amount to IDR for display
  function usdToIdr(usdAmount) {
    if (idrPerUsd <= 0) return 0;
    return usdAmount * idrPerUsd;
  }
  function usdToSgd(usdAmount) {
    if (sgdPerUsd <= 0) return 0;
    return usdAmount * sgdPerUsd;
  }

  function formatByCurrency(code, amount) {
    if (code === 'IDR') return formatIDR(amount);
    if (code === 'SGD') return formatSGD(amount);
    return formatUSD(amount);
  }

  // Format value based on selected currency
  function formatValue(usdAmount) {
    const idrAmount = usdToIdr(usdAmount);
    const sgdAmount = usdToSgd(usdAmount);
    if (currency === 'IDR') {
      if (idrPerUsd <= 0) {
        return {
          primary: formatUSD(usdAmount),
          secondary: 'IDR FX unavailable',
          tertiary: formatSGD(sgdAmount),
        };
      }
      return {
        primary: formatIDR(idrAmount),
        secondary: formatUSD(usdAmount),
        tertiary: formatSGD(sgdAmount),
      };
    }
    if (currency === 'SGD') {
      if (sgdPerUsd <= 0) {
        return {
          primary: formatUSD(usdAmount),
          secondary: 'SGD FX unavailable',
          tertiary: formatIDR(idrAmount),
        };
      }
      return {
        primary: formatSGD(sgdAmount),
        secondary: formatUSD(usdAmount),
        tertiary: formatIDR(idrAmount),
      };
    }
    return {
      primary: formatUSD(usdAmount),
      secondary: formatIDR(idrAmount),
      tertiary: formatSGD(sgdAmount),
    };
  }

  const hiddenPrimaryToken = '••••••';
  const hiddenSecondaryToken = 'Hidden';
  const getDisplayValue = (usdAmount) =>
  (isPortfolioHidden
    ? { primary: hiddenPrimaryToken, secondary: hiddenSecondaryToken, tertiary: hiddenSecondaryToken }
    : formatValue(usdAmount));
  const getPnLColor = (value) => (isPortfolioHidden ? 'text-muted-foreground' : value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400');
  const totalNetWorthDisplay = getDisplayValue(totalNetWorth);
  const totalPnLDisplay = getDisplayValue(totalPnL);
  const digitalMarketDisplay = getDisplayValue(digitalMarket);
  const digitalPnLDisplay = getDisplayValue(digitalPnL);
  const totalCashDisplay = getDisplayValue(totalCash);
  const selectedCurrencyMeta = CURRENCY_META[currency] || CURRENCY_META.IDR;
  const idrFxDisplay = idrPerUsd > 0 ? formatIDR(idrPerUsd) : 'loading...';

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  if (initialLoading) {
    return (
      <div className={`flex flex-col gap-4 ${isMobileExperience ? 'pb-28' : ''}`}>
        <Card className={isMobileExperience ? 'rounded-3xl' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-[132px] rounded-md" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="h-6 w-40 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 w-36 rounded-md" />
              </div>
              <Skeleton className="h-[44px] w-[92px] rounded-md" />
            </div>
            <div className="rounded-xl border border-border/20 p-3">
              <Skeleton className="h-4 w-24 rounded-md mx-auto" />
            </div>
            <div className="rounded-xl border border-border/20 p-3">
              <Skeleton className="h-4 w-44 rounded-md mx-auto" />
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
          <Skeleton className="h-3 w-28 rounded-md mx-auto" />
        </div>

        <Card className={`h-full ${isMobileExperience ? 'rounded-3xl' : ''}`}>
          <CardHeader className="flex items-center justify-between">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className={`space-y-2 ${isMobileExperience ? 'mb-20' : 'mb-4'}`}>
              {[...Array(isMobileExperience ? 4 : 5)].map((_, idx) => (
                <div
                  key={`holding-${idx}`}
                  className={`flex items-center gap-3 p-2 rounded-xl min-h-16 border ${isMobileExperience ? 'bg-background/80 border-border/40' : 'border-border/20'}`}
                >
                  <div className="flex flex-1 min-w-0 items-center gap-2 px-1 py-2">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-20 rounded-md" />
                      <Skeleton className="h-3 w-16 rounded-md" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="space-y-1.5 text-right">
                      <Skeleton className="h-3 w-20 rounded-md" />
                      <Skeleton className="h-3 w-16 rounded-md ml-auto" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-4 ${isMobileExperience ? 'pb-28' : 'lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start'}`}
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

      <div className={`${isMobileExperience ? '' : 'lg:col-span-4'} flex flex-col gap-4`}>
        <Card className={isMobileExperience ? 'rounded-3xl' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
            <CardTitle className="font-semibold text-sm">Overview</CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-muted/40"
                aria-pressed={isPortfolioHidden}
                aria-label={isPortfolioHidden ? 'Show portfolio' : 'Hide portfolio'}
                onClick={() => setIsPortfolioHidden((prev) => !prev)}
              >
                {isPortfolioHidden ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-[132px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDR">🇮🇩 IDR</SelectItem>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                  <SelectItem value="SGD">🇸🇬 SGD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Top summary always visible */}
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
                <p className="text-xl font-bold tracking-tight">{totalNetWorthDisplay.primary}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{totalNetWorthDisplay.secondary}</p>
                {/* {!isPortfolioHidden && <p className="text-[10px] text-muted-foreground mt-0.5">{totalNetWorthDisplay.tertiary}</p>} */}
                <div className="mt-1 flex items-center gap-1">
                  <span className={`text-xs font-medium ${getPnLColor(totalPnL)}`}>
                    {isPortfolioHidden ? hiddenSecondaryToken : `${totalPnL >= 0 ? '+' : ''}${totalPnLDisplay.primary}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isPortfolioHidden ? hiddenSecondaryToken : `(${totalPnLDisplay.secondary})`}
                  </span>
                </div>
              </div>
              <div className="mt-5">
                {portfolioMiniLoading ? (
                  <div className="flex items-center justify-center w-[92px] h-[44px]">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <PortfolioMiniChart
                    data={portfolioMiniSeries}
                    isPositive={totalPnL >= 0}
                    chartId="portfolio-overview-mini"
                    className="opacity-70 w-32"
                  />
                )}
              </div>
            </div>

            {/* <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
              <div className="flex items-start gap-2">
                <div>
                  <p className="text-xs font-medium">{selectedCurrencyMeta.flag} {selectedCurrencyMeta.code} · {selectedCurrencyMeta.label}</p>
                  <p className="text-[11px] text-muted-foreground">{selectedCurrencyMeta.description}</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {SUPPORTED_CURRENCIES.map((code) => (
                  <p key={code} className="text-[10px] text-muted-foreground">
                    {CURRENCY_META[code].flag} {CURRENCY_META[code].code}: {CURRENCY_META[code].label}
                  </p>
                ))}
              </div>
            </div> */}

            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-border/20">
                <details>
                  <summary className="list-none cursor-pointer select-none text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 py-2.5">
                    View Detail
                  </summary>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-3 p-3 rounded-xl border">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Digital Assets</p>
                        <p className="text-base font-semibold">{digitalMarketDisplay.primary}</p>
                        <p className="text-xs text-muted-foreground">{digitalMarketDisplay.secondary}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={`text-xs font-medium ${getPnLColor(digitalPnL)}`}>
                            {isPortfolioHidden ? hiddenSecondaryToken : `${digitalPnL >= 0 ? '+' : ''}${digitalPnLDisplay.primary}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isPortfolioHidden ? hiddenSecondaryToken : `(${digitalPnLDisplay.secondary})`}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 rounded-full bg-blue-500/10">
                        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl border">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">Total Cash</p>
                        <p className="text-base font-semibold">{totalCashDisplay.primary}</p>
                        <p className="text-xs text-muted-foreground">{totalCashDisplay.secondary}</p>
                      </div>
                      <div className="p-2 rounded-full bg-emerald-700/10">
                        <CreditCard className="h-5 w-5 text-emerald-800 dark:text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </details>
              </div>

              <div className="rounded-xl border border-border/20">
                <details>
                  <summary className="list-none cursor-pointer select-none text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 py-2.5">
                    View Allocation Chart
                  </summary>
                  <div className="space-y-3 pt-1">
                    <PortfolioPie
                      digitalUSD={digitalMarket}
                      cashUSD={totalCash}
                      holdingsAllocation={holdingsAllocation}
                      digitalAllocation={digitalAllocation}
                      cashTypeAllocation={cashTypeAllocation}
                      currency={currency}
                      idrPerUsd={idrPerUsd}
                      sgdPerUsd={sgdPerUsd}
                    />
                  </div>
                </details>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guest local-portfolio info banner */}
        {!isAuthenticated && (
          <div className="rounded-2xl border border-border/40 bg-card px-4 py-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Local Portfolio</p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Your portfolio is stored only on this device.
                Sign in to securely sync across devices and prevent data loss.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn || !supabaseConfigured}
              className="w-full justify-center gap-2 rounded-full bg-foreground text-[12px] font-semibold text-background hover:bg-foreground/90 h-9"
            >
              {signingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GoogleGlyph />}
              {signingIn ? 'Connecting…' : 'Sync with Google'}
            </Button>
            {authError && (
              <p className="text-[11px] text-red-500 text-center">{authError}</p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground text-center">
            FX (1 USD): {idrFxDisplay}
          </p>
        </div>
      </div>

      <div className={`${isMobileExperience ? '' : 'lg:col-span-8'}`}>
        <Card className={`h-full ${isMobileExperience ? 'rounded-3xl' : ''}`}>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Holdings
            </CardTitle>
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
              <div className="flex flex-col items-center gap-4 py-12 px-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
                  <TrendingUp className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Start Building Your Portfolio</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed max-w-xs">
                    Track your stocks, crypto and cash in one place.
                    {!isAuthenticated && ' Everything is stored locally until you decide to sync with Google.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button
                    onClick={() => {
                      const defaults = getDefaultPortfolio();
                      hydratePortfolioRef.current = true;
                      setEntries(defaults);
                      if (!isAuthenticated) saveGuestPortfolio(defaults);
                    }}
                    className="rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs h-9"
                  >
                    Create Starter Portfolio
                  </Button>
                  {!isAuthenticated && supabaseConfigured && (
                    <Button
                      variant="outline"
                      onClick={handleGoogleSignIn}
                      disabled={signingIn}
                      className="rounded-full text-xs h-9 gap-2"
                    >
                      {signingIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GoogleGlyph />}
                      Sign in with Google
                    </Button>
                  )}
                </div>
              </div>
            )}
            {entries.length > 0 && (
              <div className={`space-y-2 ${isMobileExperience ? 'mb-20' : 'mb-4'}`}>
                {sortedHoldings.map(({ entry, index: originalIndex, isCash, currentValueUSD, pnl, cashDisplayAmount }) => {
                  const formatted = getDisplayValue(currentValueUSD);
                  const livePnl = isCash ? 0 : pnl;
                  const pnlDisplay = getDisplayValue(Math.abs(livePnl));
                  const pnlText = isPortfolioHidden
                    ? hiddenSecondaryToken
                    : `${livePnl >= 0 ? '+' : '-'}${pnlDisplay.primary}`;
                  return (
                    <div
                      key={originalIndex}
                      className={`flex items-center gap-3 p-2 rounded-2xl min-h-16 transition-colors border ${isMobileExperience ? 'bg-background/80 border-border/40' : 'border-border/20 hover:bg-muted/30'}`}
                    >
                      {isCash ? (
                        <div className="flex flex-1 min-w-0 items-center gap-2 px-1 py-2">
                          <div className="p-1.5 rounded-full bg-muted">
                            <CreditCard className="h-4.5 w-4.5 text-emerald-800 dark:text-emerald-500" />
                          </div>
                          <div className="flex flex-col justify-start">
                            <p className="font-semibold text-xs truncate">
                              {entry.category}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isPortfolioHidden
                                ? hiddenPrimaryToken
                                : formatByCurrency(entry.cashCurrency || 'USD', cashDisplayAmount ?? 0)}
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
                          />
                          <div className="flex flex-col justify-start">
                            <p className="font-semibold text-xs truncate">
                              {formatTickerDisplay(entry.symbol)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isPortfolioHidden ? hiddenPrimaryToken : `${entry.amount} ${entry.unit}`}
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
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDialogOpen(false);
            return;
          }
          setDialogOpen(true);
        }}
      >
        <DialogContent className="fixed max-w-none m-0 h-[86vh] lg:h-auto lg:max-h-[85vh] lg:w-[540px] lg:rounded-3xl lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 rounded-t-3xl p-0 flex flex-col mt-auto" closeButtonPosition="right">
          <div className="flex items-center gap-2 p-4 border-b">
            <DialogTitle className="text-base">{editingIndex != null ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="p-4">
              <DialogDescription className="mb-4 text-xs">
                Record your {assetType === 'cash' ? 'cash' : 'digital asset'} details.
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
                      <CreditCard className="h-4 w-4 mr-2" />
                      Cash
                    </Button>
                  </div>
                </div>

                {assetType === 'digital' ? (
                  <>
                    {/* Digital Asset Fields */}
                    <div className="relative flex flex-col gap-2">
                      <Label htmlFor="symbolSearch">Symbol</Label>
                      <input
                        id="symbolSearch"
                        value={symbolQuery}
                        onChange={(e) => { setSymbolQuery(e.target.value); setForm(f => ({ ...f, symbol: e.target.value })); }}
                        placeholder="Search ticker (e.g. AAPL, BBCA.JK)"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      {loadingSearch && <p className="text-xs text-muted-foreground">Searching...</p>}
                      {!loadingSearch && symbolResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-40 overflow-auto rounded-md border border-border bg-background p-1 flex flex-col gap-2">
                          {symbolResults.map(r => (
                            <button
                              type="button"
                              key={r.symbol}
                              onClick={() => handleSelectSymbol(r)}
                              className="w-full text-left px-2 py-1 rounded hover:bg-accent text-xs"
                            >
                              <span className="font-medium">{formatTickerDisplay(r.symbol)}</span> <span className="text-muted-foreground">{r.name}</span>
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
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                            <SelectItem value="IDR">🇮🇩 IDR</SelectItem>
                            <SelectItem value="USD">🇺🇸 USD</SelectItem>
                            <SelectItem value="SGD">🇸🇬 SGD</SelectItem>
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
        className={`fixed ${isMobileExperience ? 'bottom-24 right-4' : 'bottom-8 right-8'} h-14 w-14 rounded-full bg-emerald-700 z-40`}
        onClick={openAdd}
      >
        <Plus className="size-6 text-white" />
      </Button>
    </div>
  );
}
