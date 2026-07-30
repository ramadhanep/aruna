"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchEncodedJson } from '@/lib/api-client';

export function useChartFundamentals(symbol, infoTab) {
  const [fundamentals, setFundamentals] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState('quarterly');
  const fundamentalsCacheRef = useRef({});

  useEffect(() => {
    if (!symbol) {
      return;
    }

    const needsFundamentals = ['keystats', 'analysis', 'profile', 'financials'].includes(infoTab);
    if (!needsFundamentals) {
      return;
    }

    if (fundamentalsCacheRef.current[symbol]) {
      setFundamentals(fundamentalsCacheRef.current[symbol]);
      setFundamentalsLoading(false);
      return;
    }

    let cancelled = false;
    setFundamentals(null);
    setFundamentalsLoading(true);
    setRevenuePeriod('quarterly');

    (async () => {
      try {
        const { response, data } = await fetchEncodedJson(
          `/api/fundamentals?symbol=${encodeURIComponent(symbol)}`
        );
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load fundamentals');
        }
        if (!cancelled) {
          setFundamentals(data);
          fundamentalsCacheRef.current[symbol] = data;
        }
      } catch (error) {
        console.warn('Failed to fetch fundamentals', error);
        if (!cancelled) {
          setFundamentals(null);
        }
      } finally {
        if (!cancelled) {
          setFundamentalsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, infoTab]);

  useEffect(() => {
    if (!fundamentals) return;
    const annual = fundamentals.analysis?.revenue?.annual;
    if (revenuePeriod === 'annual' && (!annual || annual.length === 0)) {
      queueMicrotask(() => setRevenuePeriod('quarterly'));
    }
  }, [fundamentals, revenuePeriod]);

  return { fundamentals, fundamentalsLoading, revenuePeriod, setRevenuePeriod };
}
