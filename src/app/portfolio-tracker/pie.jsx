"use client";

import React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useTheme } from 'next-themes';

export function PortfolioPie({ digitalUSD, cashUSD, holdingsDistribution = [], currency = 'USD', idrPerUsd = 0, sgdPerUsd = 0 }) {
  const toDisplay = (usd) => {
    if (currency === 'IDR' && idrPerUsd > 0) return usd * idrPerUsd;
    if (currency === 'SGD' && sgdPerUsd > 0) return usd * sgdPerUsd;
    return usd;
  };

  const displaySuffix = currency === 'IDR' ? 'IDR' : currency === 'SGD' ? 'SGD' : 'USD';
  const digital = Math.max(digitalUSD, 0);
  const cash = Math.max(cashUSD, 0);

  const assetTypeData = [
    { key: 'digital', name: 'Digital Assets', value: toDisplay(digital), raw: digital, fill: 'var(--color-digital)' },
    { key: 'cash', name: 'Total Cash', value: toDisplay(cash), raw: cash, fill: 'var(--color-cash)' },
  ];
  const assetSum = assetTypeData.reduce((s, d) => s + d.value, 0) || 1;

  const holdingsData = holdingsDistribution.map((h, i) => ({
    ...h,
    value: toDisplay(h.value),
    fill: h.fill || `hsl(var(--chart-${(i % 5) + 1}))`
  }));
  const holdingsSum = holdingsData.reduce((s, d) => s + d.value, 0) || 1;

  const { resolvedTheme } = useTheme();

  const config = {
    digital: { label: 'Digital Assets', color: 'oklch(59.6% 0.145 163.225)' },
    cash: { label: 'Total Cash', color: (resolvedTheme === 'dark') ? '#F9F9F9F9' : '#333333' },
  };

  // Add holding-specific colors to config if needed, though Cell fill is direct
  holdingsData.forEach((h, i) => {
    config[`holding-${i}`] = { label: h.name, color: h.fill };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Asset Type Chart */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Asset Type Distribution</p>
        <ChartContainer config={config} className="w-full h-48">
          <PieChart margin={{ top: 8, right: 16, bottom: 28, left: 16 }}>
            <Pie
              data={assetTypeData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
              paddingAngle={2}
            >
              {assetTypeData.map((entry, index) => (
                <Cell key={`cell-asset-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(val, name, item) => {
                const pct = ((item?.value || 0) / assetSum) * 100;
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{item?.name}</span>
                    <span className="font-mono">{val.toLocaleString()} {displaySuffix} · {pct.toFixed(1)}%</span>
                  </div>
                );
              }} />} />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px]">
          {assetTypeData.map((item) => {
            const pct = (item.value / assetSum) * 100;
            return (
              <div key={item.key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full border-t border-border/20" />

      {/* Holdings Chart */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Holdings Distribution</p>
        <ChartContainer config={config} className="w-full h-52">
          <PieChart margin={{ top: 8, right: 16, bottom: 28, left: 16 }}>
            <Pie
              data={holdingsData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
              paddingAngle={2}
            >
              {holdingsData.map((entry, index) => (
                <Cell key={`cell-holding-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(val, name, item) => {
                const pct = ((item?.value || 0) / holdingsSum) * 100;
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{item?.name}</span>
                    <span className="font-mono">{val.toLocaleString()} {displaySuffix} · {pct.toFixed(1)}%</span>
                  </div>
                );
              }} />} />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] mt-2">
          {holdingsData.map((item, i) => {
            const pct = (item.value / holdingsSum) * 100;
            return (
              <div key={`legend-${i}`} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="font-medium text-foreground">{item.name}</span>
                <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
