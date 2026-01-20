"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { ArunaWatermark } from "./aruna-watermark";
import { fetchEncodedJson } from "@/lib/api-client";

export function MarketBubbles({ fullScreen = false }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("weekly");
  const [dimensions, setDimensions] = useState({ width: 400, height: 800 });

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
    async function fetchStocks() {
      setLoading(true);
      try {
        const { data } = await fetchEncodedJson("/api/bubbles");
        setStocks(data?.stocks || []);
      } catch (error) {
        console.error("Failed to fetch stocks:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStocks();
  }, []);

  const bubbles = useMemo(() => {
    if (!stocks.length) return [];

    const filtered = stocks
      .map((stock) => {
        const change =
          timeframe === "weekly"
            ? stock.price_1_week_pct_change
            : stock.price_1_month_pct_change;

        if (change === null || change === undefined) return null;

        return {
          code: stock.code,
          name: stock.name,
          change,
          marketCap: stock.market_cap,
        };
      })
      .filter(Boolean);

    // Sort by market cap for size assignment
    const sorted = [...filtered].sort((a, b) => b.marketCap - a.marketCap);

    // Assign sizes based on ranking (larger market cap = larger bubble)
    const minSize = 28;
    const maxSize = 85;
    const totalBubbles = sorted.length;

    return sorted.map((stock, index) => {
      // Exponential decay for size - top stocks get much bigger bubbles
      const ratio = 1 - index / totalBubbles;
      const size = minSize + Math.pow(ratio, 0.6) * (maxSize - minSize);

      return {
        ...stock,
        size,
      };
    });
  }, [stocks, timeframe]);

  // Physics-based bubble packing with organic movement
  const packedBubbles = useMemo(() => {
    if (!bubbles.length) return [];

    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    const headerHeight = 55;
    const padding = 1.5;

    // Initialize bubbles with positions using spiral placement
    const packed = bubbles.map((bubble, i) => {
      const angle = i * 0.5;
      const radius = 15 + i * 2;
      const centerX = containerWidth / 2;
      const centerY = (containerHeight + headerHeight) / 2;

      return {
        ...bubble,
        x: centerX + Math.cos(angle) * Math.min(radius, containerWidth * 0.3),
        y: centerY + Math.sin(angle) * Math.min(radius, containerHeight * 0.25),
        vx: 0,
        vy: 0,
      };
    });

    // Force-directed simulation for tight packing
    const iterations = 150;
    const centerX = containerWidth / 2;
    const centerY = (containerHeight + headerHeight) / 2;

    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

      for (let i = 0; i < packed.length; i++) {
        const bubble = packed[i];

        // Center gravity
        const dx = centerX - bubble.x;
        const dy = centerY - bubble.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          bubble.vx += (dx / dist) * 0.8 * alpha;
          bubble.vy += (dy / dist) * 0.8 * alpha;
        }

        // Collision separation
        for (let j = i + 1; j < packed.length; j++) {
          const other = packed[j];
          const ddx = other.x - bubble.x;
          const ddy = other.y - bubble.y;
          const distance = Math.sqrt(ddx * ddx + ddy * ddy);
          const minDist = (bubble.size + other.size) / 2 + padding;

          if (distance < minDist && distance > 0) {
            const force = (minDist - distance) / distance * 0.5;
            const fx = ddx * force;
            const fy = ddy * force;

            bubble.vx -= fx;
            bubble.vy -= fy;
            other.vx += fx;
            other.vy += fy;
          }
        }

        // Boundary constraints
        const margin = bubble.size / 2 + 5;
        if (bubble.x < margin) bubble.vx += (margin - bubble.x) * 0.1;
        if (bubble.x > containerWidth - margin) bubble.vx += (containerWidth - margin - bubble.x) * 0.1;
        if (bubble.y < headerHeight + margin) bubble.vy += (headerHeight + margin - bubble.y) * 0.1;
        if (bubble.y > containerHeight - margin) bubble.vy += (containerHeight - margin - bubble.y) * 0.1;
      }

      // Apply velocities with damping
      for (const bubble of packed) {
        bubble.x += bubble.vx * 0.3;
        bubble.y += bubble.vy * 0.3;
        bubble.vx *= 0.85;
        bubble.vy *= 0.85;

        // Hard boundary clamp
        const margin = bubble.size / 2 + 2;
        bubble.x = Math.max(margin, Math.min(containerWidth - margin, bubble.x));
        bubble.y = Math.max(headerHeight + margin, Math.min(containerHeight - margin, bubble.y));
      }
    }

    // Add animation properties
    return packed.map((bubble, i) => ({
      ...bubble,
      animDelay: Math.random() * 3,
      animDuration: 4 + Math.random() * 2,
    }));
  }, [bubbles, dimensions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (fullScreen) {
    return (
      <div className="w-full h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <ArrowLeft className="size-6 text-muted-foreground" />
            </div>
          </Link>

          <div className="flex-1 flex gap-2 p-1 bg-muted/30 rounded-full">
            <button
              onClick={() => setTimeframe("weekly")}
              className={`py-2 flex-1 rounded-full text-xs font-semibold transition-all ${
                timeframe === "weekly"
                  ? "bg-gradient-to-br from-emerald-800 via-[#111827] to-[#020617] border-border/20 text-white/80"
                  : "hover:bg-muted"
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setTimeframe("monthly")}
              className={`py-2 flex-1 rounded-full text-xs font-semibold transition-all ${
                timeframe === "monthly"
                  ? "bg-gradient-to-br from-emerald-800 via-[#111827] to-[#020617] border-border/20 text-white/80"
                  : "hover:bg-muted"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Bubbles */}
        <div className="relative w-full h-full overflow-hidden">
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              {/* Gradient definitions for positive/negative */}
              <radialGradient id="glow-positive" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="glow-negative" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#ef4444" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
              </radialGradient>
              
              {/* Inner gradient fills */}
              <radialGradient id="fill-positive" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="60%" stopColor="#059669" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.02" />
              </radialGradient>
              <radialGradient id="fill-negative" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
                <stop offset="60%" stopColor="#dc2626" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.02" />
              </radialGradient>

              {/* Stroke gradients */}
              <linearGradient id="stroke-positive" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="stroke-negative" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f87171" stopOpacity="1" />
                <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#dc2626" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {packedBubbles.map((bubble, index) => {
              const isPositive = bubble.change >= 0;
              const radius = bubble.size / 2;
              const strokeWidth = Math.max(1.5, radius * 0.06);

              // Dynamic sizing based on bubble size
              const showLogo = radius > 18;
              const showCode = radius > 14;
              const showPercent = radius > 16;

              // Responsive text and logo sizes
              const logoSize = Math.min(radius * 0.5, 24);
              const codeFontSize = Math.max(7, Math.min(radius * 0.22, 11));
              const percentFontSize = Math.max(6, Math.min(radius * 0.18, 9));

              // Positions
              const logoY = bubble.y - radius * 0.25;
              const codeY = bubble.y + radius * 0.15;
              const percentY = bubble.y + radius * 0.42;

              const glowId = isPositive ? "glow-positive" : "glow-negative";
              const fillId = isPositive ? "fill-positive" : "fill-negative";
              const strokeId = isPositive ? "stroke-positive" : "stroke-negative";

              return (
                <g 
                  key={bubble.code}
                  style={{
                    animation: `bubble-float-${index % 5} ${bubble.animDuration}s ease-in-out infinite`,
                    animationDelay: `${bubble.animDelay}s`,
                  }}
                >
                  {/* Outer glow */}
                  <circle
                    cx={bubble.x}
                    cy={bubble.y}
                    r={radius * 1.2}
                    fill={`url(#${glowId})`}
                    className="pointer-events-none"
                  />

                  {/* Main bubble */}
                  <circle
                    cx={bubble.x}
                    cy={bubble.y}
                    r={radius}
                    fill={`url(#${fillId})`}
                    stroke={`url(#${strokeId})`}
                    strokeWidth={strokeWidth}
                    className="cursor-pointer"
                    style={{
                      filter: `drop-shadow(0 0 ${strokeWidth * 3}px ${isPositive ? '#10b98155' : '#ef444455'})`,
                    }}
                  >
                    <title>{`${bubble.name}\n${bubble.change > 0 ? "+" : ""}${bubble.change.toFixed(2)}%`}</title>
                  </circle>

                  {/* Logo */}
                  {showLogo && (
                    <image
                      href={`https://yjygsxwzkkjhvigedvdy.supabase.co/storage/v1/object/public/idx/${bubble.code}.png`}
                      x={bubble.x - logoSize / 2}
                      y={logoY - logoSize / 2}
                      width={logoSize}
                      height={logoSize}
                      className="pointer-events-none"
                      preserveAspectRatio="xMidYMid meet"
                      style={{ opacity: 0.95 }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}

                  {/* Stock Code */}
                  {showCode && (
                    <text
                      x={bubble.x}
                      y={codeY}
                      textAnchor="middle"
                      fill="white"
                      fontSize={codeFontSize}
                      fontWeight="700"
                      className="pointer-events-none select-none"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                    >
                      {bubble.code}
                    </text>
                  )}

                  {/* Percentage */}
                  {showPercent && (
                    <text
                      x={bubble.x}
                      y={percentY}
                      textAnchor="middle"
                      fill={isPositive ? "#34d399" : "#f87171"}
                      fontSize={percentFontSize}
                      fontWeight="600"
                      className="pointer-events-none select-none"
                    >
                      {bubble.change > 0 ? "+" : ""}
                      {bubble.change.toFixed(2)}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Watermark */}
          <ArunaWatermark className="absolute inset-0 flex items-end justify-start bottom-10 left-4" />

          {/* CSS Animation Keyframes */}
          <style jsx global>{`
            @keyframes bubble-float-0 {
              0%, 100% { transform: translate(0, 0); }
              25% { transform: translate(1.5px, -2px); }
              50% { transform: translate(-1px, 1px); }
              75% { transform: translate(2px, 1.5px); }
            }
            @keyframes bubble-float-1 {
              0%, 100% { transform: translate(0, 0); }
              20% { transform: translate(-1.5px, 1.5px); }
              40% { transform: translate(1px, -1px); }
              60% { transform: translate(-0.5px, 2px); }
              80% { transform: translate(1.5px, -0.5px); }
            }
            @keyframes bubble-float-2 {
              0%, 100% { transform: translate(0, 0); }
              33% { transform: translate(2px, 1px); }
              66% { transform: translate(-1.5px, -1.5px); }
            }
            @keyframes bubble-float-3 {
              0%, 100% { transform: translate(0, 0); }
              25% { transform: translate(-2px, -1px); }
              50% { transform: translate(1.5px, 2px); }
              75% { transform: translate(0.5px, -1.5px); }
            }
            @keyframes bubble-float-4 {
              0%, 100% { transform: translate(0, 0); }
              20% { transform: translate(1px, 2px); }
              40% { transform: translate(-2px, 0.5px); }
              60% { transform: translate(1.5px, -1px); }
              80% { transform: translate(-0.5px, 1.5px); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Non-fullscreen version (for home page preview - not used anymore)
  return null;
}
