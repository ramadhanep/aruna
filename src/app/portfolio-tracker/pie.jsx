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
      {/* Asset Type Chart */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Asset Type Allocation</p>
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
        <div className="flex flex-wrap items-center justify-center gap-4 text-2xs">
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

      {/* Digital Asset Allocation Chart */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Digital Asset Allocation</p>
        <ChartContainer config={config} className="w-full h-52">
          <PieChart margin={{ top: 8, right: 16, bottom: 28, left: 16 }}>
            <Pie
              data={digitalData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
              paddingAngle={2}
            >
              {digitalData.map((entry, index) => (
                <Cell key={`cell-digital-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(val, name, item) => {
                const pct = ((item?.value || 0) / digitalSum) * 100;
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{item?.name}</span>
                    <span className="font-mono">{val.toLocaleString()} {displaySuffix} · {pct.toFixed(1)}%</span>
                  </div>
                );
              }} />} />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-2xs mt-2">
          {digitalData.map((item, i) => {
            const pct = (item.value / digitalSum) * 100;
            return (
              <div key={`legend-digital-${i}`} className="flex items-center gap-1.5">
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

      {/* Cash Type Allocation Chart */}
      <div className="w-full flex flex-col items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cash Type Allocation</p>
        <ChartContainer config={config} className="w-full h-52">
          <PieChart margin={{ top: 8, right: 16, bottom: 28, left: 16 }}>
            <Pie
              data={cashTypeData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
              paddingAngle={2}
            >
              {cashTypeData.map((entry, index) => (
                <Cell key={`cell-cashtype-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={(val, name, item) => {
                const pct = ((item?.value || 0) / cashTypeSum) * 100;
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{item?.name}</span>
                    <span className="font-mono">{val.toLocaleString()} {displaySuffix} · {pct.toFixed(1)}%</span>
                  </div>
                );
              }} />} />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-2xs mt-2">
          {cashTypeData.map((item, i) => {
            const pct = (item.value / cashTypeSum) * 100;
            return (
              <div key={`legend-cashtype-${i}`} className="flex items-center gap-1.5">
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Holdings Allocation</p>
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
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-2xs mt-2">
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
