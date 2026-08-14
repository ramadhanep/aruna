'use client';

import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
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

export function EarningsChart({
  data,
  secondaryColor,
  formatEarningsValue,
  renderEarningsTick,
  renderEstimateDot,
  renderActualDot,
  earningsTooltipFormatter,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 20, right: 48, bottom: 32, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="periodLabel" interval={0} height={48} tick={renderEarningsTick} />
        <YAxis
          tickFormatter={(value) => (value == null ? '' : formatEarningsValue(value))}
          width={50}
          axisLine={false}
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          formatter={earningsTooltipFormatter}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.periodLabel || ''}
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          key="earnings-estimate"
          type="monotone"
          dataKey="estimate"
          stroke="transparent"
          dot={renderEstimateDot}
          activeDot={false}
        />
        <Line
          key="earnings-actual"
          type="monotone"
          dataKey="actual"
          stroke="transparent"
          dot={renderActualDot}
          activeDot={false}
        >
          <ErrorBar
            dataKey="range"
            direction="y"
            stroke={secondaryColor}
            strokeDasharray="3 3"
            width={0}
          />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
