"use client";

import React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useTheme } from 'next-themes';

export function PortfolioPie({ digitalUSD, cashUSD, currency = 'USD', idrPerUsd = 0 }) {
  const toDisplay = (usd) => {
    if (currency === 'IDR' && idrPerUsd > 0) return usd * idrPerUsd;
    return usd;
  };
  const displaySuffix = currency === 'IDR' ? 'IDR' : 'USD';
  const digital = Math.max(digitalUSD, 0);
  const cash = Math.max(cashUSD, 0);
  const data = [
    { key: 'digital', name: 'Digital Assets', value: toDisplay(digital), raw: digital, fill: 'var(--color-digital)' },
    { key: 'cash', name: 'Total Cash', value: toDisplay(cash), raw: cash, fill: 'var(--color-cash)' },
  ];
  const sumDisplay = data.reduce((s, d) => s + d.value, 0) || 1;

  const { resolvedTheme } = useTheme();

  const config = {
    digital: { label: 'Digital Assets', color: 'oklch(59.6% 0.145 163.225)' },
    cash: { label: 'Total Cash', color: (resolvedTheme === 'dark') ? '#F9F9F9F9' : '#333333' },
  };

  return (
    <div className="flex flex-col items-center">
      <ChartContainer config={config} className="w-full h-52">
        <PieChart margin={{ top: 8, right: 16, bottom: 28, left: 16 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            strokeWidth={2}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent formatter={(val, name, item) => {
              const pct = ((item?.value || 0) / sumDisplay) * 100;
              return (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{item?.name}</span>
                  <span className="font-mono">{val.toLocaleString()} {displaySuffix} · {pct.toFixed(1)}%</span>
                </div>
              );
            }} />} />
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        {data.map((item) => {
          const pct = (item.value / sumDisplay) * 100;
          return (
            <div key={item.key} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
