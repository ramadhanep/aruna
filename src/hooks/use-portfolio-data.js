import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth-provider';
import { loadPortfolio } from '@/lib/portfolio-storage';
import { fetchEncodedJson, fetchLatestQuote, fetchBatchQuotes } from '@/lib/api-client';

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

export { getDefaultPortfolio };

export function usePortfolioData() {
  const {
    user,
    loading: authLoading,
    remotePortfolio,
    portfolioLoaded,
    syncPortfolio,
  } = useAuth();

  const [entries, setEntries] = useState([]);
  const [priceMap, setPriceMap] = useState({});
  const [logoMap, setLogoMap] = useState({});
  const [fxRate, setFxRate] = useState(0);
  const [idrPerUsd, setIdrPerUsd] = useState(0);
  const [sgdPerUsd, setSgdPerUsd] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [portfolioMiniSeries, setPortfolioMiniSeries] = useState([]);
  const [portfolioMiniLoading, setPortfolioMiniLoading] = useState(false);

  const isAuthenticated = Boolean(user);
  const hydratePortfolioRef = useRef(true);
  const remotePortfolioSeedRef = useRef(false);
  const guestSyncedRef = useRef(false);

  const refreshFxRates = useCallback(async () => {
    const [idr, sgd] = await Promise.all([
      fetchLatestQuote('IDR=X'),
      fetchLatestQuote('SGD=X'),
    ]);
    if (idr?.price) {
      setIdrPerUsd(idr.price);
      setFxRate(1 / idr.price);
    }
    if (sgd?.price) setSgdPerUsd(sgd.price);
  }, []);

  // ponytail: one batched /api/quotes round-trip instead of N per-symbol
  // /api/finance calls (the N+1 that choked the portfolio tracker on large
  // watchlists). Quotes are keyed by uppercased symbol by the server.
  const refreshPrices = useCallback(async (list) => {
    const uniqueSymbols = [...new Set(list.map(e => e.symbol))];
    const quotesMap = await fetchBatchQuotes(uniqueSymbols);
    const updates = {};
    const logos = {};
    for (const sym of uniqueSymbols) {
      const quote = quotesMap[sym.toUpperCase()];
      if (!quote) continue;
      if (quote.price != null) updates[sym] = quote.price;
      if (quote.logo) logos[sym] = quote.logo;
    }
    if (Object.keys(updates).length) setPriceMap(pm => ({ ...pm, ...updates }));
    if (Object.keys(logos).length) setLogoMap(prev => ({ ...prev, ...logos }));
  }, []);

  // Guest loading
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) return;

    queueMicrotask(() => {
      const data = loadPortfolio();
      if (data !== null) {
        hydratePortfolioRef.current = true;
        setEntries(data.entries);
      } else {
        const defaults = getDefaultPortfolio();
        hydratePortfolioRef.current = true;
        setEntries(defaults);
      }
      setInitialLoading(false);
    });
  }, [authLoading, isAuthenticated]);

  // Remote portfolio loading
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    queueMicrotask(() => {
      if (!portfolioLoaded) return;

      if (Array.isArray(remotePortfolio)) {
        hydratePortfolioRef.current = true;
        setEntries(remotePortfolio);
        setInitialLoading(false);
        return;
      }

      if (!remotePortfolioSeedRef.current) {
        remotePortfolioSeedRef.current = true;
        const data = loadPortfolio();
        const guestEntries = data?.entries ?? [];
        const initialEntries = guestEntries.length > 0 ? guestEntries : getDefaultPortfolio();
        hydratePortfolioRef.current = true;
        setEntries(initialEntries);
        setInitialLoading(false);
        syncPortfolio(initialEntries)
          .catch(() => null)
          .finally(() => { remotePortfolioSeedRef.current = false; });
      }
    });
  }, [authLoading, isAuthenticated, portfolioLoaded, remotePortfolio, syncPortfolio]);

  // Sign-in guest import
  useEffect(() => {
    if (!isAuthenticated || !portfolioLoaded || guestSyncedRef.current) return;
    if (Array.isArray(remotePortfolio) && remotePortfolio.length === 0) {
      const data = loadPortfolio();
      const guestEntries = data?.entries ?? [];
      if (guestEntries.length > 0) {
        guestSyncedRef.current = true;
        syncPortfolio(guestEntries).catch(() => null);
      }
    }
  }, [isAuthenticated, portfolioLoaded, remotePortfolio, syncPortfolio]);

  // FX rate fetch on mount
  useEffect(() => {
    (async () => {
      try { await refreshFxRates(); }
      catch (e) { console.warn('FX rate fetch failed', e); }
    })();
  }, [refreshFxRates]);

  // Price refresh when entries change
  useEffect(() => {
    const digitalEntries = entries.filter((e) => e.type !== 'cash');
    if (digitalEntries.length === 0) return;
    let cancelled = false;
    (async () => {
      try { await refreshPrices(digitalEntries); }
      finally { if (!cancelled) setInitialLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entries, refreshPrices]);

  // Mark data ready after initial load completes
  useEffect(() => {
    if (!initialLoading) queueMicrotask(() => setDataReady(true));
  }, [initialLoading]);

  // Portfolio mini-series
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
          if (rows.length > 0) lastKnownPriceBySymbol[symbol] = rows[0].price;
        });

        const values = orderedDates.map((dateKey) => {
          let dailyValue = cashTotalUSD;
          digital.forEach((entry) => {
            const dateMap = mapByDateBySymbol[entry.symbol];
            if (!dateMap) return;
            const nextPrice = dateMap.get(dateKey);
            if (typeof nextPrice === 'number') lastKnownPriceBySymbol[entry.symbol] = nextPrice;
            const activePrice = lastKnownPriceBySymbol[entry.symbol];
            if (typeof activePrice !== 'number') return;
            const priceInUSD = entry.symbol.endsWith('.JK') && fxRate > 0 ? activePrice * fxRate : activePrice;
            const effectiveAmount = entry.unit === 'lot' ? entry.amount * 100 : entry.amount;
            dailyValue += priceInUSD * effectiveAmount;
          });
          return dailyValue;
        });

        if (!cancelled) setPortfolioMiniSeries(values.slice(-30));
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to build portfolio mini chart series', error);
          setPortfolioMiniSeries([]);
        }
      } finally {
        if (!cancelled) setPortfolioMiniLoading(false);
      }
    };

    buildMiniSeries();
    return () => { cancelled = true; };
  }, [entries, fxRate]);

  return {
    entries, setEntries,
    priceMap, setPriceMap,
    logoMap, setLogoMap,
    fxRate, idrPerUsd, sgdPerUsd,
    initialLoading, isRefreshing, setIsRefreshing, dataReady,
    portfolioMiniSeries, portfolioMiniLoading,
    refreshPrices, refreshFxRates,
  };
}
