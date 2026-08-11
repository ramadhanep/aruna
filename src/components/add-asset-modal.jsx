"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Command, CommandItem, CommandList } from '@/components/ui/command';
import { searchSymbols, fetchLatestQuote } from '@/lib/api-client';
import { formatTickerDisplay } from '@/lib/utils';
import { toast } from 'sonner';

export function AddAssetModal({ open, onOpenChange, initialSymbol = '', onSave }) {
  const [symbolQuery, setSymbolQuery] = useState(initialSymbol);
  const [symbolResults, setSymbolResults] = useState([]);
  const [form, setForm] = useState({ symbol: initialSymbol, name: '', amount: '', unit: 'share', avgPrice: '' });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const justSelectedRef = React.useRef(false);
  const hasInitialized = React.useRef(false);

  const handleOpenChange = useCallback((nextOpen) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      hasInitialized.current = false;
      setForm({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '' });
      setSymbolQuery('');
      setSymbolResults([]);
    }
  }, [onOpenChange]);

  // Auto-fetch price when modal opens with initialSymbol
  useEffect(() => {
    if (open && initialSymbol && !hasInitialized.current) {
      hasInitialized.current = true;
      queueMicrotask(() => setLoadingPrice(true));
      (async () => {
        try {
          // Fetch name from Yahoo Finance
          const info = await fetchLatestQuote(initialSymbol);
          if (info) {
            const name = info.name || initialSymbol;
            const price = info.price;
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
    const quote = await fetchLatestQuote(symbol);
    const latest = quote?.price ?? null;
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
      const quote = await fetchLatestQuote(form.symbol);
      if (quote?.price != null) avgPriceNum = quote.price;
    }
    if (avgPriceNum == null || isNaN(avgPriceNum)) {
      toast.error('Could not determine average price for this symbol. Please enter it manually.');
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent variant="fullscreen" closeButtonPosition="right">
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
              <div className="relative flex flex-col gap-1">
                <Label htmlFor="symbolSearch">Symbol</Label>
                <Input
                  id="symbolSearch"
                  value={symbolQuery}
                  onChange={(e) => { setSymbolQuery(e.target.value); setForm(f => ({ ...f, symbol: e.target.value })); }}
                  placeholder="Search ticker (e.g. AAPL)"
                  disabled={loadingPrice}
                />
                {loadingSearch && <p className="text-xs text-muted-foreground">Searching...</p>}
                {!loadingSearch && symbolResults.length > 0 && (
                  <Command
                    shouldFilter={false}
                    className="absolute top-full left-0 right-0 z-20 mt-1 max-h-40 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
                  >
                    <CommandList className="max-h-none">
                      {symbolResults.map(r => (
                        <CommandItem
                          key={r.symbol}
                          value={r.symbol}
                          onSelect={() => handleSelectSymbol(r)}
                          className="cursor-pointer"
                        >
                          <span className="font-medium">{formatTickerDisplay(r.symbol)}</span>{" "}
                          <span className="text-muted-foreground">{r.name}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    value={form.amount}
                    onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    type="number"
                    step="any"
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
                <Input
                  id="avgPrice"
                  value={form.avgPrice}
                  onChange={(e) => setForm(f => ({ ...f, avgPrice: e.target.value }))}
                  placeholder="0"
                  type="number"
                  step="any"
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
