"use client";

import { useState, useEffect } from 'react';
import { fetchEncodedJson } from '@/lib/api-client';
import {
  computeDailyReturns,
  removeIncompleteYears,
  getElectionCycleLabel,
  hirschStyleSeasonalPattern,
  computeSingleYearPattern,
  forwardFillSingleYear,
  calculateMonthlyReturns,
  calculateQuarterlyReturns,
  formatMonthlyHeatmap,
  formatQuarterlyHeatmap,
} from '@/lib/seasonalData';
import { CURRENT_LINE_COLOR } from '@/lib/chart-helpers';

export function useChartData(symbol, selectedCycles, scaleChoice, baseLineColor = '#F9F9F9F9') {
  const [loading, setLoading] = useState(false);
  const [rawLinesData, setRawLinesData] = useState([]);
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {}, winRate: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {}, winRate: {} });

  useEffect(() => {
    let cancelled = false;

    async function fetchDataAndBuildChart() {
      setLoading(true);
      try {
        const startDate = Math.floor(new Date('1971-01-01').getTime() / 1000);
        const endDate = Math.floor(Date.now() / 1000);

        const { response, data } = await fetchEncodedJson(
          `/api/finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
        );

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch data');
        }

        let rawData = (data.data || []).map(row => ({
          date: row.date,
          adjclose: row.adjclose,
        }));

        rawData = rawData.filter(row => row.adjclose !== null);

        const currentYear = new Date().getFullYear();
        const histRaw = rawData.filter(row => new Date(row.date).getFullYear() < currentYear);
        const currentRaw = rawData.filter(row => new Date(row.date).getFullYear() === currentYear);

        let histDaily = computeDailyReturns(histRaw);
        histDaily = removeIncompleteYears(histDaily, 200);
        histDaily = histDaily.map(row => ({
          ...row,
          cycle: getElectionCycleLabel(row.year),
        }));

        const currentDaily = computeDailyReturns(currentRaw);
        const linesData = [];

        if (selectedCycles.includes('all') && histDaily.length > 0) {
          const firstYear = Math.min(...histDaily.map(r => r.year));
          const pattern = hirschStyleSeasonalPattern(histDaily);
          linesData.push({
            name: `All Years (${firstYear}-${currentYear - 1})`,
            key: 'allYears',
            data: pattern,
            color: baseLineColor,
          });
        }

        if (selectedCycles.includes('trump')) {
          const TRUMP_YEARS = [2017, 2018, 2019, 2020, 2025, 2026];
          const trumpData = histDaily.filter(r => TRUMP_YEARS.includes(r.year));
          if (trumpData.length > 0) {
            linesData.push({
              name: 'Trump Years',
              key: 'trumpYears',
              data: hirschStyleSeasonalPattern(trumpData),
              color: baseLineColor,
            });
          }
        }

        if (selectedCycles.includes('pre')) {
          const preData = histDaily.filter(r => r.cycle === 'Pre-Election Year');
          if (preData.length > 0) {
            linesData.push({
              name: 'Pre-Election Year',
              key: 'preElection',
              data: hirschStyleSeasonalPattern(preData),
              color: baseLineColor,
            });
          }
        }

        if (selectedCycles.includes('election')) {
          const elecData = histDaily.filter(r => r.cycle === 'Election Year');
          if (elecData.length > 0) {
            linesData.push({
              name: 'Election Year',
              key: 'election',
              data: hirschStyleSeasonalPattern(elecData),
              color: baseLineColor,
            });
          }
        }

        if (selectedCycles.includes('mid')) {
          const midData = histDaily.filter(r => r.cycle === 'Mid-Term Year');
          if (midData.length > 0) {
            linesData.push({
              name: 'Mid-Term Year',
              key: 'midTerm',
              data: hirschStyleSeasonalPattern(midData),
              color: baseLineColor,
            });
          }
        }

        if (selectedCycles.includes('post')) {
          const postData = histDaily.filter(r => r.cycle === 'Post-Election Year');
          if (postData.length > 0) {
            linesData.push({
              name: 'Post-Election Year',
              key: 'postElection',
              data: hirschStyleSeasonalPattern(postData),
              color: baseLineColor,
            });
          }
        }

        if (selectedCycles.includes('current') && currentDaily.length > 0) {
          let pattern = computeSingleYearPattern(currentDaily, currentYear);
          pattern = forwardFillSingleYear(pattern);
          if (pattern.length > 0) {
            linesData.push({
              name: `Current Year (${currentYear} YTD)`,
              key: 'current',
              data: pattern,
              color: CURRENT_LINE_COLOR,
            });
          }
        }

        if (cancelled) return;

        setRawLinesData(linesData);

        const symbolName = data.meta?.name || symbol;
        setAssetName(symbolName);

        let currentPrice = null;
        let startPrice = null;
        let predictedPrice = null;
        let predictedPct = null;
        let dailyChange = null;
        let dailyChangePct = null;

        if (rawData.length > 0) {
          currentPrice = rawData[rawData.length - 1].adjclose;
          if (rawData.length > 1) {
            const previousPrice = rawData[rawData.length - 2].adjclose;
            if (previousPrice != null) {
              dailyChange = currentPrice - previousPrice;
              if (previousPrice !== 0) {
                dailyChangePct = (dailyChange / previousPrice) * 100;
              }
            }
          }
        }

        if (currentRaw.length > 0) {
          startPrice = currentRaw[0].adjclose;
        }

        const currentCycleLabel = getElectionCycleLabel(currentYear);
        const cycleKeyMap = {
          'Pre-Election Year': 'preElection',
          'Election Year': 'election',
          'Mid-Term Year': 'midTerm',
          'Post-Election Year': 'postElection',
        };
        const targetKey = cycleKeyMap[currentCycleLabel];
        const benchmarkLine = linesData.find(line => line.key === targetKey);

        if (benchmarkLine && benchmarkLine.data.length > 0 && startPrice) {
          const lastPoint = benchmarkLine.data[benchmarkLine.data.length - 1];
          if (scaleChoice === 'linear') {
            predictedPct = lastPoint.pctChangeYtd;
            predictedPrice = startPrice * (1.0 + predictedPct / 100.0);
          }
        }

        const marketState = data.meta?.marketState ? String(data.meta.marketState).toUpperCase() : 'CLOSED';
        const isMarketOpen = ['REGULAR', 'OPEN', 'TRADING'].some(state => marketState.includes(state));

        setSymbolInfo({
          logo: data.meta?.logo,
          name: symbolName,
          currentPrice,
          predictedPrice,
          predictedPct,
          dailyChange,
          dailyChangePct,
          isMarketOpen,
          currency: data.meta?.currency,
        });

        const monthlyReturns = calculateMonthlyReturns(rawData);
        const quarterlyReturns = calculateQuarterlyReturns(rawData);

        setMonthlyHeatmap(formatMonthlyHeatmap(monthlyReturns, 10));
        setQuarterlyHeatmap(formatQuarterlyHeatmap(quarterlyReturns, 10));
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Failed to fetch data. Please try again.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDataAndBuildChart();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, selectedCycles, scaleChoice]);

  return { loading, rawLinesData, symbolInfo, assetName, monthlyHeatmap, quarterlyHeatmap };
}
