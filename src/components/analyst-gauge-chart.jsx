"use client";

import { memo } from "react";

/**
 * Semicircle gauge chart for analyst rating.
 * score: 1 (Strong Buy) → 5 (Strong Sell), matching Yahoo Finance's recommendationMean scale.
 */
export const AnalystGaugeChart = memo(function AnalystGaugeChart({ score }) {
  const cx = 120, cy = 104, r = 78, trackW = 15;
  const toPoint = (a, rad) => ({
    x: cx + rad * Math.cos(a),
    y: cy - rad * Math.sin(a),
  });
  const arc = (a1, a2, rad = r) => {
    const s = toPoint(a1, rad);
    const e = toPoint(a2, rad);
    const large = Math.abs(a1 - a2) > Math.PI ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${rad} ${rad} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };
  const zones = [
    [Math.PI, Math.PI * 0.8, '#ef4444'],
    [Math.PI * 0.8, Math.PI * 0.6, '#f97316'],
    [Math.PI * 0.6, Math.PI * 0.4, '#eab308'],
    [Math.PI * 0.4, Math.PI * 0.2, '#22c55e'],
    [Math.PI * 0.2, 0, '#10b981'],
  ];
  // score=1 → p=1 (right/Strong Buy), score=5 → p=0 (left/Strong Sell)
  const p = score != null ? Math.min(1, Math.max(0, (5 - score) / 4)) : null;
  const needleAngle = p != null ? Math.PI * (1 - p) : null;
  const tip = needleAngle != null ? toPoint(needleAngle, r * 0.68) : null;
  const activeColor = p != null ? zones[Math.min(4, Math.floor(p * 5))][2] : null;
  // Labels at each zone midpoint, placed outside the arc
  const labelDefs = [
    { angle: Math.PI * 0.9, text: 'Strong\nSell', anchor: 'end', offR: 22 },
    { angle: Math.PI * 0.7, text: 'Sell', anchor: 'end', offR: 18 },
    { angle: Math.PI * 0.5, text: 'Neutral', anchor: 'middle', offR: 18 },
    { angle: Math.PI * 0.3, text: 'Buy', anchor: 'start', offR: 18 },
    { angle: Math.PI * 0.1, text: 'Strong\nBuy', anchor: 'start', offR: 22 },
  ];
  return (
    <svg viewBox="0 0 240 128" className="w-full max-w-[260px] mx-auto select-none">
      {/* Subtle background track */}
      <path d={arc(Math.PI, 0)} fill="none" stroke="currentColor" strokeOpacity={0.07} strokeWidth={trackW + 8} />
      {/* Muted zone segments */}
      {zones.map(([a1, a2], i) => (
        <path key={i} d={arc(a1, a2)} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={trackW} strokeLinecap="butt" />
      ))}
      {/* Active zone fill */}
      {tip && needleAngle != null && (
        <path d={arc(Math.PI, needleAngle)} fill="none" stroke={activeColor} strokeWidth={trackW} strokeLinecap="butt" />
      )}
      {/* Zone labels */}
      {labelDefs.map(({ angle, text, anchor, offR }, i) => {
        const pt = toPoint(angle, r + offR);
        const lines = text.split('\n');
        return (
          <text key={i} x={pt.x.toFixed(1)} y={pt.y.toFixed(1)} textAnchor={anchor} fontSize="7.5" fill="currentColor" opacity="0.5">
            {lines.map((ln, j) => (
              <tspan key={j} x={pt.x.toFixed(1)} dy={j === 0 ? 0 : '1.3em'}>{ln}</tspan>
            ))}
          </text>
        );
      })}
      {/* Needle */}
      {tip && (
        <>
          <line
            x1={cx} y1={cy}
            x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
            stroke={activeColor ?? 'currentColor'} strokeWidth={2.5} strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={6} fill={activeColor ?? 'currentColor'} />
          <circle cx={cx} cy={cy} r={3.5} fill={activeColor ?? 'currentColor'} opacity="0.2" />
        </>
      )}
    </svg>
  );
});
