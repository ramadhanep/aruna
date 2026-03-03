"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { TickerAvatar } from "./ticker-avatar";
import { fetchEncodedJson } from "@/lib/api-client";
import { formatTickerDisplay } from "@/lib/utils";

function TrendingItem({ symbol, quote }) {
  if (!quote) return null;

  const isPositive = (quote.change ?? 0) >= 0;
  const color = isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400";
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
          {formattedPrice} <span className={`text-[10px] font-semibold ${color}`}>{formattedChange}</span>
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

          // Fetch quotes for all trending symbols
          const endDate = Math.floor(Date.now() / 1000);
          const startDate = endDate - 60 * 60 * 24 * 5;

          const quoteResults = await Promise.all(
            ordered.map(async (item) => {
              try {
                const url = `/api/finance?symbol=${encodeURIComponent(
                  item.symbol
                )}&startDate=${startDate}&endDate=${endDate}`;
                const { response, data: financeData } = await fetchEncodedJson(url);
                if (!response.ok) return null;

                const series = Array.isArray(financeData?.data) ? financeData.data : [];
                const meta = financeData?.meta || {};

                // Filter out null/invalid data points
                const validSeries = series.filter(point => {
                  const hasClose = point.adjclose != null || point.close != null;
                  return hasClose;
                });

                let price = meta.regularMarketPrice;
                let previousPrice = meta.previousClose || meta.chartPreviousClose;

                if (validSeries.length >= 2) {
                  const current = validSeries[validSeries.length - 1];
                  const previous = validSeries[validSeries.length - 2];

                  if (current.adjclose != null) {
                    price = current.adjclose;
                  } else if (current.close != null) {
                    price = current.close;
                  }

                  if (previous.adjclose != null) {
                    previousPrice = previous.adjclose;
                  } else if (previous.close != null) {
                    previousPrice = previous.close;
                  }
                }

                if (price == null || previousPrice == null) return null;

                const change = price - previousPrice;
                const changePercent = (change / previousPrice) * 100;
                const chartData = series
                  .slice(-30)
                  .map((d) => d.adjclose)
                  .filter((v) => v != null);

                return {
                  symbol: item.symbol,
                  price,
                  change,
                  changePercent,
                  chartData,
                  logo: meta.logo || null,
                };
              } catch (error) {
                console.warn(`Failed to fetch quote for ${item.symbol}`, error);
                return null;
              }
            })
          );

          const quotesMap = {};
          quoteResults.forEach((quote) => {
            if (quote) {
              quotesMap[quote.symbol] = quote;
            }
          });

          setQuotes(quotesMap);
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

  if (loading || trendingStocks.length === 0) {
    return null;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="relative overflow-x-auto overflow-y-hidden bg-gradient-to-r from-emerald-50/40 via-sky-50/30 to-amber-50/40 dark:from-emerald-950/15 dark:via-sky-950/10 dark:to-amber-950/15 border-y border-border/30 py-2 scrollbar-hide rounded-xl"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className={`flex whitespace-nowrap ${isPaused ? '' : 'animate-marquee'}`}>
        {trendingStocks.map((item) => (
          <TrendingItem key={`${item.category}-${item.symbol}`} symbol={item.symbol} quote={quotes[item.symbol]} />
        ))}
        {trendingStocks.map((item) => (
          <TrendingItem key={`${item.category}-${item.symbol}-dup`} symbol={item.symbol} quote={quotes[item.symbol]} />
        ))}
      </div>
    </div>
  );
}
