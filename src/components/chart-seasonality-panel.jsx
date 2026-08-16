"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { getReturnCellStyle } from "@/lib/chart-helpers";
import { getWinRateCellStyle } from "@/lib/seasonalData";
import { useTranslations } from "next-intl";

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_KEYS = [1, 2, 3, 4].map((q) => ({ key: `Q${q}`, label: `Q${q}` }));
const MONTH_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({ key: `M${m}`, label: MONTH_NAMES[m - 1] }));

function SeasonalityStatCard({ label, value, valueClass, sub }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center border border-border/20">
      <p className="text-3xs uppercase tracking-wide text-muted-foreground font-medium mb-1">{label}</p>
      <p className={`text-xs font-bold ${valueClass}`}>{value}</p>
      <p className="text-3xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function HeatmapTable({ periods, heatmap, textClass, padClass, wrapClass, yearLabel, totalLabel, avgLabel, probLabel }) {
  const labels = periods.map((p) => p.label);
  const keys = periods.map((p) => p.key);
  const cellClass = `text-center py-2 ${padClass}`;
  const headClass = `text-center py-2 ${padClass} font-medium`;
  return (
    <div className={wrapClass}>
      <table className={`w-full ${textClass}`}>
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">{yearLabel}</th>
            {labels.map((label, idx) => (
              <th key={idx} className={headClass}>{label}</th>
            ))}
            <th className={headClass}>{totalLabel}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b-2 font-semibold bg-muted/50">
            <td className="py-2 px-1 sticky left-0 bg-muted/50">{avgLabel}</td>
            {keys.map((key) => {
              const value = heatmap.average[key];
              return (
                <td key={key} className={`${cellClass} transition-colors font-bold`} style={getReturnCellStyle(value)}>
                  {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                </td>
              );
            })}
            <td className={`${cellClass} transition-colors font-bold`} style={getReturnCellStyle(heatmap.average?.Total)}>
              {heatmap.average?.Total != null ? `${heatmap.average.Total >= 0 ? '+' : ''}${heatmap.average.Total.toFixed(1)}%` : '-'}
            </td>
          </tr>
          {heatmap.rows.map((row, idx) => (
            <tr key={idx}>
              <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
              {keys.map((key) => {
                const value = row[key];
                return (
                  <td key={key} className={`${cellClass} transition-colors`} style={getReturnCellStyle(value)}>
                    {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                  </td>
                );
              })}
              <td className={`${cellClass} transition-colors font-bold`} style={getReturnCellStyle(row.Total)}>
                {row.Total != null ? `${row.Total >= 0 ? '+' : ''}${row.Total.toFixed(1)}%` : '-'}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold bg-muted/50">
            <td className="py-2 px-1 sticky left-0 bg-muted/50">{probLabel}</td>
            {keys.map((key) => {
              const value = heatmap.winRate?.[key];
              return (
                <td key={key} className={`${cellClass} transition-colors font-bold`} style={getWinRateCellStyle(value)}>
                  {value != null ? `${value.toFixed(0)}%` : '-'}
                </td>
              );
            })}
            <td className={`${cellClass} transition-colors font-bold`} style={getWinRateCellStyle(heatmap.winRate?.Total)}>
              {heatmap.winRate?.Total != null ? `${heatmap.winRate.Total.toFixed(0)}%` : '-'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function buildStatGroup(avgs, bestIdx, worstIdx, best, worst, winRate, names, { bestLabel, worstLabel, winLabel }) {
  return [
    {
      label: bestLabel,
      value: best != null ? `${best >= 0 ? '+' : ''}${best.toFixed(1)}%` : '—',
      valueClass: 'text-emerald-500',
      sub: bestIdx >= 0 ? names[bestIdx] : '',
    },
    {
      label: worstLabel,
      value: worst != null ? `${worst >= 0 ? '+' : ''}${worst.toFixed(1)}%` : '—',
      valueClass: worst != null && worst < 0 ? 'text-red-500' : 'text-emerald-500',
      sub: worstIdx >= 0 ? names[worstIdx] : '',
    },
    {
      label: winLabel,
      value: winRate != null ? `${winRate}%` : '—',
      valueClass: winRate != null && winRate >= 50 ? 'text-emerald-500' : 'text-red-500',
      sub: `${avgs.filter((v) => v > 0).length}/${avgs.length} pos`,
    },
  ];
}

export function ChartSeasonalityPanel({ quarterlyHeatmap, monthlyHeatmap, symbol }) {
  const t = useTranslations("chartSeasonality");
  if (quarterlyHeatmap.rows.length === 0 && monthlyHeatmap.rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-xs text-muted-foreground py-6 text-center">
          {t("unavailable", { symbol })}
        </CardContent>
      </Card>
    );
  }

  const qAvgs = [1, 2, 3, 4]
    .map((q) => quarterlyHeatmap.average?.[`Q${q}`])
    .filter((v) => typeof v === 'number' && !isNaN(v));
  const mAvgs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    .map((m) => monthlyHeatmap.average?.[`M${m}`])
    .filter((v) => typeof v === 'number' && !isNaN(v));
  const bestQIdx = qAvgs.length ? qAvgs.indexOf(Math.max(...qAvgs)) : -1;
  const worstQIdx = qAvgs.length ? qAvgs.indexOf(Math.min(...qAvgs)) : -1;
  const bestQ = bestQIdx >= 0 ? qAvgs[bestQIdx] : null;
  const worstQ = worstQIdx >= 0 ? qAvgs[worstQIdx] : null;
  const qWinRate = qAvgs.length ? Math.round((qAvgs.filter((v) => v > 0).length / qAvgs.length) * 100) : null;
  const bestMIdx = mAvgs.length ? mAvgs.indexOf(Math.max(...mAvgs)) : -1;
  const worstMIdx = mAvgs.length ? mAvgs.indexOf(Math.min(...mAvgs)) : -1;
  const bestM = bestMIdx >= 0 ? mAvgs[bestMIdx] : null;
  const worstM = worstMIdx >= 0 ? mAvgs[worstMIdx] : null;
  const mWinRate = mAvgs.length ? Math.round((mAvgs.filter((v) => v > 0).length / mAvgs.length) * 100) : null;
  const qNames = ['Q1', 'Q2', 'Q3', 'Q4'];

  const qGroup = buildStatGroup(qAvgs, bestQIdx, worstQIdx, bestQ, worstQ, qWinRate, qNames, {
    bestLabel: t("bestAvg"),
    worstLabel: t("worstAvg"),
    winLabel: t("qWinRate"),
  });
  const mGroup = buildStatGroup(mAvgs, bestMIdx, worstMIdx, bestM, worstM, mWinRate, MONTH_NAMES, {
    bestLabel: t("bestAvg"),
    worstLabel: t("worstAvg"),
    winLabel: t("mWinRate"),
  });

  return (
    <div className="space-y-3">
      {(bestQ != null || bestM != null) && (
        <div className="grid grid-cols-3 gap-2">
          {qGroup.map((stat) => (
            <SeasonalityStatCard key={stat.label} {...stat} />
          ))}
        </div>
      )}
      {mAvgs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {mGroup.map((stat) => (
            <SeasonalityStatCard key={stat.label} {...stat} />
          ))}
        </div>
      )}

      <Accordion type="multiple" defaultValue={['quarterly', 'monthly']}>
        <AccordionItem value="quarterly" className="border-b-0">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {t("quarterlyReturns")}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <HeatmapTable
              periods={QUARTER_KEYS}
              heatmap={quarterlyHeatmap}
              textClass="text-2xs"
              padClass="px-2"
              wrapClass="overflow-x-auto -mx-4 px-4"
              yearLabel={t("year")}
              totalLabel={t("total")}
              avgLabel={t("avg")}
              probLabel={t("prob")}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="monthly" className="border-b-0">
          <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
            {t("monthlyReturns")}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <HeatmapTable
              periods={MONTH_KEYS}
              heatmap={monthlyHeatmap}
              textClass="text-3xs"
              padClass="px-1"
              wrapClass="overflow-x-auto"
              yearLabel={t("year")}
              totalLabel={t("total")}
              avgLabel={t("avg")}
              probLabel={t("prob")}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
