"use client";

import { ChevronDown, Star, Bitcoin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTickerDisplay } from "@/lib/utils";

export function ChartHeaderBar({
  symbol,
  assetName,
  isFavorite,
  onToggleFavorite,
  onSearchOpen,
  selectedCycles,
  onCyclesChange,
}) {
  return (
    <div className="lg:col-span-12 flex justify-between gap-2 mb-4 lg:mb-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1
          className="text-base font-semibold uppercase cursor-pointer transition-colors hover:text-primary flex items-center gap-1"
          onClick={onSearchOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSearchOpen();
            }
          }}
        >
          {formatTickerDisplay(symbol)} <ChevronDown className="size-4 dark:text-white/70" />
        </h1>
        <span className="text-muted">|</span>
        {symbol.endsWith('.JK') && (
          <span className="dark:text-white/70 text-xs">🇮🇩</span>
        )}
        {symbol.endsWith('-USD') && (
          <span className="dark:text-white/70 text-xs flex items-center gap-1"><Bitcoin className="size-4 text-amber-600" /></span>
        )}
        {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
          <span className="dark:text-white/70 text-xs">🇺🇸</span>
        )}
        {['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'AVGO'].some((s) => symbol.endsWith(s)) && (
          <span className="dark:text-white/70 text-xs flex items-center gap-1">🇺🇸</span>
        )}
      </div>
      <div className="flex gap-3">
        <Select
          className="w-full"
          value={selectedCycles.join(',')}
          onValueChange={(value) => onCyclesChange(value.split(','))}
        >
          <SelectTrigger className="h-8 text-[11px]">
            <SelectValue placeholder="Select cycles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="text-[11px]" value="normal">Normal</SelectItem>
            <SelectItem className="text-[11px]" value="trump,current">Trump Years</SelectItem>
            <SelectItem className="text-[11px]" value="all,current">All Years</SelectItem>
            <SelectItem className="text-[11px]" value="pre,current">Pre-Election</SelectItem>
            <SelectItem className="text-[11px]" value="election,current">Election</SelectItem>
            <SelectItem className="text-[11px]" value="post,current">Post-Election</SelectItem>
            <SelectItem className="text-[11px]" value="mid,current">Mid-Term</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${symbol} from favorites` : `Add ${symbol} to favorites`}
          className={`rounded-full p-1 transition-colors ${isFavorite ? 'text-amber-600 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Star
            className="size-5.5"
            strokeWidth={isFavorite ? 1.2 : 1.5}
            fill={isFavorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>
    </div>
  );
}
