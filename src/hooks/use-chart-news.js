"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchEncodedJson } from '@/lib/api-client';

export function useChartNews(symbol, infoTab) {
  const [news, setNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const newsCacheRef = useRef({});

  useEffect(() => {
    if (!symbol) {
      return;
    }

    const needsNews = infoTab === 'news';
    if (!needsNews) {
      return;
    }

    if (newsCacheRef.current[symbol]) {
      setNews(newsCacheRef.current[symbol]);
      setNewsLoading(false);
      return;
    }

    let cancelled = false;
    setNews(null);
    setNewsLoading(true);

    (async () => {
      try {
        const { response, data } = await fetchEncodedJson(
          `/api/news?symbol=${encodeURIComponent(symbol)}`
        );
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load news');
        }
        if (!cancelled) {
          setNews(data.news);
          newsCacheRef.current[symbol] = data.news;
        }
      } catch (error) {
        console.warn('Failed to fetch news', error);
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

  useEffect(() => {
    if (!news) return;
    // Optional: could auto-switch to quarterly if needed
  }, [news]);

  return { news, newsLoading };
}