import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { getChangeTone } from '@/lib/utils';

export function ChartFinancialsTab({
  symbol,
  fundamentalsLoading,
  fundamentals,
  currencyCode,
  formatTimestamp,
  formatPct,
  formatNum,
}) {
  if (fundamentalsLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, idx) => (
          <Card key={idx}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-32 rounded-full" />
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20 rounded-full" />
                    <Skeleton className="h-4 w-24 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const fh = fundamentals?.financialHealth;
  const kse = fundamentals?.keyStatsExtras;
  const div = fundamentals?.dividendInfo;
  const cal = fundamentals?.calendarData;
  const upgrades = fundamentals?.upgrades;
  const marketData = fundamentals?.marketData;

  const hasFinancialHealth = fh && Object.values(fh).some(v => v != null);
  const hasKeyStats = kse && Object.values(kse).some(v => v != null);
  const hasDividends = div && (div.dividendRate != null || div.dividendYield != null);
  const hasCalendar = cal && (cal.earningsDate?.length > 0 || cal.exDividendDate || cal.dividendDate);
  const hasUpgrades = upgrades && upgrades.length > 0;
  const hasOwnershipShort = kse && (kse.sharesShortPriorMonth != null || kse.sharesShortPreviousMonthDate != null || kse.sharesPercentSharesOut != null || kse.shortPercentOfFloat != null || kse.impliedSharesOutstanding != null);
  const hasFiscalMarkers = kse && (kse.lastFiscalYearEnd != null || kse.nextFiscalYearEnd != null || kse.mostRecentQuarter != null);

  if (!hasFinancialHealth && !hasKeyStats && !hasDividends && !hasCalendar && !hasUpgrades && !hasOwnershipShort && !hasFiscalMarkers) {
    return <Card><CardContent className="text-xs text-muted-foreground py-6">Financial details unavailable for {symbol}.</CardContent></Card>;
  }

  const formatDate = (v) => formatTimestamp(v, { dateOnly: true }) ?? '—';

  return (
    <div className="space-y-4">
      {hasCalendar && <Card><CardHeader><CardTitle className="text-sm">Upcoming Events</CardTitle></CardHeader><CardContent><Table><TableBody>{cal.earningsDate?.length > 0 && <TableRow><TableCell className="py-2 text-xs text-muted-foreground">Next Earnings</TableCell><TableCell className="py-2 text-xs font-medium text-right">{formatDate(cal.earningsDate[0])}</TableCell></TableRow>}{cal.exDividendDate && <TableRow><TableCell className="py-2 text-xs text-muted-foreground">Ex-Dividend Date</TableCell><TableCell className="py-2 text-xs font-medium text-right">{formatDate(cal.exDividendDate)}</TableCell></TableRow>}{cal.dividendDate && <TableRow><TableCell className="py-2 text-xs text-muted-foreground">Dividend Pay Date</TableCell><TableCell className="py-2 text-xs font-medium text-right">{formatDate(cal.dividendDate)}</TableCell></TableRow>}{marketData?.earningsCallTimestampStart && <TableRow><TableCell className="py-2 text-xs text-muted-foreground">Earnings Call</TableCell><TableCell className="py-2 text-xs font-medium text-right">{formatTimestamp(marketData.earningsCallTimestampStart) ?? '—'}</TableCell></TableRow>}</TableBody></Table></CardContent></Card>}
      {hasFinancialHealth && <Card><CardHeader><CardTitle className="text-sm">Financial Health</CardTitle></CardHeader><CardContent><Table><TableBody>{[{ label: 'Total Revenue', value: formatNum(fh.totalRevenue) }, { label: 'Free Cash Flow', value: formatNum(fh.freeCashflow), highlight: fh.freeCashflow != null ? (fh.freeCashflow >= 0 ? 'pos' : 'neg') : null }, { label: 'Total Cash', value: formatNum(fh.totalCash) }, { label: 'Total Debt', value: formatNum(fh.totalDebt), highlight: fh.totalDebt != null && fh.totalCash != null ? (fh.totalDebt < fh.totalCash ? 'pos' : 'neg') : null }, { label: 'Debt / Equity', value: fh.debtToEquity != null ? fh.debtToEquity.toFixed(2) : '—', highlight: fh.debtToEquity != null ? (fh.debtToEquity < 100 ? 'pos' : 'neg') : null }, { label: 'Current Ratio', value: fh.currentRatio != null ? fh.currentRatio.toFixed(2) : '—', highlight: fh.currentRatio != null ? (fh.currentRatio >= 1 ? 'pos' : 'neg') : null }, { label: 'Quick Ratio', value: fh.quickRatio != null ? fh.quickRatio.toFixed(2) : '—', highlight: fh.quickRatio != null ? (fh.quickRatio >= 1 ? 'pos' : 'neg') : null }, { label: 'Revenue / Share', value: fh.revenuePerShare != null ? fh.revenuePerShare.toFixed(2) : '—' }].filter(item => item.value !== '—').map((item) => <TableRow key={item.label}><TableCell className="py-2 text-1xs text-muted-foreground">{item.label}</TableCell><TableCell className={`py-2 text-xs font-semibold text-right ${item.highlight === 'pos' ? 'text-emerald-500' : item.highlight === 'neg' ? 'text-red-500' : ''}`}>{item.value}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}
      {hasFinancialHealth && <Card><CardHeader><CardTitle className="text-sm">Margins & Growth</CardTitle></CardHeader><CardContent><div className="space-y-3">{[{ label: 'Gross Margin', value: fh.grossMargins, color: 'bg-emerald-500' }, { label: 'Operating Margin', value: fh.operatingMargins, color: 'bg-sky-500' }, { label: 'Profit Margin', value: fh.profitMargins, color: 'bg-violet-500' }, { label: 'EBITDA Margin', value: fh.ebitdaMargins, color: 'bg-amber-500' }].filter(item => item.value != null).map((item) => <div key={item.label} className="space-y-1"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{item.label}</span><span className="font-semibold">{formatPct(item.value)}</span></div><Progress value={Math.min(100, Math.max(0, (item.value || 0) * 100))} className="h-1.5 bg-muted" indicatorClassName={item.color} /></div>)}<div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20">{[{ label: 'ROE', value: fh.returnOnEquity }, { label: 'ROA', value: fh.returnOnAssets }, { label: 'Revenue Growth', value: fh.revenueGrowth }, { label: 'Earnings Growth', value: fh.earningsGrowth }].filter(item => item.value != null).map((item) => <div key={item.label} className="space-y-0.5"><dt className="text-1xs text-muted-foreground">{item.label}</dt><dd className={`text-xs font-semibold ${getChangeTone(item.value)}`}>{formatPct(item.value)}</dd></div>)}</div></div></CardContent></Card>}
      {hasDividends && <Card><CardHeader><CardTitle className="text-sm">Dividend Info</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-y-3 gap-x-4">{[{ label: 'Dividend Rate', value: div.dividendRate != null ? `${currencyCode} ${div.dividendRate.toFixed(2)}` : null }, { label: 'Dividend Yield', value: div.dividendYield != null ? formatPct(div.dividendYield) : null }, { label: 'Payout Ratio', value: div.payoutRatio != null ? formatPct(div.payoutRatio) : null }, { label: '5Y Avg Yield', value: div.fiveYearAvgDividendYield != null ? `${div.fiveYearAvgDividendYield.toFixed(2)}%` : null }, { label: 'Ex-Dividend', value: div.exDividendDate ? formatDate(div.exDividendDate) : null }].filter(item => item.value != null).map((item) => <div key={item.label} className="space-y-0.5"><dt className="text-1xs text-muted-foreground">{item.label}</dt><dd className="text-xs font-semibold">{item.value}</dd></div>)}</div></CardContent></Card>}
      {hasKeyStats && <Card><CardHeader><CardTitle className="text-sm">Key Statistics</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-y-3 gap-x-4">{[{ label: 'Beta', value: kse.beta != null ? kse.beta.toFixed(3) : null }, { label: 'Book Value', value: kse.bookValue != null ? kse.bookValue.toFixed(2) : null }, { label: 'EPS (TTM)', value: kse.trailingEps != null ? kse.trailingEps.toFixed(2) : null }, { label: 'EPS (Fwd)', value: kse.forwardEps != null ? kse.forwardEps.toFixed(2) : null }, { label: 'Earnings Growth (Q)', value: kse.earningsQuarterlyGrowth != null ? formatPct(kse.earningsQuarterlyGrowth) : null }, { label: '52-Week Change', value: kse.fiftyTwoWeekChange != null ? formatPct(kse.fiftyTwoWeekChange) : null }, { label: 'Shares Outstanding', value: kse.sharesOutstanding != null ? formatNum(kse.sharesOutstanding) : null }, { label: 'Float', value: kse.floatShares != null ? formatNum(kse.floatShares) : null }, { label: 'Implied Shares Out', value: kse.impliedSharesOutstanding != null ? formatNum(kse.impliedSharesOutstanding) : null }, { label: 'Short Ratio', value: kse.shortRatio != null ? kse.shortRatio.toFixed(2) : null }, { label: 'Shares Short', value: kse.sharesShort != null ? formatNum(kse.sharesShort) : null }, { label: 'Shares Short (Prev)', value: kse.sharesShortPriorMonth != null ? formatNum(kse.sharesShortPriorMonth) : null }, { label: 'Short % Float', value: kse.shortPercentOfFloat != null ? formatPct(kse.shortPercentOfFloat) : null }, { label: 'Short % Shares Out', value: kse.sharesPercentSharesOut != null ? formatPct(kse.sharesPercentSharesOut) : null }, { label: '% Held by Insiders', value: kse.heldPercentInsiders != null ? formatPct(kse.heldPercentInsiders) : null }, { label: '% Held by Institutions', value: kse.heldPercentInstitutions != null ? formatPct(kse.heldPercentInstitutions) : null }, { label: 'Last Split', value: kse.lastSplitFactor || null }].filter(item => item.value != null).map((item) => <div key={item.label} className="space-y-0.5"><dt className="text-1xs text-muted-foreground">{item.label}</dt><dd className="text-xs font-semibold">{item.value}</dd></div>)}</div></CardContent></Card>}
      {hasOwnershipShort && <Card><CardHeader><CardTitle className="text-sm">Ownership & Short Interest</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-y-3 gap-x-4">{[{ label: 'Shares Short (Current)', value: kse.sharesShort != null ? formatNum(kse.sharesShort) : null }, { label: 'Shares Short (Prev)', value: kse.sharesShortPriorMonth != null ? formatNum(kse.sharesShortPriorMonth) : null }, { label: 'Short % Float', value: kse.shortPercentOfFloat != null ? formatPct(kse.shortPercentOfFloat) : null }, { label: 'Short % Shares Out', value: kse.sharesPercentSharesOut != null ? formatPct(kse.sharesPercentSharesOut) : null }, { label: 'Insider Ownership', value: kse.heldPercentInsiders != null ? formatPct(kse.heldPercentInsiders) : null }, { label: 'Institution Ownership', value: kse.heldPercentInstitutions != null ? formatPct(kse.heldPercentInstitutions) : null }, { label: 'Short Data Date', value: kse.sharesShortPreviousMonthDate ? formatDate(kse.sharesShortPreviousMonthDate) : null }].filter((item) => item.value != null).map((item) => <div key={item.label} className="space-y-0.5"><dt className="text-1xs text-muted-foreground">{item.label}</dt><dd className="text-xs font-semibold">{item.value}</dd></div>)}</div></CardContent></Card>}
      {hasFiscalMarkers && <Card><CardHeader><CardTitle className="text-sm">Fiscal Markers</CardTitle></CardHeader><CardContent><dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">{[{ label: 'Most Recent Quarter', value: kse.mostRecentQuarter ? formatDate(kse.mostRecentQuarter) : null }, { label: 'Last Fiscal Year End', value: kse.lastFiscalYearEnd ? formatDate(kse.lastFiscalYearEnd) : null }, { label: 'Next Fiscal Year End', value: kse.nextFiscalYearEnd ? formatDate(kse.nextFiscalYearEnd) : null }].filter((item) => item.value != null).map((item) => <div key={item.label} className="space-y-0.5"><dt className="text-muted-foreground">{item.label}</dt><dd className="font-semibold text-foreground">{item.value}</dd></div>)}</dl></CardContent></Card>}
      {hasUpgrades && <Card><CardHeader><CardTitle className="text-sm">Recent Upgrades & Downgrades</CardTitle></CardHeader><CardContent><div className="space-y-2">{upgrades.map((entry, idx) => { const actionColor = entry.action === 'up' || entry.action === 'init' ? 'text-emerald-600 dark:text-emerald-400' : entry.action === 'down' ? 'text-red-500' : 'text-muted-foreground'; const actionLabel = entry.action === 'up' ? '↑ Upgrade' : entry.action === 'down' ? '↓ Downgrade' : entry.action === 'init' ? '● Initiated' : entry.action === 'main' ? '— Maintained' : entry.action || '—'; return <div key={idx} className="flex items-start gap-3 py-2 border-b border-border/10 last:border-0"><div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{entry.firm || 'Unknown'}</p><p className="text-1xs text-muted-foreground">{entry.fromGrade ? `${entry.fromGrade} → ` : ''}{entry.toGrade || '—'}</p></div><div className="text-right shrink-0"><p className={`text-1xs font-semibold ${actionColor}`}>{actionLabel}</p><p className="text-2xs text-muted-foreground">{formatDate(entry.date)}</p></div></div>; })}</div></CardContent></Card>}
    </div>
  );
}
