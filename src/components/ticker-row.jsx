import Link from "next/link";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { TickerAvatar } from "@/components/ticker-avatar";
import { MiniChart } from "@/components/mini-chart";
import { formatPriceTrim, formatTickerDisplay, getChangeTone } from "@/lib/utils";
import { DURATION_CLASS } from "@/lib/motion";
import { Badge } from "@/components/ui/badge";

export const TickerRow = memo(function TickerRow({
  symbol,
  href,
  logo,
  name,
  price,
  change = 0,
  changePercent = 0,
  chartData = [],
  isNew = false,
  isWarning = false,
}) {
  const t = useTranslations();
  if (!symbol) return null;

  const isPositive = change >= 0;
  const color = getChangeTone(change);
  const hasChart = Array.isArray(chartData) && chartData.length > 0;
  const formattedPrice = typeof price === "number" ? formatPriceTrim(price, symbol) : "-";

  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex items-center gap-3 py-3.5 px-1 hover:bg-accent/40 transition-all ${DURATION_CLASS.base} rounded-xl -mx-1`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="flex-shrink-0">
          <TickerAvatar symbol={symbol} logo={logo} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate flex items-center gap-1.5">
            <span>{formatTickerDisplay(symbol)}</span>
            {isNew ? (
              <Badge variant="new" className="px-1.5 py-[2px] rounded-md">NEW</Badge>
            ) : null}
            {isWarning ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" title={t("tickerRow.highVolumeWarning")} />
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{name}</div>
        </div>
      </div>
      <div className={`flex items-center ${hasChart ? color : "text-muted-foreground"}`}>
        <MiniChart data={chartData} isPositive={isPositive} />
      </div>
      <div className="flex flex-col items-end">
        <div className="font-semibold text-sm tabular-nums">{formattedPrice}</div>
        <div className={`text-xs font-medium flex items-center gap-1 ${color}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? "+" : ""}
          {typeof changePercent === "number" ? changePercent.toFixed(2) : "0.00"}%
        </div>
      </div>
    </Link>
  );
});
