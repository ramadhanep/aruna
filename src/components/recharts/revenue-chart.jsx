'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function RevenueChart({
  data,
  primaryColor,
  secondaryColor,
  analysisCurrency,
  compactNumberFormatter,
  revenueTooltipFormatter,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 32, bottom: 12, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="periodLabel" tick={{ fontSize: 10 }} />
        <YAxis
          tickFormatter={(value) => (value == null ? '' : compactNumberFormatter.format(value))}
          width={60}
          axisLine={false}
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          formatter={revenueTooltipFormatter}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.periodLabel || ''}
          cursor={{ fill: 'transparent' }}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Bar
          dataKey="revenue"
          name={`Revenue${analysisCurrency ? ` (${analysisCurrency})` : ''}`}
          fill={primaryColor}
          radius={[6, 6, 2, 2]}
        />
        <Bar
          dataKey="earnings"
          name={`Earnings${analysisCurrency ? ` (${analysisCurrency})` : ''}`}
          fill={secondaryColor}
          radius={[6, 6, 2, 2]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
