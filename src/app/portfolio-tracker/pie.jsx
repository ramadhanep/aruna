"use client";

import React from 'react';
import { Pie, PieChart, Cell, Tooltip, Legend } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export function PortfolioPie({ netWorthUSD, digitalUSD, cashUSD, currency = 'USD', idrPerUsd = 0 }) {
  const toDisplay = (usd) => {
    if (currency === 'IDR' && idrPerUsd > 0) return usd * idrPerUsd;
    return usd;
  };
  const displaySuffix = currency === 'IDR' ? 'IDR' : 'USD';
  const netWorth = Math.max(netWorthUSD, 0);
  const digital = Math.max(digitalUSD, 0);
  const cash = Math.max(cashUSD, 0);
  const data = [
    { key: 'net', name: 'Total Net Worth', value: toDisplay(netWorth), raw: netWorth, fill: 'var(--color-net)' },
    { key: 'digital', name: 'Total Digital Assets', value: toDisplay(digital), raw: digital, fill: 'var(--color-digital)' },
    { key: 'cash', name: 'Total Cash', value: toDisplay(cash), raw: cash, fill: 'var(--color-cash)' },
  ];
  const sumDisplay = data.reduce((s, d) => s + d.value, 0) || 1;

  const config = {
    net: { label: 'Total Net Worth', color: 'oklch(59.6% 0.145 163.225)' },
    digital: { label: 'Total Digital Assets', color: 'oklch(48.8% 0.243 264.376)' },
    cash: { label: 'Total Cash', color: 'oklch(66.6% 0.179 58.318)' },
  };

  return (
    <ChartContainer config={config} className="aspect-[16/9] min-h-80 max-w-full">
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
        <Legend
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ paddingTop: 10 }}
          formatter={(value, entry, idx) => {
            const item = data[idx];
            const pct = item ? ((item.value / sumDisplay) * 100).toFixed(1) : '0.0';
            return (
              <span style={{ display: 'inline-block', margin: '6px 12px' }}>{value} ({pct}%)</span>
            );
          }}
        />
      </PieChart>
    </ChartContainer>
  );
}
