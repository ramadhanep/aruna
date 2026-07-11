"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { ArunaWatermark } from "@/components/aruna-watermark";
import { fetchEncodedJson } from "@/lib/api-client";

const QUADRANT_COLORS = {
  leading: { bg: '#10b981', text: 'text-emerald-400', label: 'Leading' },
  weakening: { bg: '#f59e0b', text: 'text-amber-400', label: 'Weakening' },
  lagging: { bg: '#ef4444', text: 'text-red-400', label: 'Lagging' },
  improving: { bg: '#3b82f6', text: 'text-blue-400', label: 'Improving' },
};

export default function IdxRotationPage() {
  const [stocks, setStocks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 400, height: 800 });
  const [hoveredStock, setHoveredStock] = useState(null);
  const svgRef = useRef(null);

  // Lock scroll while fullscreen mode is active
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    async function fetchRotationData() {
      setLoading(true);
      try {
        const { data } = await fetchEncodedJson('/api/rotation');
        setStocks(data?.stocks || []);
        setSummary(data?.summary || null);
      } catch (error) {
        console.error("Failed to fetch rotation data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRotationData();
  }, []);

  // Chart dimensions
  const chartConfig = useMemo(() => {
    const headerHeight = 120;
    const padding = 40;
    const chartWidth = dimensions.width - padding * 2;
    const chartHeight = dimensions.height - headerHeight - padding * 2;
    const centerX = dimensions.width / 2;
    const centerY = headerHeight + chartHeight / 2;

    return {
      headerHeight,
      padding,
      chartWidth,
      chartHeight,
      centerX,
      centerY,
      xScale: chartWidth / 200, // -100 to 100
      yScale: chartHeight / 200,
    };
  }, [dimensions]);

  // Position stocks on the chart
  const positionedStocks = useMemo(() => {
    return stocks.map(stock => {
      // Scale position to chart coordinates
      const x = chartConfig.centerX + stock.x * chartConfig.xScale;
      const y = chartConfig.centerY - stock.y * chartConfig.yScale; // Inverted Y

      // Size based on market cap (relative)
      const maxMarketCap = Math.max(...stocks.map(s => s.marketCap || 0));
      const sizeRatio = (stock.marketCap || 0) / maxMarketCap;
      const size = 8 + sizeRatio * 16; // 8 to 24px radius

      return {
        ...stock,
        cx: x,
        cy: y,
        size,
      };
    });
  }, [stocks, chartConfig]);

  // Download as image
  const handleDownload = async () => {
    const svg = svgRef.current;
    if (!svg) return;

    try {
      const svgClone = svg.cloneNode(true);
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgClone);
      svgString = '<?xml version="1.0" encoding="UTF-8"?>' + svgString;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = dimensions.width * 2;
      canvas.height = dimensions.height * 2;

      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `aruna-rotation-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 transition-colors">
            <ArrowLeft className="size-6 text-muted-foreground" />
          </div>
        </Link>

        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold text-foreground/80">Market Rotation</h1>
          <p className="text-[10px] text-muted-foreground">Top 50 by Market Cap</p>
        </div>

        <button
          onClick={handleDownload}
          className="p-1.5 rounded-lg bg-accent hover:bg-accent/80 transition-colors shrink-0"
          title="Download as image"
        >
          <Download className="size-6 text-muted-foreground" />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="absolute top-14 left-0 right-0 z-40 flex justify-center gap-2 px-3">
        {Object.entries(QUADRANT_COLORS).map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5 border border-border bg-card rounded-md px-2.5 py-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: value.bg }}
            />
            <span className={`text-[10px] font-medium ${value.text}`}>
              {value.label}: {summary?.[key] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Background */}
        <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="#09090b" />

        {/* Quadrant backgrounds */}
        {/* Leading (top-right) - green */}
        <rect
          x={chartConfig.centerX}
          y={chartConfig.headerHeight}
          width={chartConfig.chartWidth / 2}
          height={chartConfig.chartHeight / 2}
          fill="#10b98108"
        />
        {/* Weakening (top-left) - yellow */}
        <rect
          x={chartConfig.padding}
          y={chartConfig.headerHeight}
          width={chartConfig.chartWidth / 2}
          height={chartConfig.chartHeight / 2}
          fill="#f59e0b08"
        />
        {/* Lagging (bottom-left) - red */}
        <rect
          x={chartConfig.padding}
          y={chartConfig.centerY}
          width={chartConfig.chartWidth / 2}
          height={chartConfig.chartHeight / 2}
          fill="#ef444408"
        />
        {/* Improving (bottom-right) - blue */}
        <rect
          x={chartConfig.centerX}
          y={chartConfig.centerY}
          width={chartConfig.chartWidth / 2}
          height={chartConfig.chartHeight / 2}
          fill="#3b82f608"
        />

        {/* Axes */}
        {/* Horizontal axis */}
        <line
          x1={chartConfig.padding}
          y1={chartConfig.centerY}
          x2={dimensions.width - chartConfig.padding}
          y2={chartConfig.centerY}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
        {/* Vertical axis */}
        <line
          x1={chartConfig.centerX}
          y1={chartConfig.headerHeight}
          x2={chartConfig.centerX}
          y2={dimensions.height - chartConfig.padding}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {/* Axis labels */}
        <text
          x={dimensions.width - chartConfig.padding - 5}
          y={chartConfig.centerY - 8}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="end"
        >
          Strong Momentum →
        </text>
        <text
          x={chartConfig.padding + 5}
          y={chartConfig.centerY - 8}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="start"
        >
          ← Weak Momentum
        </text>
        <text
          x={chartConfig.centerX + 8}
          y={chartConfig.headerHeight + 15}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="start"
        >
          ↑ Uptrend
        </text>
        <text
          x={chartConfig.centerX + 8}
          y={dimensions.height - chartConfig.padding - 5}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="start"
        >
          ↓ Downtrend
        </text>

        {/* Quadrant labels */}
        <text
          x={chartConfig.centerX + chartConfig.chartWidth / 4}
          y={chartConfig.headerHeight + 35}
          fill="#10b98140"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
        >
          LEADING
        </text>
        <text
          x={chartConfig.padding + chartConfig.chartWidth / 4}
          y={chartConfig.headerHeight + 35}
          fill="#f59e0b40"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
        >
          WEAKENING
        </text>
        <text
          x={chartConfig.padding + chartConfig.chartWidth / 4}
          y={dimensions.height - chartConfig.padding - 15}
          fill="#ef444440"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
        >
          LAGGING
        </text>
        <text
          x={chartConfig.centerX + chartConfig.chartWidth / 4}
          y={dimensions.height - chartConfig.padding - 15}
          fill="#3b82f640"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
        >
          IMPROVING
        </text>

        {/* Stock dots */}
        {positionedStocks.map((stock) => {
          const color = QUADRANT_COLORS[stock.quadrant]?.bg || '#888';
          const isHovered = hoveredStock === stock.code;

          return (
            <g key={stock.code}>
              {/* Glow effect */}
              <circle
                cx={stock.cx}
                cy={stock.cy}
                r={stock.size * 1.5}
                fill={color}
                opacity={isHovered ? 0.3 : 0.1}
              />

              {/* Main dot */}
              <circle
                cx={stock.cx}
                cy={stock.cy}
                r={isHovered ? stock.size * 1.2 : stock.size}
                fill={color}
                opacity={isHovered ? 1 : 0.7}
                stroke={isHovered ? 'white' : 'transparent'}
                strokeWidth={isHovered ? 2 : 0}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredStock(stock.code)}
                onMouseLeave={() => setHoveredStock(null)}
                onTouchStart={() => setHoveredStock(stock.code)}
              >
                <title>{`${stock.code}\n${stock.name}\nWeekly: ${stock.weeklyChange > 0 ? '+' : ''}${stock.weeklyChange.toFixed(2)}%\nMonthly: ${stock.monthlyChange > 0 ? '+' : ''}${stock.monthlyChange.toFixed(2)}%`}</title>
              </circle>

              {/* Stock code label */}
              {(stock.size > 12 || isHovered) && (
                <text
                  x={stock.cx}
                  y={stock.cy + stock.size + 10}
                  fill="rgba(255,255,255,0.7)"
                  fontSize={isHovered ? "10" : "8"}
                  fontWeight={isHovered ? "bold" : "normal"}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {stock.code}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* HTML Watermark */}
      <ArunaWatermark className="absolute bottom-4 right-4" />

      {/* Tooltip for hovered stock */}
      {hoveredStock && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 border border-border bg-card rounded-lg px-4 py-3 z-50 pointer-events-none">
          {(() => {
            const stock = positionedStocks.find(s => s.code === hoveredStock);
            if (!stock) return null;
            return (
              <div className="text-center">
                <div className="font-bold text-white">{stock.code}</div>
                <div className="text-xs text-white/60">{stock.name}</div>
                <div className="flex gap-4 mt-1 text-xs">
                  <span className={stock.weeklyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    1W: {stock.weeklyChange > 0 ? '+' : ''}{stock.weeklyChange.toFixed(2)}%
                  </span>
                  <span className={stock.monthlyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    1M: {stock.monthlyChange > 0 ? '+' : ''}{stock.monthlyChange.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
