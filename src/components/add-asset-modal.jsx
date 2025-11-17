"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchEncodedJson } from '@/lib/api-client';

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

async function fetchPrice(symbol) {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 60 * 60 * 24 * 5;
    const { response, data } = await fetchEncodedJson(
      `/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
    );
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to fetch price');
    }
    const series = data.data || [];
    if (series.length === 0) return null;
    const last = series[series.length - 1];
    return last.adjclose ?? null;
  } catch (e) {
    return null;
  }
}

export function AddAssetModal({ open, onOpenChange, initialSymbol = '', onSave }) {
  const [symbolQuery, setSymbolQuery] = useState(initialSymbol);
  const [symbolResults, setSymbolResults] = useState([]);
  const [form, setForm] = useState({ symbol: initialSymbol, name: '', amount: '', unit: 'share', avgPrice: '' });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const justSelectedRef = React.useRef(false);
  const hasInitialized = React.useRef(false);

  // Auto-fetch price when modal opens with initialSymbol
  useEffect(() => {
    if (open && initialSymbol && !hasInitialized.current) {
      hasInitialized.current = true;
      (async () => {
        setLoadingPrice(true);
        try {
          // Fetch name from Yahoo Finance
          const endDate = Math.floor(Date.now() / 1000);
          const startDate = endDate - 60 * 60 * 24 * 5;
          const { response, data } = await fetchEncodedJson(
            `/api/finance?symbol=${initialSymbol}&startDate=${startDate}&endDate=${endDate}`
          );
          if (response.ok) {
            const name = data.meta?.name || initialSymbol;
            const series = data.data || [];
            const price = series.length > 0 ? series[series.length - 1].adjclose : null;
            const isJk = initialSymbol.endsWith('.JK');
            
            setForm({
              symbol: initialSymbol,
              name: name,
              amount: '',
              unit: isJk ? 'lot' : 'share',
              avgPrice: price != null ? String(price) : ''
            });
            setSymbolQuery(initialSymbol);
          }
        } catch (e) {
          console.warn('Failed to fetch initial symbol data', e);
        } finally {
          setLoadingPrice(false);
        }
      })();
    }
    
    // Reset when modal closes
    if (!open) {
      hasInitialized.current = false;
      setForm({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '' });
      setSymbolQuery('');
      setSymbolResults([]);
    }
  }, [open, initialSymbol]);

  // Search debounce
  useEffect(() => {
    const handle = setTimeout(async () => {
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

  async function handleSelectSymbol(result) {
    const symbol = result.symbol;
    const name = result.name || '';
    const isJk = symbol.endsWith('.JK');
    let latest = null;
    try {
      latest = await fetchPrice(symbol);
    } catch (e) {
      // ignore
    }
    setForm(f => ({ ...f, symbol, name, unit: isJk ? 'lot' : f.unit, avgPrice: latest != null ? String(latest) : f.avgPrice }));
    justSelectedRef.current = true;
    setSymbolQuery(symbol);
    setSymbolResults([]);
  }

  const effectiveUnit = useMemo(() => {
    if (form.symbol.endsWith('.JK')) return 'lot';
    return form.unit;
  }, [form.symbol, form.unit]);
  const unitLocked = form.symbol.endsWith('.JK');

  async function handleSubmit(e) {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!form.symbol || isNaN(amountNum)) return;

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
    
    if (onSave) {
      onSave(entry);
    }
    
    // Reset form
    setForm({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '' });
    setSymbolQuery('');
    setSymbolResults([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed max-w-none m-0 h-screen rounded-none p-0 flex flex-col" closeButtonPosition="right">
        <div className="flex items-center gap-2 p-4 border-b">
          <DialogTitle className="text-base">Add Asset</DialogTitle>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <DialogDescription className="mb-4 text-xs">Record your position details. Prices in your account&apos;s currency.</DialogDescription>
            {loadingPrice && (
              <div className="flex items-center justify-center py-4">
                <p className="text-sm text-muted-foreground">Loading symbol data...</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="symbolSearch">Symbol</Label>
                <input
                  id="symbolSearch"
                  value={symbolQuery}
                  onChange={(e) => { setSymbolQuery(e.target.value); setForm(f => ({ ...f, symbol: e.target.value })); }}
                  placeholder="Search ticker (e.g. AAPL)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loadingPrice}
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
                <Button type="submit">Add</Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
