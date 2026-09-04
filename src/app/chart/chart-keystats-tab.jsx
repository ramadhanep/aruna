import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { SegmentedControl } from '@/components/ui/segmented-control';
import dynamic from 'next/dynamic';

const LazyEarningsChart = dynamic(() => import('@/components/recharts/earnings-chart').then((m) => m.EarningsChart), { ssr: false });
const LazyRevenueChart = dynamic(() => import('@/components/recharts/revenue-chart').then((m) => m.RevenueChart), { ssr: false });

const SECONDARY_CHART_HEIGHT_CLASS = "h-[260px]";

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
  analysisCurrency,
  compactNumberFormatter,
  formatSignedEarnings,
  latestEarningsPoint,
  latestEarningsOutcome,
  latestRevenuePoint,
  earningsChartData,
  revenueChartData,
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
  formatRevenueValue,
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
  const spread =
    marketData?.bid != null && marketData?.ask != null
      ? Number(marketData.ask) - Number(marketData.bid)
      : null;
  const spreadPct =
    spread != null && displayedPrice != null && Number(displayedPrice) !== 0
      ? (spread / Number(displayedPrice)) * 100
      : null;
  const snapshotRows = marketData
    ? [
      { label: t('marketState'), value: formatMarketState(marketData.marketState) },
      { label: t('quoteSource'), value: marketData.quoteSourceName || null },
      { label: 'Bid', value: formatPlainNumber(marketData.bid) },
      { label: 'Ask', value: formatPlainNumber(marketData.ask) },
      { label: 'Bid Size', value: formatQuantityValue(marketData.bidSize) },
      { label: 'Ask Size', value: formatQuantityValue(marketData.askSize) },
      {
        label: 'Spread',
        value:
          spread != null && Number.isFinite(spread)
            ? `${formatPlainNumber(spread)}${spreadPct != null ? ` (${spreadPct.toFixed(3)}%)` : ''}`
            : null,
      },
      { label: t('timezone'), value: marketData.exchangeTimezoneName?.replace(/_/g, ' ') || null },
      { label: t('regularSession'), value: formatTimestamp(marketData.regularMarketTime) || null },
      { label: t('preMarket'), value: formatTimestamp(marketData.preMarketTime) || null },
      { label: t('postMarket'), value: formatTimestamp(marketData.postMarketTime) || null },
      { label: t('analystSummary'), value: marketData.averageAnalystRating || null },
    ].filter((item) => item.value && item.value !== '—')
    : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm mb-2">{t('summary')}</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryStats.length > 0 ? (
            <dl className="grid grid-cols-2 gap-3">
              {summaryStats.map((item) => (
                <div key={item.label} className="space-y-1">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="text-xs font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('summaryUnavailable', { symbol })}
            </p>
          )}
        </CardContent>
      </Card>

      {snapshotRows.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-sm mb-2">{t('tradingSnapshot')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {snapshotRows.map((item) => (
                  <TableRow key={item.label}>
                    <TableCell className="py-2 text-xs text-muted-foreground">{item.label}</TableCell>
                    <TableCell className="py-2 text-xs font-semibold text-right text-foreground">{item.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(hasEarningsAnalysis || hasRevenueAnalysis) ? (
        <div className="grid gap-2 grid-cols-1">
          {hasEarningsAnalysis && latestEarningsPoint && (
            <div className="relative">
              <Card className="h-full mt-4">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-sm mb-4">{t('earningsResults')}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {latestEarningsPoint.periodLabel}
                        </span>{' '}
                        • {t('estimate')}{' '}
                        <span className="font-medium text-muted-foreground">
                          {formatSignedEarnings(latestEarningsPoint.estimate)}
                        </span>{' '}
                        • {t('actual')}{' '}
                        <span className="font-medium text-emerald-700">
                          {formatSignedEarnings(latestEarningsPoint.actual)}
                        </span>
                      </p>
                      {latestEarningsOutcome ? (
                        <p
                          className={`text-xs font-semibold ${latestEarningsOutcome.tone === 'beat'
                            ? 'text-emerald-700'
                            : 'text-red-600'
                            }`}
                        >
                          {latestEarningsOutcome.label}
                        </p>
                      ) : null}
                    </div>
                    <Badge className="px-3 py-1 uppercase tracking-wide">
                      {t('normalized')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className={SECONDARY_CHART_HEIGHT_CLASS}>
                  <LazyEarningsChart
                    data={earningsChartData}
                    secondaryColor={secondaryChartColor}
                    formatEarningsValue={formatEarningsValue}
                    renderEarningsTick={renderEarningsTick}
                    renderEstimateDot={renderEstimateDot}
                    renderActualDot={renderActualDot}
                    earningsTooltipFormatter={earningsTooltipFormatter}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {hasRevenueAnalysis && (
            <div className="relative">
              <Card className="h-full">
                <CardHeader className="gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <CardTitle className="text-sm mb-4">{t('revenueVsEarnings')}</CardTitle>
                      {latestRevenuePoint && (
                        <p className="text-xs text-muted-foreground">
                          <span style={{ color: primaryChartColor }}>
                            {t('revenue')} {formatRevenueValue(latestRevenuePoint.revenue)}
                          </span>{' '}
                          •{' '}
                          <span style={{ color: secondaryChartColor }}>
                            {t('earnings')} {formatRevenueValue(latestRevenuePoint.earnings)}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
                      <SegmentedControl
                        value={revenuePeriod}
                        onValueChange={setRevenuePeriod}
                        variant="ghost"
                        className="px-2 py-1 text-xs rounded-full"
                        activeClassName="bg-foreground text-background hover:bg-foreground/90 dark:hover:bg-foreground/90 shadow-sm"
                        inactiveClassName="text-foreground hover:bg-accent hover:text-accent-foreground"
                        options={[
                          { value: 'annual', label: t('annual'), disabled: !hasAnnualRevenue },
                          { value: 'quarterly', label: t('quarterly') },
                        ]}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={SECONDARY_CHART_HEIGHT_CLASS}>
                  <LazyRevenueChart
                    data={revenueChartData}
                    primaryColor={primaryChartColor}
                    secondaryColor={secondaryChartColor}
                    analysisCurrency={analysisCurrency}
                    compactNumberFormatter={compactNumberFormatter}
                    revenueTooltipFormatter={revenueTooltipFormatter}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="text-xs text-muted-foreground">
            {t('earningsRevenueUnavailable')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
