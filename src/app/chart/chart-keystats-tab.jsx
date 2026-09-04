import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AnalystGaugeChart } from '@/components/analyst-gauge-chart';

export function ChartKeyStatsTab({
  t,
  symbol,
  fundamentalsLoading,
  fundamentals,
  displayedPrice,
  formatMarketState,
  formatTimestamp,
  formatPlainNumber,
  formatQuantityValue,
  summaryStats,
  recommendationData,
  revenueChartData,
  analysisCurrency,
  currencyCode,
  currencyFractionDigits,
  compactNumberFormatter,
  formatDetailedCurrency,
  formatRevenueValue,
  formatSignedEarnings,
  latestEarningsPoint,
  latestEarningsOutcome,
  latestRevenuePoint,
  earningsChartData,
  revenuePeriod,
  setRevenuePeriod,
  hasAnnualRevenue,
  hasEarningsAnalysis,
  hasRevenueAnalysis,
  earningsTooltipFormatter,
  revenueTooltipFormatter,
  renderEarningsTick,
  renderEstimateDot,
  renderActualDot,
  formatEarningsValue,
  secondaryChartColor,
  primaryChartColor,
}) {
  if (fundamentalsLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm mb-2">{t('summary')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="space-y-2">
                <Skeleton className="h-3 w-20 rounded-full" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-2 grid-cols-1">
          {[...Array(2)].map((_, idx) => (
            <Card key={idx} className="h-full">
              <CardHeader>
                <Skeleton className="h-4 w-32 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[220px] rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const marketData = fundamentals?.marketData || null;
  const spread = marketData?.bid != null && marketData?.ask != null ? Number(marketData.ask) - Number(marketData.bid) : null;
  const spreadPct = spread != null && displayedPrice != null && Number(displayedPrice) !== 0 ? (spread / Number(displayedPrice)) * 100 : null;
  const snapshotRows = marketData ? [
    { label: t('marketState'), value: formatMarketState(marketData.marketState) },
    { label: t('quoteSource'), value: marketData.quoteSourceName || null },
    { label: 'Bid', value: formatPlainNumber(marketData.bid) },
    { label: 'Ask', value: formatPlainNumber(marketData.ask) },
    { label: 'Bid Size', value: formatQuantityValue(marketData.bidSize) },
    { label: 'Ask Size', value: formatQuantityValue(marketData.askSize) },
    { label: 'Spread', value: spread != null && Number.isFinite(spread) ? `${formatPlainNumber(spread)}${spreadPct != null ? ` (${spreadPct.toFixed(3)}%)` : ''}` : null },
    { label: t('timezone'), value: marketData.exchangeTimezoneName?.replace(/_/g, ' ') || null },
    { label: t('regularSession'), value: formatTimestamp(marketData.regularMarketTime) || null },
    { label: t('preMarket'), value: formatTimestamp(marketData.preMarketTime) || null },
    { label: t('postMarket'), value: formatTimestamp(marketData.postMarketTime) || null },
    { label: t('analystSummary'), value: marketData.averageAnalystRating || null },
  ].filter((item) => item.value && item.value !== '—') : [];

  const recommendationTrend = Array.isArray(fundamentals?.recommendations?.trend) ? fundamentals.recommendations.trend : [];
  const consensusColumns = revenueChartData.slice(-4);
  const consensusRows = [
    { label: `${t('revenue')}${analysisCurrency ? ` (${analysisCurrency})` : ''}`, values: consensusColumns.map((entry) => entry?.revenue != null ? formatRevenueValue(entry.revenue) : '—') },
    { label: `${t('earnings')}${analysisCurrency ? ` (${analysisCurrency})` : ''}`, values: consensusColumns.map((entry) => entry?.earnings != null ? formatRevenueValue(entry.earnings) : '—') },
  ].filter((row) => row.values.some((value) => value !== '—'));

  const recommendationDataView = recommendationData;
  const hasBreakdown = Boolean(recommendationDataView?.breakdown?.some((item) => item.value));
  const totalOpinions = recommendationDataView?.totalOpinions;
  const ratingLabel = recommendationDataView?.ratingLabel;
  const ratingTextClass = recommendationDataView?.ratingTextClass;
  const ratingScore = recommendationDataView?.ratingScore;
  const priceTargets = recommendationDataView?.priceTargets;
  const currentPrice = displayedPrice ?? null;
  const lowTarget = priceTargets?.low ?? null;
  const highTarget = priceTargets?.high ?? null;
  const averageTarget = priceTargets?.average ?? priceTargets?.median ?? null;
  const minRange = [lowTarget, currentPrice, averageTarget, highTarget].filter((value) => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  const minValue = minRange[0] ?? null;
  const maxValue = minRange[minRange.length - 1] ?? null;
  const span = maxValue != null && minValue != null ? maxValue - minValue || 1 : 1;
  const getPosition = (value) => {
    if (value == null || minValue == null) return '0%';
    return `${Math.min(100, Math.max(0, ((value - minValue) / span) * 100))}%`;
  };

  return (
    <div className="space-y-4">
      {recommendationDataView && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Analyst Rating</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Based on {totalOpinions || 0} analysts in the past 3 months
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <AnalystGaugeChart score={ratingScore} />
            <div className="text-center -mt-2">
              <p className={`text-base font-bold tracking-wide ${ratingTextClass || 'text-foreground'}`}>{ratingLabel || 'N/A'}</p>
            </div>
            {hasBreakdown && <div className="space-y-2 pt-1">{recommendationDataView.breakdown.map((item) => { const percent = totalOpinions ? Math.round((item.value / totalOpinions) * 100) : 0; const barColor = item.label === 'Strong Buy' ? 'bg-emerald-600' : item.label === 'Buy' ? 'bg-emerald-500/80' : item.label === 'Hold' ? 'bg-amber-500' : item.label === 'Sell' ? 'bg-red-500/80' : 'bg-red-600'; return <div key={item.label} className="flex items-center gap-3"><span className="w-20 text-right text-xs text-muted-foreground shrink-0">{item.label}</span><Progress value={Math.min(100, percent)} className="flex-1 h-2.5 bg-muted" indicatorClassName={barColor} /><span className="w-8 text-xs tabular-nums text-muted-foreground">{item.value}</span></div>; })}</div>}
          </CardContent>
        </Card>
      )}

      {priceTargets && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Price Target</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Analyst price forecast for {symbol}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-red-500/8 p-3 text-center"><p className="text-2xs font-semibold text-red-500 uppercase tracking-wider">Low</p><p className="text-sm font-bold text-foreground mt-1">{lowTarget != null ? formatDetailedCurrency(lowTarget, currencyFractionDigits) : '—'}</p>{lowTarget != null && currentPrice != null && <p className={`text-2xs mt-0.5 font-medium ${lowTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>{lowTarget >= currentPrice ? '+' : ''}{(((lowTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%</p>}</div>
              <div className="rounded-xl bg-emerald-500/8 p-3 text-center ring-1 ring-emerald-500/20"><p className="text-2xs font-semibold text-emerald-600 uppercase tracking-wider">Average</p><p className="text-sm font-bold text-foreground mt-1">{averageTarget != null ? formatDetailedCurrency(averageTarget, currencyFractionDigits) : '—'}</p>{averageTarget != null && currentPrice != null && <p className={`text-2xs mt-0.5 font-medium ${averageTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>{averageTarget >= currentPrice ? '+' : ''}{(((averageTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%</p>}</div>
              <div className="rounded-xl bg-emerald-500/8 p-3 text-center"><p className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">High</p><p className="text-sm font-bold text-foreground mt-1">{highTarget != null ? formatDetailedCurrency(highTarget, currencyFractionDigits) : '—'}</p>{highTarget != null && currentPrice != null && <p className={`text-2xs mt-0.5 font-medium ${highTarget >= currentPrice ? 'text-emerald-600' : 'text-red-500'}`}>{highTarget >= currentPrice ? '+' : ''}{(((highTarget - currentPrice) / currentPrice) * 100).toFixed(1)}%</p>}</div>
            </div>
            <div className="space-y-2"><div className="relative h-3 rounded-full bg-muted mx-2">{lowTarget != null && highTarget != null && <div className="absolute top-0 h-full rounded-full bg-foreground/20" style={{ left: getPosition(lowTarget), width: `calc(${getPosition(highTarget)} - ${getPosition(lowTarget)})` }} />}{currentPrice != null && <div className="absolute -top-0.5 flex flex-col items-center" style={{ left: getPosition(currentPrice) }}><div className="w-0.5 h-4 bg-foreground rounded-full -translate-x-1/2" /></div>}{averageTarget != null && <div className="absolute -top-0.5 flex flex-col items-center" style={{ left: getPosition(averageTarget) }}><div className="w-2 h-4 rounded-full bg-emerald-600 -translate-x-1/2 border-2 border-background" /></div>}</div><div className="flex justify-between text-2xs text-muted-foreground px-2"><span>Current: {currentPrice != null ? `${formatDetailedCurrency(currentPrice, currencyFractionDigits)} ${currencyCode}` : '—'}</span><span>Target: {averageTarget != null ? `${formatDetailedCurrency(averageTarget, currencyFractionDigits)} ${currencyCode}` : '—'}</span></div></div>
          </CardContent>
        </Card>
      )}

      {consensusRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Consensus Estimates</CardTitle><CardDescription className="text-xs text-muted-foreground">Revenue and earnings projections</CardDescription></CardHeader>
          <CardContent className="space-y-3">{consensusRows.map((row) => <div key={row.label} className="space-y-2"><p className="text-xs font-semibold text-muted-foreground">{row.label}</p><div className="grid grid-cols-4 gap-2">{consensusColumns.map((entry, idx) => <div key={`${row.label}-${idx}`} className="rounded-xl bg-muted/40 p-2.5 text-center"><p className="text-2xs text-muted-foreground font-medium">{entry.periodLabel}</p><p className="text-xs font-bold text-foreground mt-1">{row.values[idx]}</p></div>)}</div></div>)}</CardContent>
        </Card>
      )}

      {recommendationTrend.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recommendation Trend History</CardTitle><CardDescription className="text-xs text-muted-foreground">Monthly shift in analyst stance</CardDescription></CardHeader>
          <CardContent className="space-y-2">{recommendationTrend.map((entry, idx) => { const sb = Number(entry.strongBuy || 0); const b = Number(entry.buy || 0); const h = Number(entry.hold || 0); const s = Number(entry.sell || 0); const ss = Number(entry.strongSell || 0); const totals = sb + b + h + s + ss; const pct = (v) => totals > 0 ? `${((v / totals) * 100).toFixed(0)}%` : '0%'; const bars = [{ value: sb, color: 'bg-emerald-600', label: 'SB' }, { value: b, color: 'bg-emerald-500/70', label: 'B' }, { value: h, color: 'bg-amber-500', label: 'H' }, { value: s, color: 'bg-red-500/70', label: 'S' }, { value: ss, color: 'bg-red-600', label: 'SS' }]; return <div key={`rec-trend-${idx}`} className="space-y-1.5"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-foreground">{entry.period}</span><span className="text-muted-foreground tabular-nums">{totals} analysts</span></div><div className="flex h-3 rounded-full overflow-hidden gap-px">{bars.map(({ value, color }) => value > 0 ? <div key={color} className={`${color} transition-all`} style={{ width: pct(value) }} title={`${value}`} /> : null)}</div><div className="flex justify-between text-3xs text-muted-foreground px-0.5">{bars.map(({ value, label }) => <span key={label} className="tabular-nums">{label}: {value}</span>)}</div></div>; })}</CardContent>
        </Card>
      )}

      {marketData && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Earnings Event Window</CardTitle><CardDescription className="text-xs text-muted-foreground">Upcoming earnings and call schedule from Yahoo feed</CardDescription></CardHeader>
          <CardContent><dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">{[{ label: 'Earnings Timestamp', value: formatTimestamp(marketData.earningsTimestamp) }, { label: 'Earnings Start', value: formatTimestamp(marketData.earningsTimestampStart) }, { label: 'Earnings End', value: formatTimestamp(marketData.earningsTimestampEnd) }, { label: 'Call Start', value: formatTimestamp(marketData.earningsCallTimestampStart) }, { label: 'Call End', value: formatTimestamp(marketData.earningsCallTimestampEnd) }, { label: 'Date Estimate', value: marketData.isEarningsDateEstimate == null ? null : (marketData.isEarningsDateEstimate ? 'Estimated' : 'Confirmed') }].filter((item) => item.value != null && item.value !== '').map((item) => <div key={item.label} className="space-y-0.5"><dt className="text-muted-foreground">{item.label}</dt><dd className="font-semibold text-foreground">{item.value}</dd></div>)}</dl></CardContent>
        </Card>
      )}
    </div>
  );
}
