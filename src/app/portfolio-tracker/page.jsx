"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from "next-intl";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Command, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, MoreVertical, Pencil, Trash2, Loader2, CreditCard, TrendingUp, ArrowUpDown, Check, Eye, EyeClosed, LogIn } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth-provider';
import { searchSymbols, fetchLatestQuote } from '@/lib/api-client';
import { TickerAvatar } from '@/components/ticker-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTickerDisplay, formatIDR, formatByCurrency, getChangeTone } from '@/lib/utils';
import { MOTION, DURATION_CLASS } from '@/lib/motion';
import { loadPortfolio, savePortfolio } from '@/lib/portfolio-storage';
import { computeHoldingsMetrics, sortHoldings, computePortfolioSummary, computeDigitalAllocation, computeCashTypeAllocation, formatValue } from '@/lib/portfolio-metrics';
import { usePortfolioData, getDefaultPortfolio } from '@/hooks/use-portfolio-data';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { PortfolioMiniChart } from '@/components/portfolio-mini-chart';
import { toast } from 'sonner';

// Dynamic chart component to keep page light and avoid SSR issues
const PortfolioPie = dynamic(() => import('./pie').then(m => m.PortfolioPie), { ssr: false });

const CURRENCY_SELECT_WIDTH = 'w-[132px]';

