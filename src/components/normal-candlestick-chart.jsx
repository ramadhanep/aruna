"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadLightweightCharts } from "@/lib/lightweight-charts-loader";
import { ArunaWatermark } from "@/components/aruna-watermark";

export function NormalCandlestickChart({
  candles = [],
  ema = [],
  meta = {},
  height = 280,
  markers = [],
  formatTimestamp,
  currency,
  isDark = false,
  showTimeScale = false,
  showSeconds = false,
  formatPrice,
  emaColor = "#0ea5e9",
  livermoreKey = { upper: [], lower: [] },
  showLivermoreKey = true,
  livermoreUpperColor = "#f97316",
  livermoreLowerColor = "#6b7280",
  valueLabelPrefix = "",
  showTooltip = true,
  priceScaleType = "linear",
  seriesType = "candlestick", // 'candlestick' | 'line'
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const livermoreUpperSeriesRef = useRef(null);
  const livermoreLowerSeriesRef = useRef(null);
  const crosshairHandlerRef = useRef(null);
  const metaRef = useRef(meta);
  const markersRef = useRef(markers);
  const markersPluginRef = useRef(null);
  const candlesRef = useRef(candles);
  const emaRef = useRef(ema);
  const livermoreRef = useRef(livermoreKey);
  const priceScaleModeRef = useRef(null);
  const priceScaleTypeRef = useRef(priceScaleType);
  const supportsStepLineRef = useRef(true);
  const [hoveredTime, setHoveredTime] = useState(null);

  const fallbackMeta = useMemo(() => {
    if (!candles.length) return null;
    const lastTime = candles[candles.length - 1].time;
    return meta?.[lastTime] ?? null;
  }, [candles, meta]);
  const hoveredMeta = hoveredTime != null ? meta?.[hoveredTime] ?? null : null;
  const tooltipData = hoveredMeta ?? fallbackMeta ?? null;

  const buildLivermoreStepData = (data = []) => {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    if (supportsStepLineRef.current || data.length === 1) {
      return data;
    }
    const stepped = [];
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      if (!point || typeof point.time !== "number" || typeof point.value !== "number") {
        continue;
      }
      const current = { time: point.time, value: point.value };
      if (i > 0) {
        const prev = data[i - 1];
        if (prev && typeof prev.time === "number" && typeof prev.value === "number") {
          const gap = current.time - prev.time;
          if (gap > 1) {
            stepped.push({ time: current.time - 1, value: prev.value });
          }
        }
      }
      stepped.push(current);
    }
    return stepped;
  };

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    markersRef.current = Array.isArray(markers) ? markers : [];
    if (markersPluginRef.current) {
      markersPluginRef.current.setMarkers(markersRef.current);
    } else if (
      candleSeriesRef.current &&
      typeof candleSeriesRef.current.setMarkers === "function"
    ) {
      candleSeriesRef.current.setMarkers(markersRef.current);
    }
  }, [markers]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    emaRef.current = ema;
  }, [ema]);

  useEffect(() => {
    livermoreRef.current = livermoreKey;
  }, [livermoreKey]);

  const axisPriceFormatter = (price) => {
    const value = Number(price);
    if (!Number.isFinite(value)) return String(price ?? '');
    const abs = Math.abs(value);
    const maxFractionDigits = abs > 0 && abs < 0.01 ? 6 : 2;
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits,
    });
  };

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;
    let observedElement = null;

    loadLightweightCharts().then(
      ({
        createChart,
        CrosshairMode,
        CandlestickSeries,
        LineSeries,
        LineType,
        PriceScaleMode,
        createSeriesMarkers,
      }) => {
        if (cancelled || !containerRef.current) return;

        const container = containerRef.current;
        priceScaleModeRef.current = PriceScaleMode;
        const initialScaleMode =
          priceScaleTypeRef.current === "log"
            ? PriceScaleMode.Logarithmic
            : PriceScaleMode.Normal;
        const chart = createChart(container, {
          width: container.clientWidth,
          height,
          layout: {
            background: { color: "transparent" },
            textColor: isDark ? "#cbd5f5" : "#0f172a",
            fontSize: 11,
          },
        localization: {
          priceFormatter: axisPriceFormatter,
        },
        grid: {
          horzLines: {
            color: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.06)",
          },
          vertLines: {
            visible: false,
          },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            width: 1,
            color: isDark ? "rgba(248, 250, 252, 0.25)" : "rgba(15, 23, 42, 0.45)",
            labelBackgroundColor: isDark ? "rgba(15, 118, 110, 0.8)" : "rgba(14, 116, 144, 0.8)",
          },
          horzLine: {
            color: isDark ? "rgba(248, 250, 252, 0.25)" : "rgba(15, 23, 42, 0.35)",
            labelBackgroundColor: isDark ? "rgba(15, 118, 110, 0.8)" : "rgba(14, 116, 144, 0.8)",
          },
        },
        rightPriceScale: {
          borderVisible: true,
          borderColor: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(15, 23, 42, 0.12)",
          scaleMargins: { top: 0.1, bottom: 0.15 },
          mode: initialScaleMode,
        },
        timeScale: {
          borderColor: isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(15, 23, 42, 0.1)",
          timeVisible: showTimeScale,
          secondsVisible: showSeconds,
        },
        watermark: {
          visible: false,
        },
      });

        const isLineMode = seriesType === 'line';

        let candlestickSeries;
        if (isLineMode) {
          candlestickSeries = chart.addSeries(LineSeries, {
            color: "#10b981",
            lineWidth: 2,
            priceLineVisible: true,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
          });
        } else {
          candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: "#10b981",
            borderUpColor: "#10b981",
            wickUpColor: "#10b981",
            downColor: "#ef4444",
            borderDownColor: "#ef4444",
            wickDownColor: "#ef4444",
          });
        }

        const emaSeries = chart.addSeries(LineSeries, {
          color: emaColor,
          lineWidth: 1.5,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const supportsStepLine = Boolean(LineType?.WithSteps);
        supportsStepLineRef.current = supportsStepLine;
        if (!supportsStepLine) {
          console.warn("lightweight-charts missing step line support, falling back to manual step builder");
        }
        const livermoreUpperSeries = chart.addSeries(LineSeries, {
          color: livermoreUpperColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          lineType: supportsStepLine ? LineType.WithSteps : undefined,
          visible: showLivermoreKey,
        });
        const livermoreLowerSeries = chart.addSeries(LineSeries, {
          color: livermoreLowerColor,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          lineType: supportsStepLine ? LineType.WithSteps : undefined,
          visible: showLivermoreKey,
        });

        candleSeriesRef.current = candlestickSeries;
        emaSeriesRef.current = emaSeries;
        livermoreUpperSeriesRef.current = livermoreUpperSeries;
        livermoreLowerSeriesRef.current = livermoreLowerSeries;
        markersPluginRef.current = null;
        chartRef.current = chart;
        if (Array.isArray(candlesRef.current) && candlesRef.current.length > 0) {
          if (isLineMode) {
            const lineData = candlesRef.current.map(c => ({ time: c.time, value: c.close }));
            candlestickSeries.setData(lineData);
          } else {
            candlestickSeries.setData(candlesRef.current);
          }
          chart.timeScale().resetTimeScale();
        }
        if (typeof candlestickSeries.setMarkers === "function") {
          candlestickSeries.setMarkers(markersRef.current);
        }
        if (Array.isArray(emaRef.current) && emaRef.current.length > 0) {
          emaSeries.setData(emaRef.current);
        }
        const initialLivermore = livermoreRef.current ?? {};
        const initialUpperRaw = Array.isArray(initialLivermore.upper) ? initialLivermore.upper : [];
        const initialLowerRaw = Array.isArray(initialLivermore.lower) ? initialLivermore.lower : [];
        const initialUpper = buildLivermoreStepData(initialUpperRaw);
        const initialLower = buildLivermoreStepData(initialLowerRaw);
        if (initialUpper.length > 0) {
          livermoreUpperSeries.setData(initialUpper);
        }
        if (initialLower.length > 0) {
          livermoreLowerSeries.setData(initialLower);
        }
        if (
          typeof candlestickSeries.setMarkers !== "function" &&
          typeof createSeriesMarkers === "function"
        ) {
          try {
            markersPluginRef.current = createSeriesMarkers(candlestickSeries, markersRef.current);
            markersPluginRef.current.setMarkers(markersRef.current);
          } catch (error) {
            console.warn("Failed to initialize series markers", error);
            markersPluginRef.current = null;
          }
        }

      const handleCrosshairMove = (param) => {
        if (!param || param.time == null) {
          setHoveredTime(null);
          return;
        }
        const timeKey = typeof param.time === "number" ? param.time : null;
        if (timeKey && metaRef.current?.[timeKey]) {
          setHoveredTime(timeKey);
        } else {
          setHoveredTime(null);
        }
      };

      chart.subscribeCrosshairMove(handleCrosshairMove);
      crosshairHandlerRef.current = handleCrosshairMove;

      resizeObserver = new ResizeObserver((entries) => {
        const width = entries?.[0]?.contentRect?.width;
        if (width) {
          chart.applyOptions({ width });
        }
      }
    );
      resizeObserver.observe(container);
      observedElement = container;
    });

    return () => {
      cancelled = true;
      if (resizeObserver && observedElement) {
        resizeObserver.unobserve(observedElement);
      }
      if (chartRef.current && crosshairHandlerRef.current) {
        chartRef.current.unsubscribeCrosshairMove(crosshairHandlerRef.current);
      }
      if (markersPluginRef.current?.detach) {
        markersPluginRef.current.detach();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      emaSeriesRef.current = null;
      livermoreUpperSeriesRef.current = null;
      livermoreLowerSeriesRef.current = null;
      crosshairHandlerRef.current = null;
      markersPluginRef.current = null;
    };
  }, [
    height,
    isDark,
    showSeconds,
    showTimeScale,
    emaColor,
    livermoreUpperColor,
    livermoreLowerColor,
    showLivermoreKey,
    seriesType,
  ]);

  useEffect(() => {
    priceScaleTypeRef.current = priceScaleType;
    if (!chartRef.current || !priceScaleModeRef.current) return;
    const PriceScaleMode = priceScaleModeRef.current;
    const scale = chartRef.current.priceScale("right");
    scale.applyOptions({
      mode: priceScaleType === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [priceScaleType]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.setData(candles);
    chartRef.current?.timeScale();
  }, [candles]);

  useEffect(() => {
    if (!emaSeriesRef.current) return;
    emaSeriesRef.current.setData(ema);
  }, [ema]);

  useEffect(() => {
    if (!livermoreUpperSeriesRef.current || !livermoreLowerSeriesRef.current) return;
    const upperData = buildLivermoreStepData(
      Array.isArray(livermoreKey?.upper) ? livermoreKey.upper : []
    );
    const lowerData = buildLivermoreStepData(
      Array.isArray(livermoreKey?.lower) ? livermoreKey.lower : []
    );
    livermoreUpperSeriesRef.current.setData(showLivermoreKey ? upperData : []);
    livermoreLowerSeriesRef.current.setData(showLivermoreKey ? lowerData : []);
    if (livermoreUpperSeriesRef.current.applyOptions) {
      livermoreUpperSeriesRef.current.applyOptions({
        visible: showLivermoreKey,
        color: livermoreUpperColor,
      });
    }
    if (livermoreLowerSeriesRef.current.applyOptions) {
      livermoreLowerSeriesRef.current.applyOptions({
        visible: showLivermoreKey,
        color: livermoreLowerColor,
      });
    }
  }, [livermoreKey, livermoreUpperColor, livermoreLowerColor, showLivermoreKey]);

  const formatValue = (value) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    return formatPrice ? formatPrice(value) : value.toLocaleString();
  };

  const formattedTimestamp = tooltipData?.timestamp
    ? formatTimestamp?.(tooltipData.timestamp) ??
      new Date(tooltipData.timestamp).toLocaleString()
    : null;

  const pct = typeof tooltipData?.changePct === "number" ? tooltipData.changePct : null;

  const formatLabel = (label) => (valueLabelPrefix ? `${valueLabelPrefix} ${label}` : label);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      <ArunaWatermark className="absolute inset-0 flex items-end justify-start bottom-10 left-4" />
      {showTooltip && tooltipData ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-background/95 px-3 py-2 text-2xs">
          <div className="flex items-center justify-between gap-3 text-1xs font-semibold">
            <span className="truncate">{formattedTimestamp}</span>
            {currency ? <span className="text-muted-foreground uppercase">{currency}</span> : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs uppercase text-muted-foreground">
                {formatLabel("O")}
              </span>
              <span className="font-medium">{formatValue(tooltipData.open)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs uppercase text-muted-foreground">
                {formatLabel("H")}
              </span>
              <span className="font-medium">{formatValue(tooltipData.high)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs uppercase text-muted-foreground">
                {formatLabel("L")}
              </span>
              <span className="font-medium">{formatValue(tooltipData.low)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs uppercase text-muted-foreground">
                {formatLabel("C")}
              </span>
              <span className="font-medium">{formatValue(tooltipData.close)}</span>
            </div>
            <div className="col-span-2 flex items-center justify-between gap-2 border-t border-dashed border-border/20 pt-1">
              <span className="text-2xs uppercase text-muted-foreground">EMA 31</span>
              <span className="font-semibold" style={{ color: emaColor }}>
                {formatValue(tooltipData.ema31)}
              </span>
            </div>
            {showLivermoreKey && tooltipData?.livermoreUpper != null ? (
              <div className="col-span-2 flex items-center justify-between gap-2 border-t border-dashed border-border/20 pt-1">
                <span className="text-2xs uppercase text-muted-foreground">Livermore Upper</span>
                <span className="font-semibold" style={{ color: livermoreUpperColor }}>
                  {formatValue(tooltipData.livermoreUpper)}
                </span>
              </div>
            ) : null}
            {showLivermoreKey && tooltipData?.livermoreLower != null ? (
              <div className="col-span-2 flex items-center justify-between gap-2 border-t border-dashed border-border/20 pt-1">
                <span className="text-2xs uppercase text-muted-foreground">Livermore Lower</span>
                <span className="font-semibold" style={{ color: livermoreLowerColor }}>
                  {formatValue(tooltipData.livermoreLower)}
                </span>
              </div>
            ) : null}
            {pct != null ? (
              <div
                className={`col-span-2 text-right text-1xs font-semibold ${
                  pct >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {pct >= 0 ? "+" : ""}
                {pct.toFixed(2)}%
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
