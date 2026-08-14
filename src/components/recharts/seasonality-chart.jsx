'use client';

import {
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

export function SeasonalityChart({
  data,
  linesData,
  quarterFilter,
  scaleChoice,
  formatTick,
  formatYAxis,
  formatTooltip,
  formatTooltipDate,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="dayOfYear"
          tickFormatter={formatTick}
          ticks={quarterFilter === 'all' ? [1, 91, 182, 274] : undefined}
          className="text-2xs"
          height={30}
        />
        <YAxis
          orientation="right"
          scale={scaleChoice === 'log' ? 'log' : 'linear'}
          domain={scaleChoice === 'log' ? ['auto', 'auto'] : ['auto', 'auto']}
          tickFormatter={formatYAxis}
          className="text-2xs"
          width={45}
          allowDataOverflow={false}
        />
        <Tooltip
          formatter={formatTooltip}
          labelFormatter={formatTooltipDate}
          contentStyle={TOOLTIP_STYLE}
        />
        {linesData.length > 0 ? (
          <Legend
            align="left"
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
          />
        ) : null}
        {linesData.map((line) => (
          <Area
            key={line.key}
            type="monotone"
            dataKey={line.key}
            stroke={line.color}
            fill="transparent"
            fillOpacity={0}
            name={line.name}
            dot={false}
            strokeWidth={1.5}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