function AddAssetForm({
  editingIndex,
  assetType,
  setAssetType,
  symbolQuery,
  setSymbolQuery,
  setForm,
  loadingSearch,
  symbolResults,
  handleSelectSymbol,
  form,
  effectiveUnit,
  unitLocked,
  handleSubmit,
}) {
  const t = useTranslations("addAssetModal");
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Asset Type Selection */}
      <div className="flex flex-col gap-2">
        <Label>{t("assetType")}</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={assetType === 'digital' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssetType('digital')}
            className="flex-1"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {t("digitalAssets")}
          </Button>
          <Button
            type="button"
            variant={assetType === 'cash' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssetType('cash')}
            className="flex-1"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {t("cash")}
          </Button>
        </div>
      </div>

      {assetType === 'digital' ? (
        <>
          {/* Digital Asset Fields */}
          <div className="relative flex flex-col gap-2">
            <Label htmlFor="symbolSearch">{t("symbol")}</Label>
            <Input
              id="symbolSearch"
              value={symbolQuery}
              disabled={editingIndex != null}
              onChange={(e) => { setSymbolQuery(e.target.value); setForm(f => ({ ...f, symbol: e.target.value })); }}
              placeholder={t("searchTicker", { examples: "AAPL, BBCA.JK" })}
            />
            {loadingSearch && <p className="text-xs text-muted-foreground">{t("searching")}</p>}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">{t("amount")}</Label>
              <Input
                id="amount"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                type="number"
                step="any"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="unit">{t("unit")}</Label>
              <Select
                value={effectiveUnit}
                onValueChange={(value) => setForm(f => ({ ...f, unit: value }))}
                disabled={unitLocked}
              >
                <SelectTrigger id="unit" className="w-full h-9 px-3 text-sm">
                  <SelectValue placeholder={t("selectUnit")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="share">{t("share")}</SelectItem>
                  <SelectItem value="lot">{t("lot")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="avgPrice">{t("averagePrice")}</Label>
            <Input
              id="avgPrice"
              value={form.avgPrice}
              onChange={(e) => setForm(f => ({ ...f, avgPrice: e.target.value }))}
              placeholder="0"
              type="number"
              step="any"
            />
            <p className="text-xs text-muted-foreground">{t("pricePerUnit", { unit: effectiveUnit === 'lot' ? t("lot") : t("share") })}</p>
          </div>
        </>
      ) : (
        <>
          {/* Cash Asset Fields */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">{t("category")}</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder={t("categoryPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cashAmount">{t("amount")}</Label>
              <Input
                id="cashAmount"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                type="number"
                step="any"
              />
              <p className="text-xs text-muted-foreground">{t("totalCashNote")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cashCurrency">{t("currency")}</Label>
              <Select
                value={form.cashCurrency}
                onValueChange={(value) => setForm(f => ({ ...f, cashCurrency: value }))}
              >
                <SelectTrigger id="cashCurrency" className="w-full h-9 px-3 text-sm">
                  <SelectValue placeholder={t("selectCurrency")} />
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
          <Button type="button" variant="ghost">{t("cancel")}</Button>
        </DialogClose>
        <Button type="submit">{editingIndex != null ? t("save") : t("add")}</Button>
      </div>
    </form>
  );
}

export default function PortfolioTrackerPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("portfolio");
  const tModal = useTranslations("addAssetModal");
  const {
    user,
    loading: authLoading,
    syncPortfolio,
    supabaseConfigured,
  } = useAuth();
  const isAuthenticated = Boolean(user);
  const [holdingsSort, setHoldingsSort] = useState('alpha');
  const [currency, setCurrency] = useState(() => { const d = loadPortfolio(); return d?.currency ?? 'IDR'; });
  const [isPortfolioHidden, setIsPortfolioHidden] = useState(() => { const d = loadPortfolio(); return d?.visibilityHidden ?? false; });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolResults, setSymbolResults] = useState([]);
  const [assetType, setAssetType] = useState('digital');
  const [form, setForm] = useState({ symbol: '', name: '', amount: '', unit: 'share', avgPrice: '', type: 'digital', category: '', cashCurrency: 'IDR' });
  const justSelectedRef = React.useRef(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const containerRef = React.useRef(null);

  const {
    entries, setEntries,
    priceMap, setPriceMap,
    logoMap, setLogoMap,
    fxRate, idrPerUsd, sgdPerUsd,
    initialLoading, isRefreshing, setIsRefreshing, dataReady,
    portfolioMiniSeries, portfolioMiniLoading,
    refreshPrices, refreshFxRates,
  } = usePortfolioData();

  const handleGoToSignIn = () => {
    router.push(`/signin?redirect=${encodeURIComponent('/portfolio-tracker')}`);
  };

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    const digitalEntries = entries.filter(e => e.type !== 'cash');
    if (digitalEntries.length === 0) return;

    setIsRefreshing(true);
    try {
      await refreshFxRates();
      await refreshPrices(digitalEntries);
    } catch (e) {
      console.warn('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, entries, refreshFxRates, refreshPrices, setIsRefreshing]);

  const { pullDistance, handleTouchStart, handleTouchMove, handleTouchEnd } = usePullToRefresh({
    onRefresh: handleRefresh,
    isRefreshing,
    enabled: isMobile,
    containerRef,
  });

  // Persist entries on user-initiated change
  useEffect(() => {
    if (!dataReady) return;
    savePortfolio({ entries, currency, visibilityHidden: isPortfolioHidden });
    if (isAuthenticated) {
      syncPortfolio(entries).catch(() => {});
    }
  }, [entries, isAuthenticated, syncPortfolio, dataReady, currency, isPortfolioHidden]);

  // Search debounce
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (editingIndex != null) return;
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
  }, [symbolQuery, editingIndex]);

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
    const latestResult = await fetchLatestQuote(symbol);
    if (latestResult?.price != null) {
      setPriceMap((pm) => ({ ...pm, [symbol]: latestResult.price }));
    }
    if (latestResult?.logo) {
      setLogoMap((prev) => ({ ...prev, [symbol]: latestResult.logo }));
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
        toast.error(tModal("categoryRequired"));
        return;
      }

      const nativeAmount = amountNum;
      if (nativeAmount <= 0 || isNaN(nativeAmount)) {
        toast.error(tModal("cashAmountRequired"));
        return;
      }

      // Convert to USD for storage
      let totalUSD = nativeAmount;
      if (form.cashCurrency === 'IDR') {
        if (fxRate <= 0) {
          toast.error(tModal("idrFxError"));
          return;
        }
        totalUSD = nativeAmount * fxRate; // IDR * (USD per IDR) = USD
      } else if (form.cashCurrency === 'SGD') {
        if (sgdPerUsd <= 0) {
          toast.error(tModal("sgdFxError"));
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
        toast.error(tModal("selectSymbolError"));
        return;
      }

      // Ensure avgPrice is set; if not, attempt to fetch latest price
      let avgPriceNum = parseFloat(form.avgPrice);
      if (isNaN(avgPriceNum) || avgPriceNum <= 0) {
        avgPriceNum = null;
        const result = await fetchLatestQuote(form.symbol);
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
      }
      if (avgPriceNum == null || isNaN(avgPriceNum)) {
        toast.error(tModal("avgPriceError"));
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

  const holdingsWithMetrics = useMemo(() => {
    return computeHoldingsMetrics(entries, priceMap, fxRate, sgdPerUsd);
  }, [entries, priceMap, fxRate, sgdPerUsd]);

  const sortedHoldings = useMemo(() => {
    return sortHoldings(holdingsWithMetrics, holdingsSort);
  }, [holdingsWithMetrics, holdingsSort]);

  const { digitalMarket, digitalPnL, totalCash, totalNetWorth, totalPnL } = useMemo(() => {
    return computePortfolioSummary(entries, priceMap, fxRate);
  }, [entries, priceMap, fxRate]);

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
    return computeDigitalAllocation(holdingsWithMetrics, logoMap);
  }, [holdingsWithMetrics, logoMap]);

  const cashTypeAllocation = useMemo(() => {
    return computeCashTypeAllocation(holdingsWithMetrics);
  }, [holdingsWithMetrics]);

  const hiddenPrimaryToken = '••••••';
  const hiddenSecondaryToken = t("hidden");
  const getDisplayValue = (usdAmount) =>
  (isPortfolioHidden
    ? { primary: hiddenPrimaryToken, secondary: hiddenSecondaryToken, tertiary: hiddenSecondaryToken }
    : formatValue(usdAmount, currency, idrPerUsd, sgdPerUsd));
  const getPnLColor = (value) => (isPortfolioHidden ? 'text-muted-foreground' : getChangeTone(value));
  const totalNetWorthDisplay = getDisplayValue(totalNetWorth);
  const totalPnLDisplay = getDisplayValue(totalPnL);
  const digitalMarketDisplay = getDisplayValue(digitalMarket);
  const digitalPnLDisplay = getDisplayValue(digitalPnL);
  const totalCashDisplay = getDisplayValue(totalCash);
  const idrFxDisplay = idrPerUsd > 0 ? formatIDR(idrPerUsd) : t("loading");

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }


  if (initialLoading) {
    return (
      <div className={`skeleton-stagger flex flex-col gap-4 ${isMobile ? 'pb-28' : ''}`}>
        <Card className={isMobile ? 'rounded-3xl' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className={`h-8 ${CURRENCY_SELECT_WIDTH} rounded-md`} />
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

        <Card className={`h-full ${isMobile ? 'rounded-3xl' : ''}`}>
          <CardHeader className="flex items-center justify-between">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className={`space-y-2 ${isMobile ? 'mb-20' : 'mb-4'}`}>
              {[...Array(isMobile ? 4 : 5)].map((_, idx) => (
                <div
                  key={`holding-${idx}`}
                  className={`flex items-center gap-3 p-2 rounded-xl min-h-16 border ${isMobile ? 'bg-background/80 border-border/40' : 'border-border/20'}`}
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
      className={`flex flex-col gap-4 ${MOTION.fadeIn} ${isMobile ? 'pb-28' : 'lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start'}`}
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

      <div className={`${isMobile ? '' : 'lg:col-span-4'} flex flex-col gap-4`}>
        <Card className={isMobile ? 'rounded-3xl' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
            <CardTitle className="font-semibold text-sm">{t("overview")}</CardTitle>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-muted/40"
                aria-pressed={isPortfolioHidden}
                aria-label={isPortfolioHidden ? t("showPortfolio") : t("hidePortfolio")}
                onClick={() => setIsPortfolioHidden((prev) => !prev)}
              >
                {isPortfolioHidden ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className={`${CURRENCY_SELECT_WIDTH} h-8`}>
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
                <p className="text-sm text-muted-foreground mb-1">{t("totalNetWorth")}</p>
                <p className="text-xl font-bold tracking-tight">{totalNetWorthDisplay.primary}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{totalNetWorthDisplay.secondary}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`text-xs font-medium ${getPnLColor(totalPnL)}`}>
                    {isPortfolioHidden ? hiddenSecondaryToken : `${totalPnL >= 0 ? '+' : ''}${totalPnLDisplay.primary}`}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {isPortfolioHidden ? hiddenSecondaryToken : `(${totalPnLDisplay.secondary})`}
                  </span>
                </div>
              </div>
              <div className="mt-5">
                {portfolioMiniLoading ? (
                  <Skeleton className="w-[92px] h-[44px] rounded-md" />
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

            <div className="flex flex-col gap-2">
              <Accordion type="single" collapsible className="rounded-xl border border-border/20">
                <AccordionItem value="detail" className="border-b-0">
                  <AccordionTrigger className="justify-center py-2.5 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 [&>svg]:hidden">
                    {t("viewDetail")}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1">
                    <div className="flex items-start gap-3 p-3 rounded-xl border">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">{t("digitalAssets")}</p>
                        <p className="text-base font-semibold">{digitalMarketDisplay.primary}</p>
                        <p className="text-xs text-muted-foreground">{digitalMarketDisplay.secondary}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={`text-xs font-medium ${getPnLColor(digitalPnL)}`}>
                            {isPortfolioHidden ? hiddenSecondaryToken : `${digitalPnL >= 0 ? '+' : ''}${digitalPnLDisplay.primary}`}
                          </span>
                          <span className="text-2xs text-muted-foreground">
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
                        <p className="text-sm text-muted-foreground mb-1">{t("totalCash")}</p>
                        <p className="text-base font-semibold">{totalCashDisplay.primary}</p>
                        <p className="text-xs text-muted-foreground">{totalCashDisplay.secondary}</p>
                      </div>
                      <div className="p-2 rounded-full bg-emerald-700/10">
                        <CreditCard className="h-5 w-5 text-emerald-800 dark:text-emerald-500" />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Accordion type="single" collapsible className="rounded-xl border border-border/20">
                <AccordionItem value="allocation" className="border-b-0">
                  <AccordionTrigger className="justify-center py-2.5 text-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 [&>svg]:hidden">
                    {t("viewAllocationChart")}
                  </AccordionTrigger>
                  <AccordionContent>
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </CardContent>
        </Card>

        {/* Guest local-portfolio info banner */}
        {!isAuthenticated && (
          <div className="rounded-2xl border border-border/40 bg-card px-4 py-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground">{t("localPortfolio")}</p>
              <p className="mt-1 text-1xs text-muted-foreground leading-relaxed">
                {t("localPortfolioDesc")}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleGoToSignIn}
              disabled={!supabaseConfigured}
              className="w-full justify-center gap-2 rounded-full bg-foreground text-[12px] font-semibold text-background hover:bg-foreground/90 h-9"
            >
              <LogIn className="h-3.5 w-3.5" />
              {t("signIn")}
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
          <p className="text-2xs text-muted-foreground text-center">
            {t("fxLine", { value: idrFxDisplay })}
          </p>
        </div>
      </div>

      <div className={`${isMobile ? '' : 'lg:col-span-8'}`}>
        <Card className={`h-full ${isMobile ? 'rounded-3xl' : ''}`}>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {t("holdings")}
            </CardTitle>
            {entries.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0"
                    aria-label={t("sortHoldings")}
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
                    {t("aToZ")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setHoldingsSort('market')}
                    className="text-xs flex items-center gap-2"
                  >
                    <Check
                      className={`h-3 w-3 ${holdingsSort === 'market' ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {t("marketValue")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setHoldingsSort('pnl')}
                    className="text-xs flex items-center gap-2"
                  >
                    <Check
                      className={`h-3 w-3 ${holdingsSort === 'pnl' ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {t("pnl")}
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
                  <p className="text-sm font-semibold text-foreground">{t("emptyTitle")}</p>
                  <p className="mt-1.5 text-1xs text-muted-foreground leading-relaxed max-w-xs">
                    {t("emptyDesc")}
                    {!isAuthenticated && t("emptyDescLocal")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button
                    onClick={() => {
                      const defaults = getDefaultPortfolio();
                      setEntries(defaults);
                      if (!isAuthenticated) savePortfolio({ entries: defaults, currency, visibilityHidden: isPortfolioHidden });
                    }}
                    className="rounded-full bg-foreground text-background hover:bg-foreground/90 text-xs h-9"
                  >
                    {t("createStarterPortfolio")}
                  </Button>
                  {!isAuthenticated && supabaseConfigured && (
                    <Button
                      variant="outline"
                      onClick={handleGoToSignIn}
                      className="rounded-full text-xs h-9 gap-2"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      {t("signIn")}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {entries.length > 0 && (
              <div className={`space-y-2 ${isMobile ? 'mb-20' : 'mb-4'}`}>
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
                      className={`flex items-center gap-3 p-2 rounded-2xl min-h-16 transition-colors border ${isMobile ? 'bg-background/80 border-border/40' : 'border-border/20 hover:bg-muted/30'}`}
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
                          <p className="text-2xs text-muted-foreground">{formatted.secondary}</p>
                          {!isCash && livePnl !== 0 && (
                            <p className="text-2xs">
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
                              {t("edit")}
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
                              {t("delete")}
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
        <DialogContent className="fixed max-w-none m-0 h-[86vh] lg:h-auto lg:max-h-[85vh] lg:w-[540px] lg:rounded-3xl lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 rounded-t-3xl p-0 flex flex-col mt-auto" closeButtonPosition="right" onOpenAutoFocus={(event) => { if (editingIndex != null) event.preventDefault(); }}>
          <div className="flex items-center gap-2 p-4 border-b">
            <DialogTitle className="text-base">{editingIndex != null ? tModal("editTitle") : tModal("title")}</DialogTitle>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="p-4">
              <DialogDescription className="mb-4 text-xs">
                {assetType === 'cash' ? tModal("descriptionCash") : tModal("description")}
              </DialogDescription>

              <AddAssetForm
                editingIndex={editingIndex}
                assetType={assetType}
                setAssetType={setAssetType}
                symbolQuery={symbolQuery}
                setSymbolQuery={setSymbolQuery}
                setForm={setForm}
                loadingSearch={loadingSearch}
                symbolResults={symbolResults}
                handleSelectSymbol={handleSelectSymbol}
                form={form}
                effectiveUnit={effectiveUnit}
                unitLocked={unitLocked}
                handleSubmit={handleSubmit}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        size="icon"
        className={`fixed ${isMobile ? 'bottom-24 right-4' : 'bottom-8 right-8'} h-14 w-14 rounded-full bg-emerald-700 z-40`}
        onClick={openAdd}
      >
        <Plus className="size-6 text-white" />
      </Button>
    </div>
  );
}
