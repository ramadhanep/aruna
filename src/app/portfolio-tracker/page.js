"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';

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

export default function PortfolioTrackerPage() {
  const [entries, setEntries] = useState(() => loadPortfolio());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState([]);
  const [form, setForm] = useState({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '' });
  const [priceMap, setPriceMap] = useState({}); // { symbol: currentPrice }
  const [fxRate, setFxRate] = useState(0); // USD per IDR (e.g., 1/16500 = 0.0000606)
  const [idrPerUsd, setIdrPerUsd] = useState(0); // IDR per USD (e.g., 16500)
  
  // Fetch latest prices (simple batch sequential)
  const fetchPrice = useCallback(async (symbol) => {
    try {
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - 60 * 60 * 24 * 5; // last ~5 days window
      const res = await fetch(`/api/yahoo-finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`);
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

  // Initial load handled by lazy initializer above

  // Fetch FX rate IDR=X (IDR per 1 USD) once on mount
  useEffect(() => {
    (async () => {
      try {
        // Fetch IDR=X from Yahoo Finance to get USD per IDR
        const endDate = Math.floor(Date.now() / 1000);
        const startDate = endDate - 60 * 60 * 24 * 5;
        const res = await fetch(`/api/yahoo-finance?symbol=IDR=X&startDate=${startDate}&endDate=${endDate}`);
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
    const id = setTimeout(() => {
      refreshPrices(entries);
    }, 0);
    return () => clearTimeout(id);
  }, [entries, refreshPrices]);

  // Search debounce
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!symbolQuery) { setSymbolResults([]); return; }
      setLoadingSearch(true);
      const res = await searchSymbols(symbolQuery);
      setSymbolResults(res);
      setLoadingSearch(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [symbolQuery]);

  function resetForm() {
    setForm({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '' });
    setSymbolQuery('');
    setSymbolResults([]);
    setEditingIndex(null);
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
    setSymbolQuery(symbol);
    setSymbolResults([]);
  }

  function openAdd() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(idx) {
    const e = entries[idx];
    setForm({ symbol: e.symbol, name: e.name, amount: String(e.amount), unit: e.unit, avgPrice: String(e.avgPrice) });
    setSymbolQuery(e.symbol);
    setEditingIndex(idx);
    setDialogOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!form.symbol || isNaN(amountNum)) return;

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
    const entry = { symbol: form.symbol, name: form.name, amount: amountNum, unit, avgPrice: avgPriceNum };
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

  const totalCost = entries.reduce((sum, e) => {
    const effectiveAmount = getEffectiveAmount(e.amount, e.unit);
    return sum + toUSD(e.symbol, e.avgPrice) * effectiveAmount;
  }, 0);
  
  const totalMarket = entries.reduce((sum, e) => {
    const live = priceMap[e.symbol];
    const costOrLive = live != null ? live : e.avgPrice;
    const effectiveAmount = getEffectiveAmount(e.amount, e.unit);
    return sum + toUSD(e.symbol, costOrLive) * effectiveAmount;
  }, 0);
  
  const totalPnL = totalMarket - totalCost;

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

  return (
  <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Portfolio Tracker</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <p className="text-sm">Market Value</p>
            <span className="font-bold text-xl tracking-wide">{formatUSD(totalMarket)}</span>
            <p className="text-xs text-muted-foreground">({formatIDR(usdToIdr(totalMarket))})</p>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <p className={`text-sm ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>Unrealized PNL <span className="font-semibold">{totalPnL >= 0 ? '+' : ''}{formatUSD(Math.abs(totalPnL))}</span></p>
            <p className="text-xs text-muted-foreground">({formatIDR(usdToIdr(Math.abs(totalPnL)))})</p>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Prices refreshed on load and after changes. FX rate (IDR per USD): <span className="text-blue-500 font-medium">{idrPerUsd > 0 ? formatIDR(idrPerUsd) : 'loading...'}</span></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground">No assets yet. Click <span className="text-blue-500 font-medium cursor-pointer" onClick={openAdd}>Add Asset</span> to begin.</p>
          )}
          {entries.length > 0 && (
            <div className="divide-y border rounded-md overflow-hidden">
              {entries.map((e, idx) => (
                <div key={idx} className="flex items-start sm:items-center gap-3 sm:gap-4 p-3 hover:bg-accent/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate font-medium text-sm sm:text-base">{e.symbol} <span className="text-muted-foreground text-xs">{e.name}</span></div>
                      <DropdownMenu>
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
                          <DropdownMenuItem onClick={() => removeEntry(idx)} className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                      <span>{e.amount} {e.unit} @ {formatUSD(toUSD(e.symbol, e.avgPrice))} {priceMap[e.symbol] != null && `· Live ${formatUSD(toUSD(e.symbol, priceMap[e.symbol]))}`}</span>
                      <span className="text-[10px]">({formatIDR(usdToIdr(toUSD(e.symbol, e.avgPrice) * getEffectiveAmount(e.amount, e.unit)))})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="fixed max-w-none m-0 h-screen rounded-none p-0 flex flex-col">
          <div className="flex items-center gap-2 p-4 border-b">
            <DialogTitle className="text-lg">{editingIndex != null ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </div>
          
          <div className="flex-1 overflow-auto">
            <div className="p-4">
              <DialogDescription className="mb-4">Record your position details. Prices in your account&apos;s currency.</DialogDescription>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="symbolSearch">Symbol</Label>
              <input
                id="symbolSearch"
                value={symbolQuery}
                onChange={(e) => { setSymbolQuery(e.target.value); setForm(f => ({ ...f, symbol: e.target.value })); }}
                placeholder="Search ticker (e.g. AAPL)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {loadingSearch && <p className="text-xs text-muted-foreground">Searching...</p>}
              {!loadingSearch && symbolResults.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border border-border bg-background shadow-sm p-1 flex flex-col gap-1">
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
              <div className="flex flex-col gap-1">
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
              <div className="flex flex-col gap-1">
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

            <div className="flex flex-col gap-1">
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
            </div>

                <div className="flex justify-end gap-2">
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
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40"
        onClick={openAdd}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
