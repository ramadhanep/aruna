"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TickerAvatar } from "./ticker-avatar";
import { fetchBatchQuotes } from "@/lib/api-client";
import { formatPriceTrim, formatTickerDisplay, getChangeTone } from "@/lib/utils";
import { isWithinMarketHours } from "@/lib/market-hours";
import { DURATION_CLASS } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "@/components/section-header";

function TrendingItem({ symbol, quote }) {
  if (!quote) return null;

  const isPositive = (quote.change ?? 0) >= 0;
  const color = getChangeTone(quote.change ?? 0);
  const formattedPrice = typeof quote.price === "number" ? formatPriceTrim(quote.price, symbol) : "-";
  const formattedChange = typeof quote.changePercent === "number"
    ? `${isPositive ? "+" : ""}${quote.changePercent.toFixed(2)}%`
    : "-";

  return (
    <Link
      href={`/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal`}
      prefetch={false}
      className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-accent/40 transition-all ${DURATION_CLASS.base} rounded-xl`}
    >
      <TickerAvatar symbol={symbol} logo={quote.logo} size="sm" />
      <div className="flex flex-col">
        <div className="font-semibold text-sm tracking-tight">{formatTickerDisplay(symbol)}</div>
        <div className="text-xs font-medium">
          {formattedPrice} <span className={`text-2xs font-semibold ${color}`}>{formattedChange}</span>
        </div>
      </div>
    </Link>
  );
}

function getTrendingOrder() {
  const isUsOpen = isWithinMarketHours("America/New_York", 9, 30, 16, 0);
  const isIdxOpen = isWithinMarketHours("Asia/Jakarta", 9, 0, 15, 15);

  if (isUsOpen && !isIdxOpen) {
    return ["us", "idx", "crypto"];
  }
  if (isIdxOpen && !isUsOpen) {
    return ["idx", "us", "crypto"];
  }
  if (isUsOpen && isIdxOpen) {
    return ["us", "idx", "crypto"];
  }
  return ["idx", "us", "crypto"];
}

export function TrendingMarquee({ supabase }) {
  const t = useTranslations();
  const [trendingStocks, setTrendingStocks] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    async function loadTrending() {
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from("trending_stocks")
          .select("*")
          .order("category", { ascending: true })
          .order("order", { ascending: true });

        if (error) {
          console.error("Failed to load trending stocks:", error);
          return;
        }

        if (data && data.length > 0) {
          // Order by market hours
          const order = getTrendingOrder();
          const ordered = [];
          order.forEach((cat) => {
            const items = data.filter((item) => item.category === cat);
            ordered.push(...items);
          });

          setTrendingStocks(ordered);

          // Fetch quotes for all trending symbols in a single batch call
          const symbols = ordered.map((item) => item.symbol);

          try {
            const batchQuotes = await fetchBatchQuotes(symbols);

            if (batchQuotes && Object.keys(batchQuotes).length) {
              const quotesMap = {};
              // Map batch response (keyed by uppercase symbol) to original symbols
              ordered.forEach((item) => {
                const upperSymbol = item.symbol.toUpperCase();
                if (batchQuotes[upperSymbol]) {
                  quotesMap[item.symbol] = batchQuotes[upperSymbol];
                }
              });
              setQuotes(quotesMap);
            }
          } catch (error) {
            console.warn('Failed to fetch batch quotes for trending', error);
          }
        }
      } catch (error) {
        console.error("Error loading trending stocks:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTrending();
  }, [supabase]);

  // Handle scroll events to pause/resume marquee
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Pause marquee when user is scrolling
      setIsPaused(true);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Resume marquee after user stops scrolling for 1.5 seconds
      scrollTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
      }, 1500);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="overflow-hidden">
        <SectionHeader title={t("trendingMarquee.title")} />
        <div className="flex overflow-hidden border-y border-border bg-card py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 shrink-0">
              <Skeleton className="w-6 h-6 rounded-2xl shrink-0" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-14 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (trendingStocks.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden">
      <SectionHeader title={t("trendingMarquee.title")} />
      <div
        ref={scrollContainerRef}
        className="relative overflow-x-auto overflow-y-hidden border-y border-border bg-card py-2 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className={`flex whitespace-nowrap ${isPaused ? '' : 'animate-marquee'}`}
          style={{ '--marquee-duration': `5s` }}
        >
          {trendingStocks.map((item) => (
            <TrendingItem key={`${item.category}-${item.symbol}`} symbol={item.symbol} quote={quotes[item.symbol]} />
          ))}
          {trendingStocks.map((item) => (
            <TrendingItem key={`${item.category}-${item.symbol}-dup`} symbol={item.symbol} quote={quotes[item.symbol]} />
          ))}
        </div>
      </div>
    </div>
  );
}
