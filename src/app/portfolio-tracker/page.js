"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MoreVertical, Pencil, Trash2, Loader2, Wallet, Coins, TrendingUp, DollarSign } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic chart component to keep page light and avoid SSR issues
const PortfolioPie = dynamic(() => import('./pie').then(m => m.PortfolioPie), { ssr: false });

// LocalStorage key for currency preference
const PORTFOLIO_CURRENCY_KEY = 'portfolio_currency';

// Minimal asset search (reuses existing API route if present)
async function searchSymbols(query) {
  if (!query) return [];
  try {
    const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    return json.symbols || [];
  } catch (e) {
    console.warn('Symbol search failed', e);
    return [];
  }
}

function loadPortfolio() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('aruna_portfolio');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to parse portfolio', e);
    return [];
  }
}

function savePortfolio(data) {
  try {
    localStorage.setItem('aruna_portfolio', JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save portfolio', e);
  }
}

function loadCurrencyPreference() {
  if (typeof window === 'undefined') return 'USD';
  try {
    const raw = localStorage.getItem(PORTFOLIO_CURRENCY_KEY);
    return raw === 'IDR' ? 'IDR' : 'USD';
  } catch (e) {
    return 'USD';
  }
}

function saveCurrencyPreference(currency) {
  try {
    localStorage.setItem(PORTFOLIO_CURRENCY_KEY, currency);
  } catch (e) {
    console.warn('Failed to save currency preference', e);
  }
}

export default function PortfolioTrackerPage() {
  const [entries, setEntries] = useState(() => loadPortfolio());
  const [currency, setCurrency] = useState(() => loadCurrencyPreference());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState([]);
  const [assetType, setAssetType] = useState('digital'); // 'digital' or 'cash'
  const [form, setForm] = useState({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '', type: 'digital', category: '', cashCurrency: 'USD' });
  const [priceMap, setPriceMap] = useState({}); // { symbol: currentPrice }
  const [fxRate, setFxRate] = useState(0); // USD per IDR (e.g., 1/16500 = 0.0000606)
  const [idrPerUsd, setIdrPerUsd] = useState(0); // IDR per USD (e.g., 16500)
  const justSelectedRef = React.useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = React.useRef(0);
  const containerRef = React.useRef(null);
  
  // Fetch latest prices (simple batch sequential)
  const fetchPrice = useCallback(async (symbol) => {
    try {
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - 60 * 60 * 24 * 5; // last ~5 days window
      const res = await fetch(`/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) return null;
      const json = await res.json();
      const data = json.data || [];
      if (data.length === 0) return null;
      const last = data[data.length - 1];
      return last.adjclose ?? null;
    } catch (e) {
      return null;
    }
  }, []);

  const refreshPrices = useCallback(async (list) => {
    const uniqueSymbols = [...new Set(list.map(e => e.symbol))];
    const updates = {};
    for (const sym of uniqueSymbols) {
      const p = await fetchPrice(sym);
      if (p != null) updates[sym] = p;
    }
    if (Object.keys(updates).length) {
      setPriceMap(pm => ({ ...pm, ...updates }));
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
      const res = await fetch(`/api/finance?symbol=IDR=X&startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        if (data.length > 0) {
          const last = data[data.length - 1];
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
        const res = await fetch(`/api/finance?symbol=IDR=X&startDate=${startDate}&endDate=${endDate}`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || [];
          if (data.length > 0) {
            const last = data[data.length - 1];
            // Yahoo's IDR=X returns the rate in IDR per 1 USD (e.g., 16500)
            const idrPerUsdVal = last.adjclose; // e.g., 16500
            if (idrPerUsdVal) {
              setIdrPerUsd(idrPerUsdVal);
              setFxRate(1 / idrPerUsdVal); // USD per 1 IDR
            }
          }
        }
      } catch (e) {
        console.warn('FX rate fetch failed', e);
      }
    })();
  }, []);

  // Persist changes and refresh prices when entries mutate
  useEffect(() => {
    savePortfolio(entries);
    const digitalEntries = entries.filter(e => e.type !== 'cash');
    if (digitalEntries.length > 0) {
      const id = setTimeout(() => {
        refreshPrices(digitalEntries);
      }, 0);
      return () => clearTimeout(id);
    }
  }, [entries, refreshPrices]);

  // Persist currency preference
  useEffect(() => {
    saveCurrencyPreference(currency);
  }, [currency]);

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
    setForm({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '', type: 'digital', category: '', cashCurrency: 'USD' });
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
    let latest = null;
    try {
      latest = await fetchPrice(symbol);
      if (latest != null) {
        setPriceMap(pm => ({ ...pm, [symbol]: latest }));
      }
    } catch (e) {
      // ignore
    }
    setForm(f => ({ ...f, symbol, name, unit: isJk ? 'lot' : f.unit, avgPrice: latest != null ? String(latest) : f.avgPrice }));
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
      cashCurrency: e.cashCurrency || 'USD'
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
      let newEntries = [...entries];
      if (editingIndex != null) {
        newEntries[editingIndex] = entry;
      } else {
        newEntries.push(entry);
      }
      setEntries(newEntries);
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
          const p = await fetchPrice(form.symbol);
          if (p != null) avgPriceNum = p;
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
      let newEntries = [...entries];
      if (editingIndex != null) {
        newEntries[editingIndex] = entry;
      } else {
        newEntries.push(entry);
      }
      setEntries(newEntries);
      setDialogOpen(false);
      resetForm();
    }
  }

  function removeEntry(idx) {
    const newEntries = entries.filter((_, i) => i !== idx);
    setEntries(newEntries);
  }

  // Effective unit (.JK defaults to lot)
  const effectiveUnit = useMemo(() => {
    if (form.symbol.endsWith('.JK')) return 'lot';
    return form.unit;
  }, [form.symbol, form.unit]);

  // Fetch latest prices (simple batch sequential)
  // (Removed duplicated non-hoisted implementations)

  // Compute portfolio metrics
  function isIDR(symbol) { return symbol.endsWith('.JK'); }
  function isLot(unit) { return unit === 'lot'; }

  // Convert a value expressed in its native currency to USD
  function toUSD(symbol, pricePerUnit) {
    if (pricePerUnit == null) return 0;
    if (!isIDR(symbol)) return pricePerUnit; // already USD
    if (fxRate <= 0) return pricePerUnit; // fallback treat as USD if rate missing
    return pricePerUnit * fxRate; // IDR price * (USD per IDR) = USD
  }

  // Get effective amount: if unit is 'lot', convert to shares by multiplying by 100
  // (effective shares = amount * 100)
  function getEffectiveAmount(amount, unit) {
    return isLot(unit) ? amount * 100 : amount;
  }

  // Separate digital and cash assets
  const digitalAssets = entries.filter(e => e.type !== 'cash');
  const cashAssets = entries.filter(e => e.type === 'cash');

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
      <Card className="p-4">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-sm">Overview</CardTitle>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="IDR">IDR</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Top summary always visible */}
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
              <p className="text-lg font-bold">{formatValue(totalNetWorth).primary}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatValue(totalNetWorth).secondary}</p>
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-xs font-medium ${totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}{formatValue(totalPnL).primary}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({formatValue(totalPnL).secondary})
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
                <summary className="list-none cursor-pointer select-none text-center text-sm text-emerald-600 py-1">
                  View Detail
                </summary>
                <div className="space-y-3 p-3 pt-1">
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Digital Assets</p>
                      <p className="text-lg font-semibold">{formatValue(digitalMarket).primary}</p>
                      <p className="text-xs text-muted-foreground">{formatValue(digitalMarket).secondary}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`text-xs font-medium ${digitalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {digitalPnL >= 0 ? '+' : ''}{formatValue(digitalPnL).primary}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({formatValue(digitalPnL).secondary})
                        </span>
                      </div>
                    </div>
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Total Cash</p>
                      <p className="text-lg font-semibold">{formatValue(totalCash).primary}</p>
                      <p className="text-xs text-muted-foreground">{formatValue(totalCash).secondary}</p>
                    </div>
                    <div className="p-2 rounded-full bg-emerald-600/10">
                      <Coins className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>
              </details>
            </div>

            <div className="rounded-md border">
              <details>
                <summary className="list-none cursor-pointer select-none text-center text-sm text-emerald-600 py-1">
                  View Distribution Chart
                </summary>
                <div className="space-y-3 p-3 pt-1">
                  <div className="rounded-lg border bg-card p-3">
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

      <Card className="p-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No assets yet. Tap the <span className="text-primary font-medium">+</span> button below to add your first asset.
            </p>
          )}
          {entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((e, idx) => {
                const isCash = e.type === 'cash';
                const effectiveAmount = isCash ? 1 : getEffectiveAmount(e.amount, e.unit);
                const valueUSD = isCash ? e.avgPrice * e.amount : toUSD(e.symbol, e.avgPrice) * effectiveAmount;
                const livePrice = priceMap[e.symbol];
                const currentValueUSD = isCash ? valueUSD : (livePrice != null ? toUSD(e.symbol, livePrice) * effectiveAmount : valueUSD);
                const pnl = currentValueUSD - valueUSD;
                const formatted = formatValue(currentValueUSD);
                const cashDisplayAmount = isCash
                  ? (typeof e.nativeAmount === 'number'
                      ? e.nativeAmount
                      : (e.cashCurrency === 'IDR' && fxRate > 0
                          ? (valueUSD / fxRate)
                          : valueUSD))
                  : null;
                
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-muted">
                            {isCash ? (
                              <DollarSign className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <p className="font-semibold text-sm truncate">
                            {isCash ? e.category : e.symbol}
                          </p>
                        </div>
                        {!isCash && e.name && (
                          <span className="text-xs text-muted-foreground truncate">{e.name}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isCash ? (
                          <span>{(cashDisplayAmount ?? 0).toLocaleString()} {e.cashCurrency}</span>
                        ) : (
                          <span>{e.amount} {e.unit}</span>
                        )}
                      </div>
                      {!isCash && pnl !== 0 && (
                        <div className="text-[10px] mt-0.5">
                          <span className={pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {pnl >= 0 ? '+' : ''}{formatValue(pnl).primary}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatted.primary}</p>
                        <p className="text-[10px] text-muted-foreground">{formatted.secondary}</p>
                      </div>
                      <DropdownMenu className="text-xs">
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(idx)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => removeEntry(idx)} className="text-red-600 dark:text-red-400">
                            <Trash2 className="mr-2 h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="fixed max-w-none m-0 h-screen rounded-none p-0 flex flex-col" closeButtonPosition="right">
          <div className="flex items-center gap-2 p-4 border-b">
            <DialogTitle className="text-sm">{editingIndex != null ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </div>
          
          <div className="flex-1 overflow-auto">
            <div className="p-4">
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
                        <select
                          id="unit"
                          value={effectiveUnit}
                          onChange={(e) => setForm(f => ({ ...f, unit: e.target.value }))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="share">Share</option>
                          <option value="lot">Lot</option>
                        </select>
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
                        <select
                          id="cashCurrency"
                          value={form.cashCurrency}
                          onChange={(e) => setForm(f => ({ ...f, cashCurrency: e.target.value }))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="USD">USD</option>
                          <option value="IDR">IDR</option>
                        </select>
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
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-emerald-600 shadow-lg z-40"
        onClick={openAdd}
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}
