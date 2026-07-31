"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { ArunaWatermark } from "./aruna-watermark";
import { fetchEncodedJson } from "@/lib/api-client";
import { getIdxLogoUrl } from "@/lib/supabase-storage";
import { ScatterSkeleton } from "./scatter-skeleton";

export function MarketBubbles({ fullScreen = false }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("weekly");
  const [dimensions, setDimensions] = useState({ width: 400, height: 800 });
  const [bubblePositions, setBubblePositions] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [draggedCode, setDraggedCode] = useState(null);
  const dragInfoRef = useRef(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);

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
        const { data } = await fetchEncodedJson(`/api/bubbles?timeframe=${timeframe}`);
        setStocks(data?.stocks || []);
        setBubblePositions({});
      } catch (error) {
        console.error("Failed to fetch stocks:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStocks();
  }, [timeframe]);

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

    const sorted = [...filtered].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    const maxChange = Math.max(...sorted.map(s => Math.abs(s.change)));
    const minSize = 24;

    return sorted.map((stock) => {
      const changeRatio = Math.abs(stock.change) / maxChange;
      const size = minSize + Math.pow(changeRatio, 0.5) * (dimensions.width * 0.12);

      return {
        ...stock,
        size,
      };
    });
  }, [stocks, timeframe, dimensions.width]);

  const packedBubbles = useMemo(() => {
    if (!bubbles.length) return [];

    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    const headerHeight = 56;
    const watermarkHeight = 50;
    const padding = 2;

    const packed = bubbles.map((bubble, i) => {
      const angle = i * 0.5;
      const radius = 15 + i * 2.5;
      const centerX = containerWidth / 2;
      const centerY = (containerHeight + headerHeight) / 2 - 20;

      return {
        ...bubble,
        x: centerX + Math.cos(angle) * Math.min(radius, containerWidth * 0.35),
        y: centerY + Math.sin(angle) * Math.min(radius, containerHeight * 0.3),
        vx: 0,
        vy: 0,
      };
    });

    const iterations = 180;
    const centerX = containerWidth / 2;
    const centerY = (containerHeight + headerHeight) / 2 - 20;

    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

      for (let i = 0; i < packed.length; i++) {
        const bubble = packed[i];
        const dx = centerX - bubble.x;
        const dy = centerY - bubble.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          bubble.vx += (dx / dist) * 1.0 * alpha;
          bubble.vy += (dy / dist) * 1.0 * alpha;
        }

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

        const margin = bubble.size / 2 + 3;
        if (bubble.x < margin) bubble.vx += (margin - bubble.x) * 0.15;
        if (bubble.x > containerWidth - margin) bubble.vx += (containerWidth - margin - bubble.x) * 0.15;
        if (bubble.y < headerHeight + margin) bubble.vy += (headerHeight + margin - bubble.y) * 0.15;

        const watermarkX = containerWidth - 120;
        const watermarkY = containerHeight - watermarkHeight;
        if (bubble.x > watermarkX - margin && bubble.y > watermarkY - margin) {
          bubble.vx -= 0.5;
          bubble.vy -= 0.5;
        }

        if (bubble.y > containerHeight - margin) bubble.vy += (containerHeight - margin - bubble.y) * 0.15;
      }

      for (const bubble of packed) {
        bubble.x += bubble.vx * 0.35;
        bubble.y += bubble.vy * 0.35;
        bubble.vx *= 0.82;
        bubble.vy *= 0.82;

        const margin = bubble.size / 2 + 2;
        bubble.x = Math.max(margin, Math.min(containerWidth - margin, bubble.x));
        bubble.y = Math.max(headerHeight + margin, Math.min(containerHeight - margin, bubble.y));
      }
    }

    const result = packed.map((bubble) => {
      const storedPos = bubblePositions[bubble.code];
      const finalX = storedPos?.x ?? bubble.x;
      const finalY = storedPos?.y ?? bubble.y;

      let h = 0;
      for (let i = 0; i < bubble.code.length; i++) {
        h = ((h << 5) - h) + bubble.code.charCodeAt(i);
        h |= 0;
      }
      const seed = Math.abs(h);

      return {
        ...bubble,
        x: finalX,
        y: finalY,
        animDelay: (seed % 3000) / 1000,
        animDuration: 4 + (Math.abs(seed * 7 + 13) % 2000) / 1000,
      };
    });

    return result;
  }, [bubbles, dimensions, bubblePositions]);

  const getDistance = (x1, y1, x2, y2) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  const handlePointerDown = (e, bubble) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDraggedCode(bubble.code);

    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX ?? e.touches?.[0]?.clientX;
    pt.y = e.clientY ?? e.touches?.[0]?.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    dragInfoRef.current = {
      code: bubble.code,
      startX: svgP.x,
      startY: svgP.y,
      bubbleStartX: bubble.x,
      bubbleStartY: bubble.y,
    };
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !dragInfoRef.current) return;
    e.preventDefault();

    const svg = svgRef.current;
    if (!svg) return;

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    const deltaX = svgP.x - dragInfoRef.current.startX;
    const deltaY = svgP.y - dragInfoRef.current.startY;

    const newX = dragInfoRef.current.bubbleStartX + deltaX;
    const newY = dragInfoRef.current.bubbleStartY + deltaY;

    setBubblePositions(prev => {
      const newPositions = { ...prev };
      const draggedCode = dragInfoRef.current.code;

      newPositions[draggedCode] = { x: newX, y: newY };

      const draggedBubble = packedBubbles.find(b => b.code === draggedCode);
      if (!draggedBubble) return newPositions;

      packedBubbles.forEach(bubble => {
        if (bubble.code === draggedCode) return;

        const currentX = newPositions[bubble.code]?.x ?? bubble.x;
        const currentY = newPositions[bubble.code]?.y ?? bubble.y;

        const dist = getDistance(newX, newY, currentX, currentY);
        const minDist = (draggedBubble.size + bubble.size) / 2 + 5;
        const influenceRadius = minDist * 2.5;

        if (dist < influenceRadius && dist > 0) {
          const pushStrength = Math.pow(1 - dist / influenceRadius, 2) * 0.4;
          const angle = Math.atan2(currentY - newY, currentX - newX);

          const pushX = Math.cos(angle) * pushStrength * (minDist - dist + 20);
          const pushY = Math.sin(angle) * pushStrength * (minDist - dist + 20);

          const margin = bubble.size / 2 + 2;
          const headerHeight = 56;

          let finalX = currentX + pushX;
          let finalY = currentY + pushY;

          finalX = Math.max(margin, Math.min(dimensions.width - margin, finalX));
          finalY = Math.max(headerHeight + margin, Math.min(dimensions.height - margin, finalY));

          newPositions[bubble.code] = { x: finalX, y: finalY };
        }
      });

      return newPositions;
    });
  }, [isDragging, packedBubbles, dimensions]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setDraggedCode(null);
    dragInfoRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      const options = { passive: false };
      window.addEventListener('pointermove', handlePointerMove, options);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, options);
      window.addEventListener('touchend', handlePointerUp);

      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('touchmove', handlePointerMove);
        window.removeEventListener('touchend', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handleDownload = async () => {
    const svg = svgRef.current;
    if (!svg) return;

    try {
      const svgClone = svg.cloneNode(true);

      const images = svgClone.querySelectorAll('image');
      await Promise.all(Array.from(images).map(async (img) => {
        try {
          const href = img.getAttribute('href');
          if (href && href.startsWith('http')) {
            const response = await fetch(href);
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = () => {
                img.setAttribute('href', reader.result);
                resolve();
              };
              reader.readAsDataURL(blob);
            });
          }
        } catch (e) {
          img.style.display = 'none';
        }
      }));

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgClone);
      svgString = '<?xml version="1.0" encoding="UTF-8"?>' + svgString;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = dimensions.width * 2;
      canvas.height = dimensions.height * 2;

      ctx.fillStyle = '#09090b';
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
      link.download = `aruna-bubbles-${timeframe}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#09090b]">
        <ScatterSkeleton />
      </div>
    );
  }

  if (fullScreen) {
    return (
      <div className="w-full h-screen flex flex-col overflow-hidden" ref={containerRef}>
        <div className="pt-safe absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 gap-2">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0" aria-label="Go back">
            <ArrowLeft className="size-6 text-muted-foreground" />
          </Link>

          <div className="flex-1 flex gap-2 p-1 bg-muted/30 rounded-full max-w-[200px]">
            <button
              onClick={() => setTimeframe("weekly")}
              className={`min-h-11 flex items-center justify-center flex-1 rounded-full text-xs font-semibold transition-all ${timeframe === "weekly"
                  ? "bg-card border-border text-foreground dark:text-white"
                  : "hover:bg-muted"
                }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setTimeframe("monthly")}
              className={`min-h-11 flex items-center justify-center flex-1 rounded-full text-xs font-semibold transition-all ${timeframe === "monthly"
                  ? "bg-card border-border text-foreground dark:text-white"
                  : "hover:bg-muted"
                }`}
            >
              Monthly
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="h-11 w-11 rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0"
            aria-label="Download as image"
          >
            <Download className="size-6 text-muted-foreground" />
          </button>
        </div>

        <div className="relative w-full h-full overflow-hidden touch-none">
          <svg
            ref={svgRef}
            className="w-full h-full"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="#09090b" />

            {packedBubbles.map((bubble, index) => {
              const isPositive = bubble.change >= 0;
              const radius = bubble.size / 2;
              const strokeWidth = Math.max(0.8, radius * 0.03);

              const showLogo = radius > 16;
              const showCode = radius > 12;
              const showPercent = radius > 14;

              const logoSize = Math.min(radius * 0.55, 32);
              const codeFontSize = Math.max(6, Math.min(radius * 0.24, 14));
              const percentFontSize = Math.max(5, Math.min(radius * 0.20, 12));

              const logoY = bubble.y - radius * 0.25;
              const codeY = bubble.y + radius * 0.15;
              const percentY = bubble.y + radius * 0.45;

              const isBeingDragged = isDragging && draggedCode === bubble.code;

              return (
                <g
                  key={bubble.code}
                  style={{
                    animation: isBeingDragged
                      ? 'none'
                      : `bubble-float-${index % 5} ${bubble.animDuration}s ease-in-out infinite`,
                    animationDelay: `${bubble.animDelay}s`,
                    cursor: 'grab',
                    touchAction: 'none',
                    transition: isBeingDragged ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <circle
                    cx={bubble.x}
                    cy={bubble.y}
                    r={radius}
                    fill={isPositive ? "#123d2e" : "#451c1c"}
                    stroke={isPositive ? "#34d399" : "#f87171"}
                    strokeWidth={strokeWidth}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(e) => handlePointerDown(e, bubble)}
                    onTouchStart={(e) => handlePointerDown(e, bubble)}
                  >
                    <title>{`${bubble.name}\n${bubble.change > 0 ? "+" : ""}${bubble.change.toFixed(2)}%`}</title>
                  </circle>

                  {showLogo && (
                    <image
                      href={getIdxLogoUrl(bubble.code)}
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

          <ArunaWatermark className="absolute bottom-4 right-4" />

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

  return null;
}
