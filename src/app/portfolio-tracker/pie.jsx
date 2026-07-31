"use client";

import React from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useTheme } from 'next-themes';
import { getStableColorFromLabel } from '@/lib/utils';

function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rr:
        h = ((gg - bb) / delta) % 6;
        break;
      case gg:
        h = (bb - rr) / delta + 2;
        break;
      default:
        h = (rr - gg) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToCss(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function normalizeLogoColor(r, g, b, theme) {
  const { h, s, l } = rgbToHsl(r, g, b);
  const normalizedS = Math.min(Math.max(s, 38), 82);
  const normalizedL = theme === 'dark'
    ? Math.min(Math.max(l, 46), 72)
    : Math.min(Math.max(l, 34), 62);
  return hslToCss(h, normalizedS, normalizedL);
}

async function extractLogoColor(url, theme) {
  if (!url || typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let totalWeight = 0;
        let rAcc = 0;
        let gAcc = 0;
        let bAcc = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 40) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturationWeight = Math.max(max - min, 24);
          const weight = saturationWeight * (alpha / 255);
          totalWeight += weight;
          rAcc += r * weight;
          gAcc += g * weight;
          bAcc += b * weight;
        }

        if (totalWeight <= 0) {
          resolve(null);
          return;
        }

        const avgR = rAcc / totalWeight;
        const avgG = gAcc / totalWeight;
        const avgB = bAcc / totalWeight;
        resolve(normalizeLogoColor(avgR, avgG, avgB, theme));
      } catch (error) {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function PieSection({ title, data, sum, prefix, suffix, config, heightClass = 'h-52' }) {
  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <ChartContainer config={config} className={`w-full ${heightClass}`}>
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
              <Cell key={`cell-${prefix}-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent formatter={(val, name, item) => {
              const pct = ((item?.value || 0) / sum) * 100;
              return (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{item?.name}</span>
                  <span className="font-mono">{val.toLocaleString()} {suffix} · {pct.toFixed(1)}%</span>
                </div>
              );
            }} />}
          />
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-2xs mt-2">
        {data.map((item, i) => {
          const pct = (item.value / sum) * 100;
          return (
            <div key={`legend-${prefix}-${i}`} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PortfolioPie({
  digitalUSD,
  cashUSD,
  holdingsAllocation = [],
  digitalAllocation = [],
  cashTypeAllocation = [],
  currency = 'USD',
  idrPerUsd = 0,
  sgdPerUsd = 0
}) {
  const toDisplay = (usd) => {
    if (currency === 'IDR' && idrPerUsd > 0) return usd * idrPerUsd;
    if (currency === 'SGD' && sgdPerUsd > 0) return usd * sgdPerUsd;
    return usd;
  };

  const displaySuffix = currency === 'IDR' ? 'IDR' : currency === 'SGD' ? 'SGD' : 'USD';
  const digital = Math.max(digitalUSD, 0);
  const cash = Math.max(cashUSD, 0);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [logoColorMap, setLogoColorMap] = React.useState({});

  const getHarnessedColor = React.useCallback((label) => getStableColorFromLabel(label), []);

  const getCashTypeColor = React.useCallback((code, label) => {
    const currencyCode = String(code || '').toUpperCase();
    if (!currencyCode) {
      return getHarnessedColor(label);
    }

    const currencyLabel = `${currencyCode}:${String(label || '').trim()}`;
    return getHarnessedColor(currencyLabel);
  }, [getHarnessedColor]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const nextColorMap = {};
      for (const item of digitalAllocation) {
        const symbol = item?.symbol;
        const logo = item?.logo;
        if (!symbol || !logo) continue;
        const extracted = await extractLogoColor(logo, theme);
        if (extracted) {
          nextColorMap[symbol] = extracted;
        }
      }
      if (!cancelled) {
        setLogoColorMap(nextColorMap);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [digitalAllocation, theme]);

  const assetTypeData = [
    { key: 'digital', name: 'Digital Assets', value: toDisplay(digital), raw: digital, fill: 'var(--color-digital)' },
    { key: 'cash', name: 'Total Cash', value: toDisplay(cash), raw: cash, fill: 'var(--color-cash)' },
  ];
  const assetSum = assetTypeData.reduce((s, d) => s + d.value, 0) || 1;

  const holdingsData = holdingsAllocation.map((h) => ({
    ...h,
    value: toDisplay(h.value),
    fill: getHarnessedColor(h.name || h.symbol || h.key || 'holding')
  }));
  const holdingsSum = holdingsData.reduce((s, d) => s + d.value, 0) || 1;

  const digitalData = digitalAllocation.map((d) => ({
    ...d,
    value: toDisplay(d.value),
    fill: logoColorMap[d.symbol] || getHarnessedColor(d.name || d.symbol || 'digital-asset'),
  }));
  const digitalSum = digitalData.reduce((s, d) => s + d.value, 0) || 1;

  const cashTypeData = cashTypeAllocation.map((c) => ({
    ...c,
    value: toDisplay(c.value),
    fill: getCashTypeColor(c.name, c.name || c.code || 'cash-type'),
  }));
  const cashTypeSum = cashTypeData.reduce((s, d) => s + d.value, 0) || 1;

  const config = {
    digital: { label: 'Digital Assets', color: 'oklch(59.6% 0.145 163.225)' },
    cash: { label: 'Total Cash', color: (theme === 'dark') ? '#F9F9F9F9' : '#333333' },
  };

  // Add holding-specific colors to config if needed, though Cell fill is direct
  holdingsData.forEach((h, i) => {
    config[`holding-${i}`] = { label: h.name, color: h.fill };
  });
  digitalData.forEach((h, i) => {
    config[`digital-${i}`] = { label: h.name, color: h.fill };
  });
  cashTypeData.forEach((h, i) => {
    config[`cashType-${i}`] = { label: h.name, color: h.fill };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <PieSection title="Asset Type Allocation" data={assetTypeData} sum={assetSum} prefix="asset" suffix={displaySuffix} config={config} heightClass="h-48" />
      <div className="w-full border-t border-border/20" />
      <PieSection title="Digital Asset Allocation" data={digitalData} sum={digitalSum} prefix="digital" suffix={displaySuffix} config={config} />
      <div className="w-full border-t border-border/20" />
      <PieSection title="Cash Type Allocation" data={cashTypeData} sum={cashTypeSum} prefix="cashtype" suffix={displaySuffix} config={config} />
      <div className="w-full border-t border-border/20" />
      <PieSection title="Holdings Allocation" data={holdingsData} sum={holdingsSum} prefix="holding" suffix={displaySuffix} config={config} />
    </div>
  );
}
