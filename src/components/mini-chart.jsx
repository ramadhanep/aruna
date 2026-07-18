import { cn } from "@/lib/utils"

function MiniChart({ data, isPositive, width = 72, height = 36 }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className="rounded-md bg-muted/40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const coordinates = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  const linePath = coordinates
    .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const strokeColor = isPositive ? "#10b981" : "#ef4444";

  const firstValue = data[0];
  const baselineY = height - ((firstValue - min) / range) * height;

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <line
        x1="0" y1={baselineY} x2={width} y2={baselineY}
        stroke="currentColor" strokeWidth="0.8" strokeDasharray="2,2"
        opacity="0.3" className="text-muted-foreground"
      />
      <path
        d={linePath} fill="none" stroke={strokeColor}
        strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      />
      <circle
        cx={coordinates[coordinates.length - 1].x}
        cy={coordinates[coordinates.length - 1].y}
        r={2.4} fill={strokeColor}
      />
    </svg>
  );
}

export { MiniChart }
