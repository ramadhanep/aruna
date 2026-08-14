"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchEncodedJson } from '@/lib/api-client';
import {
  NORMAL_TIMEFRAME_OPTIONS,
  INTRADAY_TIMEFRAMES,
  EMA_PERIOD,
  BUY_SIGNAL_COLOR,
  LIVERMORE_LOOKBACK,
  calculateEMA,
  computeStochasticRSI,
  computeLivermoreKeyLevels,
} from '@/lib/chart-helpers';

export function useChartSeries(symbol, isNormalView, screeningSignal) {
  const [normalTimeframe, setNormalTimeframe] = useState('D');
  const [normalSeries, setNormalSeries] = useState([]);
  const [normalSeriesLoading, setNormalSeriesLoading] = useState(false);
  const [normalSeriesError, setNormalSeriesError] = useState(null);
  const [scaleChoice, setScaleChoice] = useState('linear');
  const [showLivermoreKey, setShowLivermoreKey] = useState(false);
  const [chartDisplayType, setChartDisplayType] = useState('heikinAshi');
  const [normalFullscreenOpen, setNormalFullscreenOpen] = useState(false);

  const isIntradayTimeframe = INTRADAY_TIMEFRAMES.has(normalTimeframe);
  const normalTimeframeOption = useMemo(
    () => NORMAL_TIMEFRAME_OPTIONS.find((option) => option.value === normalTimeframe),
    [normalTimeframe]
  );
  const normalTimeframeLabel = normalTimeframeOption?.label ?? normalTimeframe.toUpperCase();

  const abortRef = useRef(null);

  // `silent` refreshes update the series in place without toggling the loading
  // state — used by the live intraday polling so the chart never flickers.
  const loadSeries = useCallback(
    async ({ silent = false } = {}) => {
      if (!symbol || !isNormalView) {
        setNormalSeriesLoading(false);
        return;
      }
      if (!silent) {
        setNormalSeriesLoading(true);
        setNormalSeriesError(null);
        setNormalSeries([]);
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({ symbol, timeframe: normalTimeframe });
        const { response, data } = await fetchEncodedJson(`/api/price-series?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load price data');
        }
        setNormalSeries(Array.isArray(data?.data) ? data.data : []);
        setNormalSeriesError(null);
      } catch (error) {
        if (error.name === 'AbortError' || controller.signal.aborted) return;
        if (silent) return;
        setNormalSeries([]);
        setNormalSeriesError(error.message || 'Failed to load price data');
      } finally {
        if (!silent) {
          setNormalSeriesLoading(false);
        }
      }
    },
    [symbol, normalTimeframe, isNormalView]
  );

  useEffect(() => {
    if (!symbol || !isNormalView) {
      queueMicrotask(() => setNormalSeriesLoading(false));
      return;
    }

    queueMicrotask(() => loadSeries({ silent: false }));
    return () => {
      abortRef.current?.abort();
    };
  }, [symbol, isNormalView, loadSeries]);

  // Live intraday refresh: silent polling every minute while visible. Matches
  // the price-series cache TTL for intraday timeframes (60 s) so each poll
  // returns fresh data. Skipped for daily/weekly/monthly (candles only change
  // once per period) and paused when the tab is hidden.
  useEffect(() => {
    if (!symbol || !isNormalView || !isIntradayTimeframe) {
      return;
    }

    let timer = null;
    let polling = false;

    const tick = async () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      if (polling) {
        return;
      }
      polling = true;
      try {
        await loadSeries({ silent: true });
      } catch {
        // silent refresh never surfaces errors — keep the last good chart
      } finally {
        polling = false;
      }
    };

    timer = setInterval(tick, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [symbol, normalTimeframe, isNormalView, isIntradayTimeframe, loadSeries]);

  useEffect(() => {
    if (!isNormalView && normalFullscreenOpen) {
      queueMicrotask(() => setNormalFullscreenOpen(false));
    }
  }, [isNormalView, normalFullscreenOpen]);

  const filteredNormalChartData = useMemo(() => {
    if (!isNormalView || !Array.isArray(normalSeries) || normalSeries.length === 0) {
      return [];
    }
    const sorted = [...normalSeries]
      .filter(
        (point) =>
          point &&
          typeof point.timestamp === 'number' &&
          Number.isFinite(point.timestamp)
      )
      .sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length === 0) return [];

    const baseTimestamp = sorted[0].timestamp;
    let prevHeikinOpen = null;
    let prevHeikinClose = null;

    const normalizedPoints = [];

    sorted.forEach((point) => {
      const close =
        typeof point.close === 'number' && Number.isFinite(point.close)
          ? point.close
          : typeof point.price === 'number' && Number.isFinite(point.price)
            ? point.price
            : null;
      if (close == null) {
        return;
      }

      const open =
        typeof point.open === 'number' && Number.isFinite(point.open) ? point.open : close;
      const high =
        typeof point.high === 'number' && Number.isFinite(point.high)
          ? point.high
          : Math.max(open, close);
      const low =
        typeof point.low === 'number' && Number.isFinite(point.low)
          ? point.low
          : Math.min(open, close);

      const heikinClose = (open + high + low + close) / 4;
      const heikinOpen =
        prevHeikinOpen == null || prevHeikinClose == null
          ? (open + close) / 2
          : (prevHeikinOpen + prevHeikinClose) / 2;
      const heikinHigh = Math.max(high, heikinOpen, heikinClose);
      const heikinLow = Math.min(low, heikinOpen, heikinClose);
      prevHeikinOpen = heikinOpen;
      prevHeikinClose = heikinClose;

      normalizedPoints.push({
        timestamp: point.timestamp,
        elapsed: point.timestamp - baseTimestamp,
        price: close,
        open,
        high,
        low,
        close,
        interpolated: false,
        volume:
          typeof point.volume === 'number' && Number.isFinite(point.volume)
            ? point.volume
            : null,
        heikinOpen,
        heikinHigh,
        heikinLow,
        heikinClose,
      });
    });

    if (normalizedPoints.length === 0) {
      return [];
    }

    const closingPrices = normalizedPoints.map((point) => point.close);
    const ema20Series = calculateEMA(closingPrices, EMA_PERIOD);

    return normalizedPoints.map((point, index) => {
      const ema20 = Number.isFinite(ema20Series[index]) ? ema20Series[index] : point.close;
      const changePct = null;
      return {
        ...point,
        changePct,
        ema20,
      };
    });
  }, [isNormalView, normalSeries]);

  const normalCandlestickSeries = useMemo(() => {
    if (!isNormalView || filteredNormalChartData.length === 0) {
      return {
        candles: [],
        ema: [],
        livermore: { upper: [], lower: [] },
        meta: {},
        stochastic: { k: [], d: [] },
        chartDisplayType,
      };
    }
    const candles = [];
    const ema = [];
    const meta = {};
    const livermoreSource = [];
    const closingValues = filteredNormalChartData.map((point) => {
      if (typeof point.close === 'number' && Number.isFinite(point.close)) {
        return point.close;
      }
      if (typeof point.price === 'number' && Number.isFinite(point.price)) {
        return point.price;
      }
      return null;
    });
    const stochasticValues = computeStochasticRSI(closingValues, 14, 14, 3, 3);
    const stochasticK = [];
    const stochasticD = [];
    filteredNormalChartData.forEach((point, index) => {
      if (typeof point.timestamp !== 'number') return;
      const time = Math.floor(point.timestamp / 1000);
      if (!Number.isFinite(time)) return;
      const actualOpen =
        typeof point.open === 'number' && Number.isFinite(point.open) ? point.open : point.price;
      const actualClose =
        typeof point.close === 'number' && Number.isFinite(point.close) ? point.close : point.price;
      const actualHigh =
        typeof point.high === 'number' && Number.isFinite(point.high)
          ? point.high
          : Math.max(actualOpen, actualClose);
      const actualLow =
        typeof point.low === 'number' && Number.isFinite(point.low)
          ? point.low
          : Math.min(actualOpen, actualClose);

      let open, close, high, low;
      if (chartDisplayType === 'heikinAshi') {
        open = typeof point.heikinOpen === 'number' && Number.isFinite(point.heikinOpen) ? point.heikinOpen : actualOpen;
        close = typeof point.heikinClose === 'number' && Number.isFinite(point.heikinClose) ? point.heikinClose : actualClose;
        high = typeof point.heikinHigh === 'number' && Number.isFinite(point.heikinHigh) ? point.heikinHigh : actualHigh;
        low = typeof point.heikinLow === 'number' && Number.isFinite(point.heikinLow) ? point.heikinLow : actualLow;
      } else {
        open = actualOpen;
        close = actualClose;
        high = actualHigh;
        low = actualLow;
      }

      candles.push({ time, open, high, low, close });
      if (typeof point.ema20 === 'number' && Number.isFinite(point.ema20)) {
        ema.push({ time, value: point.ema20 });
      } else {
        ema.push({ time, value: close });
      }
      livermoreSource.push({ time, high: actualHigh, low: actualLow });
      meta[time] = {
        timestamp: point.timestamp,
        open,
        high,
        low,
        close,
        actualOpen,
        actualHigh,
        actualLow,
        actualClose,
        ema20:
          typeof point.ema20 === 'number' && Number.isFinite(point.ema20) ? point.ema20 : close,
        livermoreUpper: null,
        livermoreLower: null,
        changePct:
          typeof point.changePct === 'number' && Number.isFinite(point.changePct)
            ? point.changePct
            : null,
      };

      const kValue = stochasticValues.k[index];
      const dValue = stochasticValues.d[index];
      if (Number.isFinite(kValue)) {
        stochasticK.push({ time, value: Number(kValue.toFixed(2)) });
      }
      if (Number.isFinite(dValue)) {
        stochasticD.push({ time, value: Number(dValue.toFixed(2)) });
      }
    });

    const livermoreLevels = computeLivermoreKeyLevels(livermoreSource, LIVERMORE_LOOKBACK);
    Object.entries(livermoreLevels.lookup).forEach(([timeKey, values]) => {
      if (!values) return;
      if (meta[timeKey]) {
        meta[timeKey].livermoreUpper = values.upper ?? null;
        meta[timeKey].livermoreLower = values.lower ?? null;
      }
    });

    return {
      candles,
      ema,
      livermore: { upper: livermoreLevels.upper, lower: livermoreLevels.lower },
      meta,
      stochastic: { k: stochasticK, d: stochasticD },
      chartDisplayType,
    };
  }, [filteredNormalChartData, isNormalView, chartDisplayType]);

  const normalChartReady = normalCandlestickSeries.candles.length > 0;

  const buySignalMarkers = useMemo(() => {
    if (
      !isNormalView ||
      !screeningSignal?.signal_date ||
      filteredNormalChartData.length === 0
    ) {
      return [];
    }
    const signalDate = new Date(screeningSignal.signal_date);
    if (Number.isNaN(signalDate.getTime())) {
      return [];
    }
    const signalMs = signalDate.getTime();
    let closest = null;
    let minDelta = Infinity;
    filteredNormalChartData.forEach((point) => {
      if (typeof point.timestamp !== 'number') return;
      const delta = Math.abs(point.timestamp - signalMs);
      if (delta < minDelta) {
        minDelta = delta;
        closest = Math.floor(point.timestamp / 1000);
      }
    });
    if (closest == null) {
      return [];
    }
    return [
      {
        time: closest,
        position: 'belowBar',
        shape: 'arrowUp',
        color: BUY_SIGNAL_COLOR,
        text: 'Buy',
      },
    ];
  }, [filteredNormalChartData, screeningSignal, isNormalView]);

  const stochasticChartData = useMemo(() => {
    const combined = new Map();
    (normalCandlestickSeries.stochastic?.k ?? []).forEach(({ time, value }) => {
      combined.set(time, { time, k: value });
    });
    (normalCandlestickSeries.stochastic?.d ?? []).forEach(({ time, value }) => {
      const merged = combined.get(time) ?? { time };
      merged.d = value;
      combined.set(time, merged);
    });
    const sorted = Array.from(combined.values()).sort((a, b) => a.time - b.time);
    return sorted.slice(-400);
  }, [normalCandlestickSeries.stochastic]);

  return {
    normalTimeframe,
    setNormalTimeframe,
    normalSeriesLoading,
    normalSeriesError,
    filteredNormalChartData,
    normalCandlestickSeries,
    normalChartReady,
    buySignalMarkers,
    stochasticChartData,
    isIntradayTimeframe,
    normalTimeframeLabel,
    scaleChoice,
    setScaleChoice,
    showLivermoreKey,
    setShowLivermoreKey,
    chartDisplayType,
    setChartDisplayType,
    normalFullscreenOpen,
    setNormalFullscreenOpen,
    normalTimeframeOption,
  };
}
