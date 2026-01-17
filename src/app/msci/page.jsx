"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";
import {
  formatMarketCap,
  formatPrice,
  formatPercent,
} from "@/lib/msci-calculations";
import { TickerAvatar } from "@/components/ticker-avatar";

function SegmentControl({ value, onChange }) {
  return (
    <div className="sticky top-14 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 border-b border-border/40">
      <div className="flex gap-2 p-1 bg-muted/30 rounded-full">
        <Button
          type="button"
          variant="ghost"
          className={`flex-1 rounded-full text-xs font-semibold transition-all ${
            value === "standard"
              ? "bg-emerald-700 hover:bg-emerald-800"
              : "hover:bg-muted/50"
          }`}
          onClick={() => onChange("standard")}
        >
          MSCI Global Standard
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`flex-1 rounded-full text-xs font-semibold transition-all ${
            value === "small_cap"
              ? "bg-emerald-700 hover:bg-emerald-800"
              : "hover:bg-muted/50"
          }`}
          onClick={() => onChange("small_cap")}
        >
          MSCI Global Small Cap
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colorMap = {
    success: "bg-emerald-600/20 text-emerald-600 border-emerald-600/30",
    warning: "bg-yellow-600/20 text-yellow-600 border-yellow-600/30",
    danger: "bg-red-600/20 text-red-600 border-red-600/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        colorMap[status.variant] || colorMap.danger
      }`}
    >
      {status.label}
    </span>
  );
}

function StockCard({ stock }) {
  const progressPercent = Math.min(stock.progress, 100);
  const isNearInclusion = stock.progress >= 90;

  return (
    <Card className="bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#020617] border-border/20 text-white overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold truncate">{stock.ticker.replace('.JK', '')}</h3>
              <StatusBadge status={stock.status} />
            </div>
            <p className="text-[11px] text-white/70 truncate">
              {stock.company_name}
            </p>
          </div>
          {stock.logo_url && (
            <div className="flex-shrink-0 ml-2">
							<TickerAvatar symbol={stock.ticker} logo={stock.logo_url} />
            </div>
          )}
        </div>

        {/* Price & Market Cap */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Price</p>
            <p className="text-sm font-semibold">Rp {formatPrice(stock.price)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Market Cap</p>
            <p className="text-sm font-semibold">{formatMarketCap(stock.market_cap)}</p>
          </div>
        </div>

        {/* Free Float */}
        <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
          <span className="text-[10px] text-white/70">Free Float</span>
          <span className="text-xs font-semibold">{formatPercent(stock.free_float_percent)}</span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/70">Progress to MSCI</span>
            <span className="font-semibold text-emerald-400">
              {formatPercent(stock.progress)}
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isNearInclusion
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : stock.progress >= 70
                  ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                  : "bg-gradient-to-r from-red-500 to-red-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Target Price & Upside */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div className="space-y-0.5">
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Target Price</p>
            <p className="text-xs font-semibold text-emerald-400">
              Rp {formatPrice(stock.targetPrice)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Potential Upside</p>
            <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatPercent(stock.upside)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-gradient-to-br from-muted/30 to-muted/20">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MSCIPage() {
  const [selectedIndex, setSelectedIndex] = useState("standard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchEncodedJson(`/api/msci?index=${selectedIndex}`);
        setData(result);
      } catch (err) {
        console.error("Failed to fetch MSCI data:", err);
        setError(err.message || "Failed to load MSCI data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedIndex]);

  const filteredStocks = data?.data?.stocks?.filter(
    (s) => s.msci_index === selectedIndex
  ) || [];

  return (
    <div className="space-y-4 pb-4">
      {/* Info Card */}
      <Card className="border-none bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#020617] text-white shadow-lg p-4">
        <CardContent className="pt-0">
					<p className="text-xs leading-relaxed text-white/90 font-semibold">
						Tracking Indonesian KONGLO stocks chasing MSCI Global & Small Cap inclusion.
					</p>
        </CardContent>
    </Card>

      {/* Segment Control */}
      <SegmentControl value={selectedIndex} onChange={setSelectedIndex} />

      {/* Error State */}
      {error && (
        <Card className="bg-red-600/10 border-red-600/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-600">Failed to load data</p>
              <p className="text-xs text-red-600/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !error && <LoadingSkeleton />}

      {/* Empty State */}
      {!loading && !error && filteredStocks.length === 0 && (
        <Card className="bg-muted/20">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No stocks found for this MSCI index.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stock Cards List */}
      {!loading && !error && filteredStocks.length > 0 && (
        <div className="space-y-3">
          {filteredStocks.map((stock) => (
            <StockCard key={stock.id} stock={stock} />
          ))}
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-[10px] text-center text-muted-foreground">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
