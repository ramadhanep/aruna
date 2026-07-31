"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { TickerAvatar } from "./ticker-avatar";
import { fetchEncodedJson } from "@/lib/api-client";
import { formatTickerDisplay, getChangeTone } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function TrendingItem({ symbol, quote }) {
  if (!quote) return null;

  const isPositive = (quote.change ?? 0) >= 0;
  const color = getChangeTone(quote.change ?? 0);
  const formattedPrice = typeof quote.price === "number"
    ? quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "-";
  const formattedChange = typeof quote.changePercent === "number"
    ? `${isPositive ? "+" : ""}${quote.changePercent.toFixed(2)}%`
    : "-";

  return (
    <Link
      href={`/chart?symbol=${encodeURIComponent(symbol)}&cycle=normal`}
      className="inline-flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-accent/40 transition-all duration-200 rounded-xl"
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

function isWithinMarketHours(timeZone, openHour, openMinute, closeHour, closeMinute) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const weekday = (get("weekday") || "").slice(0, 3).toLowerCase();
    if (weekday === "sat" || weekday === "sun") return false;
    const totalMinutes = hour * 60 + minute;
    const open = openHour * 60 + openMinute;
    const close = closeHour * 60 + closeMinute;
    return totalMinutes >= open && totalMinutes <= close;
  } catch (error) {
    console.warn("Failed to evaluate market hours", error);
    return false;
  }
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

function SectionHeader({ title }) {
  return (
    <div className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
    </div>
  );
}

export function TrendingMarquee({ supabase }) {
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
            const { response, data: quotesData } = await fetchEncodedJson('/api/quotes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols }),
            });

            if (response.ok && quotesData?.quotes) {
              const quotesMap = {};
              // Map batch response (keyed by uppercase symbol) to original symbols
              ordered.forEach((item) => {
                const upperSymbol = item.symbol.toUpperCase();
                if (quotesData.quotes[upperSymbol]) {
                  quotesMap[item.symbol] = quotesData.quotes[upperSymbol];
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
        <SectionHeader title="Trending" />
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
      <SectionHeader title="Trending" />
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
