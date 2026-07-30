export function PortfolioMiniChart({ data, isPositive, width = 92, height = 44, fullWidth = false, className = '' }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <div style={{ width, height }} className="rounded-full bg-muted/40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const baseWidth = fullWidth ? 100 : width;
  const baseHeight = height;
  const coordinates = data.map((value, index) => {
    const x = (index / (data.length - 1)) * baseWidth;
    const y = baseHeight - ((value - min) / range) * baseHeight;
    return { x, y };
  });

  const linePath = coordinates
    .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const firstValue = data[0];
  const baselineY = baseHeight - ((firstValue - min) / range) * baseHeight;

  return (
    <svg
      width={fullWidth ? '100%' : width}
      height={fullWidth ? '100%' : height}
      viewBox={`0 0 ${baseWidth} ${baseHeight}`}
      preserveAspectRatio={fullWidth ? 'none' : 'xMidYMid meet'}
      className={`overflow-visible ${className}`}
    >
      <line
        x1="0" y1={baselineY} x2={baseWidth} y2={baselineY}
        stroke="currentColor" strokeWidth="0.8" strokeDasharray="2,2"
        opacity="0.25" className="text-muted-foreground"
      />
      <path
        d={linePath} fill="none" stroke={strokeColor}
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      />
      <circle
        cx={coordinates[coordinates.length - 1].x}
        cy={coordinates[coordinates.length - 1].y}
        r={2.2} fill={strokeColor}
      />
    </svg>
  );
}
