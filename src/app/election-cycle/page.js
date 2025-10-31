"use client";

import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Loader2 } from "lucide-react";

const COLORS = {
  allYears: '#8B5CF6',      // violet-500 (visible in both modes)
  preElection: '#10B981',   // emerald-500
  election: '#3B82F6',      // blue-500
  midTerm: '#EF4444',       // red-500
  postElection: '#F59E0B',  // amber-500
  current: '#EC4899',       // pink-500
};

export default function ElectionCyclePage() {
  const [symbol, setSymbol] = useState('QQQ');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [scaleChoice, setScaleChoice] = useState('linear');
  const [loading, setLoading] = useState(false);
  // chartData shape: { chartArray: Array<ChartRow>, linesData: Array<LineMeta> }
  const [chartData, setChartData] = useState({ chartArray: [], linesData: [] });
  const [symbolInfo, setSymbolInfo] = useState(null);
  const [assetName, setAssetName] = useState('');
  const [monthlyHeatmap, setMonthlyHeatmap] = useState({ rows: [], average: {} });
  const [quarterlyHeatmap, setQuarterlyHeatmap] = useState({ rows: [], average: {} });
  // Derive default cycles: current election cycle + current year
  const deriveDefaultCycles = () => {
    const y = new Date().getFullYear();
    const label = getElectionCycleLabel(y); // e.g., 'Post-Election Year'
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

  useEffect(() => {
    fetchDataAndBuildChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, scaleChoice, selectedCycles]);

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
    }, 300); // debounce
    return () => clearTimeout(handler);
  }, [searchQuery]);

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

      // Build lines data like Python version
      const linesData = [];

      // All Years pattern
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

      // Pre-Election Year
      if (selectedCycles.includes('pre')) {
        const preData = histDaily.filter(r => r.cycle === 'Pre-Election Year');
        if (preData.length > 0) {
          const pattern = hirschStyleSeasonalPattern(preData);
          linesData.push({
            name: 'Pre-Election Year',
            key: 'preElection',
            data: pattern,
            color: COLORS.preElection,
          });
        }
      }

      // Election Year
      if (selectedCycles.includes('election')) {
        const elecData = histDaily.filter(r => r.cycle === 'Election Year');
        if (elecData.length > 0) {
          const pattern = hirschStyleSeasonalPattern(elecData);
          linesData.push({
            name: 'Election Year',
            key: 'election',
            data: pattern,
            color: COLORS.election,
          });
        }
      }

      // Mid-Term Year
      if (selectedCycles.includes('mid')) {
        const midData = histDaily.filter(r => r.cycle === 'Mid-Term Year');
        if (midData.length > 0) {
          const pattern = hirschStyleSeasonalPattern(midData);
          linesData.push({
            name: 'Mid-Term Year',
            key: 'midTerm',
            data: pattern,
            color: COLORS.midTerm,
          });
        }
      }

      // Post-Election Year
      if (selectedCycles.includes('post')) {
        const postData = histDaily.filter(r => r.cycle === 'Post-Election Year');
        if (postData.length > 0) {
          const pattern = hirschStyleSeasonalPattern(postData);
          linesData.push({
            name: 'Post-Election Year',
            key: 'postElection',
            data: pattern,
            color: COLORS.postElection,
          });
        }
      }

      // Current Year
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

      // Merge all line data into chart format for Recharts
      const mergedData = {};
      linesData.forEach(line => {
        line.data.forEach(point => {
          if (!mergedData[point.dayOfYear]) {
            mergedData[point.dayOfYear] = { dayOfYear: point.dayOfYear };
          }
          const value = scaleChoice === 'linear' ? point.pctChangeYtd : point.cumulativeFactor;
          mergedData[point.dayOfYear][line.key] = value;
        });
      });

      const chartArray = Object.values(mergedData).sort((a, b) => a.dayOfYear - b.dayOfYear);

      setChartData({ chartArray, linesData });

  // symbol name from search results (fallback to symbol)
  const found = searchResults.find(s => s.symbol === symbol);
  const symbolName = found ? found.name : symbol;
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

      // Calculate prediction based on current cycle
      const currentCycleLabel = getElectionCycleLabel(currentYear); // e.g., 'Post-Election Year'
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

      // Calculate monthly and quarterly returns
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
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const formatTooltip = (value) => {
    // Always show percentage regardless of scale
    if (value == null || isNaN(value)) return '-';
    return `${value.toFixed(2)}%`;
  };

  // Helper: convert hex to rgb
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

  // Helper: create rgba color string from hex and intensity (0-1)
  function rgbaFromHex(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Map a numeric return value to a background color (positive -> green, negative -> red)
  // Intensity scales with magnitude but clamps to keep readability.
  function cellBgStyle(value) {
    if (value == null || isNaN(value)) return null;
    const posHex = '#16A34A'; // emerald-600
    const negHex = '#DC2626'; // red-600

    const magnitude = Math.min(Math.abs(value), 30); // cap influence at 30%
    const intensity = 0.15 + (magnitude / 30) * 0.75; // 0.15 .. 0.9
    const color = value >= 0 ? rgbaFromHex(posHex, intensity) : rgbaFromHex(negHex, intensity);
    return color;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Seasonal Pattern Analysis</h2>
        <p className="text-muted-foreground">
          Hirsch-style seasonal profile with election-cycle overlays
        </p>
      </div>

  <div className="flex gap-4">
  <div className="flex flex-col gap-2">
          <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <span className="truncate">{symbol}</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Search Symbol</DialogTitle>
              <DialogDescription>Type ticker (e.g. AAPL) and choose from results.</DialogDescription>
              <div className="mt-4 flex flex-col gap-2">
                <input
                  id="symbolSearch"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type ticker (e.g. AAPL)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {searchLoading && <p className="text-xs text-muted-foreground">Searching...</p>}
                {!searchLoading && searchResults.length > 0 && (
                  <div className="max-h-64 overflow-auto rounded-md border border-border bg-background shadow-sm divide-y">
                    {searchResults.map(r => (
                      <button
                        key={r.symbol}
                        type="button"
                        onClick={() => {
                          setSymbol(r.symbol);
                          setSearchQuery('');
                          setSearchResults([]);
                          setSearchDialogOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-accent flex flex-col gap-0.5"
                      >
                        <span className="font-medium text-sm">{r.symbol}</span>
                        <span className="text-xs text-muted-foreground">{r.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!searchLoading && searchQuery && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">No results.</p>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <DialogClose asChild>
                  <Button variant="ghost">Close</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-2">
          <Select
            value={selectedCycles.join(',')}
            onValueChange={(value) => setSelectedCycles(value.split(','))}
          >
            <SelectTrigger id="cycles">
              <SelectValue placeholder="Select cycles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pre,current">Pre-Election + Current</SelectItem>
              <SelectItem value="election,current">Election + Current</SelectItem>
              <SelectItem value="mid,current">Mid-Term + Current</SelectItem>
              <SelectItem value="post,current">Post-Election + Current</SelectItem>
              <SelectItem value="all,current">All Years + Current</SelectItem>
              <SelectItem value="pre,election,mid,post,current">All Cycles + Current</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center h-8">
            <RadioGroup value={scaleChoice} onValueChange={setScaleChoice} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="linear" id="linear" />
                <Label htmlFor="linear" className="font-normal">Linear (% change)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="log" id="log" />
                <Label htmlFor="log" className="font-normal">Logarithmic (factor)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {!loading && chartData.chartArray && chartData.chartArray.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 order-2 lg:order-1">
            <CardHeader>
              <CardTitle>Election Cycle Chart: {symbol}</CardTitle>
              <CardDescription>
                Cumulative % Change ({scaleChoice === 'log' ? 'Log scale transform applied' : 'Linear scale'})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={chartData.chartArray}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dayOfYear"
                    tickFormatter={formatTick}
                    ticks={[1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]}
                    className="text-xs"
                  />
                  <YAxis
                    scale={scaleChoice === 'log' ? 'log' : 'linear'}
                    domain={['auto', 'auto']}
                    tickFormatter={formatTooltip}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={formatTooltip}
                    labelFormatter={(label) => `Day ${label}`}
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.5rem' }} />
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
          {symbolInfo && (
            <Card className="order-1 lg:order-2">
              <CardHeader>
                <CardTitle>{symbolInfo.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {symbolInfo.currentPrice && (
                  <p className="text-sm">
                    <span className="font-medium">Current price:</span>{' '}
                    {Math.round(symbolInfo.currentPrice).toLocaleString()}
                  </p>
                )}
                {symbolInfo.predictedPrice && symbolInfo.predictedPct !== null && (
                  <p className="text-sm">
                    <span className="font-medium">Seasonal prediction:</span>{' '}
                    {Math.round(symbolInfo.predictedPrice).toLocaleString()} (
                    {symbolInfo.predictedPct >= 0 ? '+' : ''}
                    {Math.round(symbolInfo.predictedPct)}%)
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Use with caution — historical statistics, not financial advice.
                </p>

                <Accordion type="single" defaultValue="quarterly" collapsible className="mt-4">
                  {/* Quarterly first (moved above Monthly) - default expanded */}
                  <AccordionItem value="quarterly">
                    <AccordionTrigger className="text-sm font-semibold">Quarterly Returns</AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium">Year</th>
                              {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, idx) => (
                                <th key={idx} className="text-center py-2 px-3 font-medium">{quarter}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {quarterlyHeatmap.rows.map((row, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-2 px-2 font-medium">{row.year}</td>
                                {[1, 2, 3, 4].map(quarter => {
                                  const value = row[`Q${quarter}`];
                                  const bg = cellBgStyle(value);
                                  return (
                                    <td key={quarter} className="text-center py-2 px-3" style={{ backgroundColor: bg }}>
                                      {value !== null ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '-'}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            <tr className="border-t-2 font-semibold bg-muted/50">
                              <td className="py-2 px-2">Average</td>
                              {[1, 2, 3, 4].map(quarter => {
                                const value = quarterlyHeatmap.average[`Q${quarter}`];
                                const bg = cellBgStyle(value);
                                return (
                                  <td key={quarter} className="text-center py-2 px-3" style={{ backgroundColor: bg }}>
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

                  {/* Monthly below Quarterly */}
                  <AccordionItem value="monthly">
                    <AccordionTrigger className="text-sm font-semibold">Monthly Returns</AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium">Year</th>
                              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                                <th key={idx} className="text-center py-2 px-1 font-medium">{month}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyHeatmap.rows.map((row, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-2 px-2 font-medium">{row.year}</td>
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
                              <td className="py-2 px-2">Average</td>
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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
