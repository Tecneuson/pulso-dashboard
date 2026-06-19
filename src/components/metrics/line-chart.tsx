'use client'

import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface LineChartProps {
  data: Record<string, unknown>[]
  xKey: string
  lines: { key: string; color: string; label: string }[]
  height?: number
}

export function LineChart({ data, xKey, lines, height = 300 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid
          stroke="var(--border-default)"
          strokeDasharray="4 4"
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          fontSize={12}
          fontFamily="var(--font-mono)"
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
        <Tooltip
          cursor={{ stroke: 'var(--border-hover)', strokeWidth: 1 }}
          contentStyle={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-elevated)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
          }}
          labelStyle={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}
          itemStyle={{ color: 'var(--text-primary)' }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.label}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
