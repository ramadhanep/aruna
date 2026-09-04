"use client";

import { useState, useEffect } from 'react';
import { fetchEncodedJson } from '@/lib/api-client';
import { toast } from 'sonner';

export function useChartNews(symbol, infoTab) {
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (infoTab !== 'news' || !symbol) {
      return;
    }
    let cancelled = false;

    (async () => {
      setNewsLoading(true);
      try {
        const { response, data } = await fetchEncodedJson(
          `/api/news?symbol=${encodeURIComponent(symbol)}`
        );
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load news');
        }
        if (!cancelled) {
          setNews(data.news);
        }
      } catch (error) {
        console.warn('Failed to fetch news', error);
        toast.error('Failed to load news');
        if (!cancelled) {
          setNews(null);
        }
      } finally {
        if (!cancelled) {
          setNewsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, infoTab]);

  return { news, newsLoading };
}