"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  removeIncompleteYears,
  computeDailyReturns,
  getElectionCycleLabel,
  hirschStyleSeasonalPattern,
  computeSingleYearPattern,
  forwardFillSingleYear,
  calculateMonthlyReturns,
  calculateQuarterlyReturns,
  formatMonthlyHeatmap,
  formatQuarterlyHeatmap,
} from '@/lib/seasonalData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2, SmilePlus, Search, X, Clock, TrendingUp, DollarSign, Star, SearchCode } from "lucide-react";
import { AddAssetModal } from "@/components/add-asset-modal";

const COLORS = {
  allYears: 'oklch(98.4% 0.014 180.72)',
  preElection: 'oklch(98.4% 0.014 180.72)',
  election: 'oklch(98.4% 0.014 180.72)',
  midTerm: 'oklch(98.4% 0.014 180.72)',
  postElection: 'oklch(98.4% 0.014 180.72)',
  current: 'oklch(59.6% 0.145 163.225)',
};

const SEARCH_HISTORY_KEY = 'aruna_search_history';
const MAX_HISTORY_ITEMS = 10;

function ElectionCyclePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const symbolParam = searchParams.get('symbol');
  
  const [symbol, setSymbol] = useState(symbolParam || 'GOOGL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [scaleChoice, setScaleChoice] = useState('linear');
  const [loading, setLoading] = useState(false);
  const [rawLinesData, setRawLinesData] = useState([]);
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {} });
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  
  const deriveDefaultCycles = () => {
    const y = new Date().getFullYear();
    const label = getElectionCycleLabel(y);
    const mapping = {
      'Pre-Election Year': 'pre',
      'Election Year': 'election',
      'Mid-Term Year': 'mid',
      'Post-Election Year': 'post',
    };
    const key = mapping[label];
    return [key, 'current'];
  };
  const [selectedCycles, setSelectedCycles] = useState(deriveDefaultCycles());

  // Update symbol when URL param changes
  useEffect(() => {
    if (symbolParam) {
      setSymbol(symbolParam);
    }
  }, [symbolParam]);

  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  useEffect(() => {
    fetchDataAndBuildChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, selectedCycles]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!searchQuery) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        setSearchResults(json.symbols || []);
      } catch (e) {
        console.warn('Symbol search failed', e);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const addToSearchHistory = (symbolData) => {
    const newHistory = [
      symbolData,
      ...searchHistory.filter(item => item.symbol !== symbolData.symbol)
    ].slice(0, MAX_HISTORY_ITEMS);
    
    setSearchHistory(newHistory);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const selectSymbol = (symbolData) => {
    setSymbol(symbolData.symbol);
    addToSearchHistory(symbolData);
    setSearchQuery('');
    setSearchResults([]);
    setSearchDialogOpen(false);
  };

  async function fetchDataAndBuildChart() {
    setLoading(true);
    try {
      const startDate = Math.floor(new Date('1971-01-01').getTime() / 1000);
      const endDate = Math.floor(Date.now() / 1000);

      const response = await fetch(
        `/api/yahoo-finance?symbol=${symbol}&startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const json = await response.json();
      let rawData = json.data.map(row => ({
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
          color: COLORS.allYears,
        });
      }

      if (selectedCycles.includes('pre')) {
        const preData = histDaily.filter(r => r.cycle === 'Pre-Election Year');
        if (preData.length > 0) {
          linesData.push({
            name: 'Pre-Election Year',
            key: 'preElection',
            data: hirschStyleSeasonalPattern(preData),
            color: COLORS.preElection,
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
            color: COLORS.election,
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
            color: COLORS.midTerm,
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
            color: COLORS.postElection,
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
            color: COLORS.current,
          });
        }
      }

      // Simpan raw linesData saja, transformasi akan dilakukan di useMemo
      setRawLinesData(linesData);

      const symbolName = json.meta?.name || symbol;
      setAssetName(symbolName);

      let currentPrice = null;
      let startPrice = null;
      let predictedPrice = null;
      let predictedPct = null;

      if (rawData.length > 0) {
        currentPrice = rawData[rawData.length - 1].adjclose;
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

      setSymbolInfo({
        name: symbolName,
        currentPrice,
        predictedPrice,
        predictedPct,
      });

      const monthlyReturns = calculateMonthlyReturns(rawData);
      const quarterlyReturns = calculateQuarterlyReturns(rawData);
      
      setMonthlyHeatmap(formatMonthlyHeatmap(monthlyReturns, 10));
      setQuarterlyHeatmap(formatQuarterlyHeatmap(quarterlyReturns, 10));
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const formatTick = (dayOfYear) => {
    const date = new Date(2000, 0, 1);
    date.setDate(date.getDate() + dayOfYear - 1);
    // Tampilkan tanggal detail ketika quarter filter aktif, bulan saja ketika 'all'
    if (quarterFilter === 'all') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }
  };

  const formatTooltip = (value) => {
    if (value == null || isNaN(value)) return '-';
    if (scaleChoice === 'log') {
      // Convert back from multiplier to percentage
      const pct = (value - 1) * 100;
      return `${pct.toFixed(1)}%`;
    }
    return `${value.toFixed(1)}%`;
  };

  const formatYAxis = (value) => {
    if (value == null || isNaN(value)) return '-';
    if (scaleChoice === 'log') {
      // Convert back from multiplier to percentage
      const pct = (value - 1) * 100;
      return `${pct.toFixed(0)}%`;
    }
    return `${value.toFixed(0)}%`;
  };

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    if (clean.length === 6) {
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return [r, g, b];
    }
    return [0, 0, 0];
  }

  function rgbaFromHex(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function cellBgStyle(value) {
    if (value == null || isNaN(value)) return null;
    const posHex = '#16A34A';
    const negHex = '#DC2626';
    const magnitude = Math.min(Math.abs(value), 30);
    const intensity = 0.15 + (magnitude / 30) * 0.75;
    const color = value >= 0 ? rgbaFromHex(posHex, intensity) : rgbaFromHex(negHex, intensity);
    return color;
  }

  const [quarterFilter, setQuarterFilter] = useState('all');

  const getQuarterDateRange = (quarter) => {
    switch(quarter) {
      case 'Q1': return [1, 90];
      case 'Q2': return [91, 181];
      case 'Q3': return [182, 273];
      case 'Q4': return [274, 365];
      default: return [1, 365];
    }
  };

  // Transform raw data berdasarkan scaleChoice (tidak perlu re-fetch)
  const chartData = useMemo(() => {
    if (!rawLinesData || rawLinesData.length === 0) {
      return { chartArray: [], linesData: rawLinesData };
    }

    const mergedData = {};
    rawLinesData.forEach(line => {
      line.data.forEach(point => {
        if (!mergedData[point.dayOfYear]) {
          mergedData[point.dayOfYear] = { dayOfYear: point.dayOfYear };
        }
        // For logarithmic: convert percentage to growth multiplier (e.g., 10% = 1.10)
        // For linear: use percentage directly
        let value;
        if (scaleChoice === 'log') {
          // Convert percentage to multiplier: -10% -> 0.90, 0% -> 1.0, 10% -> 1.10
          value = 1 + (point.pctChangeYtd / 100);
          // Ensure positive values for log scale (minimum 0.01)
          value = Math.max(value, 0.01);
        } else {
          value = point.pctChangeYtd;
        }
        mergedData[point.dayOfYear][line.key] = value;
      });
    });

    const chartArray = Object.values(mergedData).sort((a, b) => a.dayOfYear - b.dayOfYear);
    return { chartArray, linesData: rawLinesData };
  }, [rawLinesData, scaleChoice]);

  const filteredChartData = quarterFilter === 'all' 
    ? chartData.chartArray 
    : chartData.chartArray.filter(item => {
        const [start, end] = getQuarterDateRange(quarterFilter);
        return item.dayOfYear >= start && item.dayOfYear <= end;
      });

  const formatTooltipDate = (dayOfYear) => {
    const date = new Date(2000, 0, 1);
    date.setDate(date.getDate() + dayOfYear - 1);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full flex items-center gap-4">
        <Button 
          onClick={() => setSearchDialogOpen(true)}
          variant="outline" 
          className="w-auto h-10 justify-center text-center font-normal"
        >
          <span className="truncate font-semibold">{symbol}</span>
          <Search className="h-4 w-4"/>
        </Button>
        {symbol.endsWith('.JK') && (
          <p>🇮🇩 Hey antek-antek asing!</p>
        )}
        {symbol.endsWith('-USD') && (
          <p>🚀 To the moon (katanya)</p>
        )}
        {['QQQ', 'SPY'].some((s) => symbol.endsWith(s)) && (
          <p>👴 Boomer Pension Fund</p>
        )}
        {['AAPL','MSFT','GOOGL','GOOG','AMZN','META','NVDA','TSLA'].some((s) => symbol.endsWith(s)) && (
          <p>🧰 Magnificent 7</p>
        )}
      </div>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="fixed max-w-none h-screen rounded-none p-0 flex flex-col" closeButtonPosition="right">
          <div className="flex items-center gap-2 p-4 border-b">
            <DialogTitle className="text-lg">Search Symbol</DialogTitle>
          </div>
          
          <div className="flex-1 overflow-auto">
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ticker or company name..."
                  className="w-full h-12 pl-10 pr-4 rounded-lg border border-input bg-background text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {searchLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground px-2">Search Results</p>
                  <div className="space-y-1">
                    {searchResults.map(r => (
                      <button
                        key={r.symbol}
                        type="button"
                        onClick={() => selectSymbol(r)}
                        className="w-full text-left p-4 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors flex flex-col gap-1"
                      >
                        <span className="font-semibold text-base">{r.symbol}</span>
                        <span className="text-sm text-muted-foreground line-clamp-1">{r.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!searchLoading && searchQuery && searchResults.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No results found</p>
              )}

              {!searchQuery && searchHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Recent Searches
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearSearchHistory}
                      className="text-xs h-7"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {searchHistory.map(item => (
                      <button
                        key={item.symbol}
                        type="button"
                        onClick={() => selectSymbol(item)}
                        className="w-full text-left p-4 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors flex flex-col gap-1"
                      >
                        <span className="font-semibold text-base">{item.symbol}</span>
                        <span className="text-sm text-muted-foreground line-clamp-1">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading && (
        <>
          <Card className="overflow-hidden bg-transparent border-none rounded-none">
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded w-32 mb-2 animate-pulse"></div>
                  <div className="flex justify-between items-start">
                    <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
                    <div className="flex gap-2">
                      <div className="h-8 w-16 bg-muted rounded-md animate-pulse"></div>
                      <div className="h-8 w-24 bg-muted rounded-md animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 -mr-5 pb-0">
              <div className="w-full h-[280px] bg-muted animate-pulse rounded"></div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 h-6 bg-muted rounded-md animate-pulse"></div>
            ))}
          </div>

          <div className="h-11 bg-muted rounded-md animate-pulse"></div>

          <div className="h-10 bg-muted rounded-md animate-pulse"></div>

          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
            </div>
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
            </div>
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </>
      )}

      {!loading && chartData.chartArray && chartData.chartArray.length > 0 && (
        <>
          <Card className="overflow-hidden bg-transparent border-none rounded-none">
            <CardHeader>
              <div className="flex items-baseline justify-between">
                <div className="flex-1">
                  <CardDescription className="text-sm mb-1">{assetName}</CardDescription>
                  <CardTitle className="text-3xl font-bold flex justify-between items-start">
                    {symbolInfo?.currentPrice 
                      ? `${Math.round(symbolInfo.currentPrice).toLocaleString()}` 
                      : '-'}
                    <RadioGroup value={scaleChoice} onValueChange={setScaleChoice} className="flex gap-2">
                      <div className="flex-1">
                        <RadioGroupItem value="linear" id="linear" className="peer sr-only" />
                        <Label
                          htmlFor="linear"
                          className="flex items-center justify-center h-8 px-2 rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-colors"
                        >
                          Linear
                        </Label>
                      </div>
                      <div className="flex-1">
                        <RadioGroupItem value="log" id="log" className="peer sr-only" />
                        <Label
                          htmlFor="log"
                          className="flex items-center justify-center h-8 px-2 rounded-md border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-colors"
                        >
                          Logarithmic
                        </Label>
                      </div>
                    </RadioGroup>
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 -mr-5 pb-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart 
                  data={filteredChartData}
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dayOfYear"
                    tickFormatter={formatTick}
                    ticks={quarterFilter === 'all' ? [1, 91, 182, 274] : undefined}
                    className="text-[10px]"
                    height={30}
                  />
                  <YAxis
                    orientation="right"
                    scale={scaleChoice === 'log' ? 'log' : 'linear'}
                    domain={scaleChoice === 'log' ? ['auto', 'auto'] : ['auto', 'auto']}
                    tickFormatter={formatYAxis}
                    className="text-[10px]"
                    width={45}
                    allowDataOverflow={false}
                  />
                  <Tooltip
                    formatter={formatTooltip}
                    labelFormatter={formatTooltipDate}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    align="left"
                    verticalAlign="bottom"
                    wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                  />
                  {chartData.linesData.map(line => (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      stroke={line.color}
                      name={line.name}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            {['all', 'Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
              <button
                key={q}
                className={`flex-1 h-6 text-xs rounded-md border-2 transition-colors ${
                  quarterFilter === q
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'
                }`}
                onClick={() => setQuarterFilter(q)}
              >
                {q === 'all' ? 'All' : q}
              </button>
            ))}
          </div>

          <Select
            className="w-full"
            value={selectedCycles.join(',')}
            onValueChange={(value) => setSelectedCycles(value.split(','))}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select cycles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pre,current">Pre-Election + Current</SelectItem>
              <SelectItem value="election,current">Election + Current</SelectItem>
              <SelectItem value="mid,current">Mid-Term + Current</SelectItem>
              <SelectItem value="post,current">Post-Election + Current</SelectItem>
              <SelectItem value="all,current">All Years + Current</SelectItem>
              {/* <SelectItem value="pre,election,mid,post,current">All Cycles + Current</SelectItem> */}
            </SelectContent>
          </Select>

          <Button 
            onClick={() => setPortfolioDialogOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            Add to Your Portfolio
          </Button>

          <Accordion type="single" collapsible defaultValue="quarterly" className="border rounded-lg">
            <AccordionItem value="quarterly" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline hover:bg-accent">
                Quarterly Returns
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">Year</th>
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, idx) => (
                          <th key={idx} className="text-center py-2 px-2 font-medium">{quarter}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlyHeatmap.rows.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                          {[1, 2, 3, 4].map(quarter => {
                            const value = row[`Q${quarter}`];
                            const bg = cellBgStyle(value);
                            return (
                              <td key={quarter} className="text-center py-2 px-2" style={{ backgroundColor: bg }}>
                                {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold bg-muted/50">
                        <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg</td>
                        {[1, 2, 3, 4].map(quarter => {
                          const value = quarterlyHeatmap.average[`Q${quarter}`];
                          const bg = cellBgStyle(value);
                          return (
                            <td key={quarter} className="text-center py-2 px-2" style={{ backgroundColor: bg }}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="monthly" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline hover:bg-accent">
                Monthly Returns
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="relative overflow-x-auto">
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-1 font-medium sticky left-0 bg-background">Year</th>
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                          <th key={idx} className="text-center py-2 px-1 font-medium">{month}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyHeatmap.rows.map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 px-1 font-medium sticky left-0 bg-background">{row.year}</td>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                            const value = row[`M${month}`];
                            const bg = cellBgStyle(value);
                            return (
                              <td key={month} className="text-center py-2 px-1" style={{ backgroundColor: bg }}>
                                {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="border-t-2 font-semibold bg-muted/50">
                        <td className="py-2 px-1 sticky left-0 bg-muted/50">Avg</td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                          const value = monthlyHeatmap.average[`M${month}`];
                          const bg = cellBgStyle(value);
                          return (
                            <td key={month} className="text-center py-2 px-1" style={{ backgroundColor: bg }}>
                              {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
      
      <AddAssetModal 
        open={portfolioDialogOpen} 
        onOpenChange={setPortfolioDialogOpen}
        initialSymbol={symbol}
        onSave={(entry) => {
          // Load existing portfolio
          let portfolio = [];
          try {
            const raw = localStorage.getItem('aruna_portfolio');
            portfolio = raw ? JSON.parse(raw) : [];
          } catch (e) {
            console.warn('Failed to load portfolio', e);
          }
          
          // Add new entry
          portfolio.push(entry);
          
          // Save back to localStorage
          try {
            localStorage.setItem('aruna_portfolio', JSON.stringify(portfolio));
            setPortfolioDialogOpen(false);
            router.push('/portfolio-tracker');
          } catch (e) {
            console.warn('Failed to save portfolio', e);
          }
        }}
      />
    </div>
  );
}

export default function ElectionCyclePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ElectionCyclePageContent />
    </Suspense>
  );
}
