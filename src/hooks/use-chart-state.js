"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { normalizeInfoTabParam, infoTabToQueryValue, getDefaultCyclesForSymbol } from '@/lib/chart-helpers';

export function useChartState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParamsString = searchParams.toString();

  const symbolParam = searchParams.get('symbol');
  const cycleParam = searchParams.get('cycle');
  const tabParam = searchParams.get('tab');
  const requestedInfoTab = normalizeInfoTabParam(tabParam);

  const LAST_SYMBOL_KEY = 'aruna_last_election_symbol';
  const getInitialSymbol = () => {
    if (symbolParam) return symbolParam;
    if (typeof window !== 'undefined') {
      const last = localStorage.getItem(LAST_SYMBOL_KEY);
      if (last) return last;
    }
    return 'MSFT';
  };
  const initialSymbol = getInitialSymbol();

  const [symbol, setSymbol] = useState(initialSymbol);
  const [selectedCycles, setSelectedCycles] = useState(() => {
    if (cycleParam) {
      const parsed = cycleParam.split(',').map((item) => item.trim()).filter(Boolean);
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return getDefaultCyclesForSymbol(initialSymbol);
  });
  const [infoTab, setInfoTab] = useState(() => requestedInfoTab || 'keystats');
  const infoTabRef = useRef(infoTab);
  const isNormalView = selectedCycles.length === 1 && selectedCycles[0] === 'normal';

  useEffect(() => {
    infoTabRef.current = infoTab;
  }, [infoTab]);

  useEffect(() => {
    queueMicrotask(() => {
      if (symbolParam && symbolParam !== symbol) {
        setSymbol(symbolParam);
        if (cycleParam) {
          const parsed = cycleParam.split(',').map((item) => item.trim()).filter(Boolean);
          if (parsed.length > 0) {
            setSelectedCycles(parsed);
          } else {
            setSelectedCycles(getDefaultCyclesForSymbol(symbolParam));
          }
        } else {
          setSelectedCycles(getDefaultCyclesForSymbol(symbolParam));
        }
      } else if (cycleParam) {
        const parsed = cycleParam.split(',').map((item) => item.trim()).filter(Boolean);
        if (parsed.length > 0) {
          setSelectedCycles(parsed);
        }
      }
    });
  }, [symbolParam, symbol, cycleParam]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    const params = new URLSearchParams(searchParamsString);
    let dirty = false;

    const normalizedCycles = selectedCycles.join(',');
    const currentCycle = params.get('cycle') ?? '';
    if (normalizedCycles) {
      if (currentCycle !== normalizedCycles) {
        params.set('cycle', normalizedCycles);
        dirty = true;
      }
    } else if (currentCycle) {
      params.delete('cycle');
      dirty = true;
    }

    const tabQueryValue = infoTabToQueryValue(infoTab);
    const currentTab = params.get('tab') ?? '';
    if (tabQueryValue) {
      if (currentTab !== tabQueryValue) {
        params.set('tab', tabQueryValue);
        dirty = true;
      }
    } else if (currentTab) {
      params.delete('tab');
      dirty = true;
    }

    if (!dirty) return;
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [selectedCycles, infoTab, searchParamsString, pathname, router]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_SYMBOL_KEY, symbol);
    } catch { }
  }, [symbol]);

  return {
    symbol,
    setSymbol,
    selectedCycles,
    setSelectedCycles,
    infoTab,
    setInfoTab,
    infoTabRef,
    requestedInfoTab,
    isNormalView,
    searchParams,
    pathname,
    router,
    searchParamsString,
  };
}
