'use client'

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface BarChartProps {
  data: Record<string, unknown>[]
  xKey: string
  bars: { key: string; color: string; label: string }[]
  layout?: 'horizontal' | 'vertical'
  height?: number
}

export function BarChart({
  data,
  xKey,
  bars,
  layout = 'horizontal',
  height = 300,
}: BarChartProps) {
  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={isVertical ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 8, bottom: 0, left: isVertical ? 60 : -16 }}
      >
        <CartesianGrid
          stroke="var(--border-default)"
          strokeDasharray="4 4"
          horizontal={!isVertical}
          vertical={isVertical}
        />
        {isVertical ? (
          <>
            <XAxis
              type="number"
              fontSize={12}
              fontFamily="var(--font-mono)"
              tick={{ fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              fontSize={12}
              fontFamily="var(--font-body)"
              tick={{ fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              fontSize={12}
              fontFamily="var(--font-body)"
              tick={{ fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              fontSize={12}
              fontFamily="var(--font-mono)"
              tick={{ fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
          }}
        />
        {bars.map((bar) => (
          <Bar key={bar.key} dataKey={bar.key} name={bar.label} fill={bar.color} radius={[4, 4, 0, 0]} />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
