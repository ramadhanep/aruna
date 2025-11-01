"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SYMBOLS = {
  usStocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
  idxStocks: ['BBCA.JK', 'BBRI.JK', 'BMRI.JK', 'BRIS.JK'],
  crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD']
};

async function fetchQuote(symbol) {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 60 * 60 * 24 * 5; // 5 days
    const res = await fetch(`/api/yahoo-finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data || [];
    if (data.length < 2) return null;
    
    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const price = current.adjclose;
    const change = price - previous.adjclose;
    const changePercent = (change / previous.adjclose) * 100;
    const name = json.meta?.name || symbol;
    
    return {
      symbol,
      name,
      price,
      change,
      changePercent,
      chartData: data.slice(-30).map(d => d.adjclose) // Last 30 points for mini chart
    };
  } catch (e) {
    console.warn(`Failed to fetch ${symbol}`, e);
    return null;
  }
}

function MiniChart({ data, isPositive }) {
  if (!data || data.length === 0) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 30;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StockItem({ quote }) {
  if (!quote) return null;
  
  const isPositive = quote.change >= 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  
  return (
    <Link href={`/election-cycle?symbol=${encodeURIComponent(quote.symbol)}`} className="flex items-center gap-3 py-3 px-4 hover:bg-accent/30 transition-colors cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base truncate">{quote.symbol}</div>
        <div className="text-xs text-muted-foreground truncate">{quote.name}</div>
      </div>
      <div className={`flex items-center ${color}`}>
        <MiniChart data={quote.chartData} isPositive={isPositive} />
      </div>
      <div className="flex flex-col items-end">
        <div className="font-semibold text-base">{quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className={`text-xs font-medium flex items-center gap-1 ${color}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
      {title}
    </div>
  );
}

function ShimmerItem() {
  return (
    <div className="flex items-center gap-3 py-3 px-4 animate-pulse">
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-muted rounded w-16 mb-1"></div>
        <div className="h-3 bg-muted rounded w-32"></div>
      </div>
      <div className="w-[60px] h-[30px] bg-muted rounded"></div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-4 bg-muted rounded w-20"></div>
        <div className="h-3 bg-muted rounded w-16"></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      setLoading(true);
      const allSymbols = [
        ...SYMBOLS.usStocks,
        ...SYMBOLS.idxStocks,
        ...SYMBOLS.crypto
      ];
      
      const results = {};
      for (const symbol of allSymbols) {
        const quote = await fetchQuote(symbol);
        if (quote) results[symbol] = quote;
      }
      
      setQuotes(results);
      setLoading(false);
    }
    
    loadQuotes();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col">
        <div className="border rounded-lg overflow-hidden bg-card">
          <SectionHeader title="US Stocks" />
          <div className="divide-y">
            {[...Array(7)].map((_, i) => <ShimmerItem key={i} />)}
          </div>

          <SectionHeader title="IDX Stocks" />
          <div className="divide-y">
            {[...Array(4)].map((_, i) => <ShimmerItem key={i} />)}
          </div>

          <SectionHeader title="Crypto" />
          <div className="divide-y">
            {[...Array(3)].map((_, i) => <ShimmerItem key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome!</CardTitle>
          <CardDescription>
            Start analyzing seasonal patterns in seconds
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="border rounded-lg overflow-hidden bg-card">
        <SectionHeader title="US Stocks" />
        <div className="divide-y">
          {SYMBOLS.usStocks.map(symbol => (
            <StockItem key={symbol} quote={quotes[symbol]} />
          ))}
        </div>

        <SectionHeader title="IDX Stocks" />
        <div className="divide-y">
          {SYMBOLS.idxStocks.map(symbol => (
            <StockItem key={symbol} quote={quotes[symbol]} />
          ))}
        </div>

        <SectionHeader title="Crypto" />
        <div className="divide-y">
          {SYMBOLS.crypto.map(symbol => (
            <StockItem key={symbol} quote={quotes[symbol]} />
          ))}
        </div>
      </div>
    </div>
  );
}
