'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'

interface DonutChartProps {
  data: { name: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
}

export function DonutChart({ data, height = 300, centerLabel = 'Total' }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + (d.value || 0), 0)

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={92}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              boxShadow: 'var(--shadow-elevated)',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
            }}
            labelStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--text-secondary)' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Total no centro do donut (área do gráfico, acima da legenda) */}
      <div className="absolute left-0 right-0 top-0 bottom-9 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-mono-lg font-semibold text-content-primary tabular-nums leading-none">
          {total.toLocaleString('pt-BR')}
        </span>
        <span className="text-overline uppercase text-content-tertiary mt-1">{centerLabel}</span>
      </div>
    </div>
  )
}
