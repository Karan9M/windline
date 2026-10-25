import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DailyMetric } from '../lib/api'

export function DailyErrorChart({
  data,
  onSelect,
}: {
  data: DailyMetric[]
  onSelect?: (date: string) => void
}) {
  const chartData = useMemo(
    () =>
      data.map((row) => ({
        day: row.decision_date.slice(-2),
        decisionDate: row.decision_date,
        mae: row.mae_mw,
      })),
    [data],
  )

  return (
    <div className="chart-wrap chart-wrap--daily">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 12, right: 4, bottom: 0, left: -12 }}
        >
          <CartesianGrid
            stroke="var(--line)"
            strokeDasharray="3 5"
            vertical={false}
          />

          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            interval={2}
          />

          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            width={44}
            tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
          />

          <Tooltip
            cursor={{ fill: 'var(--surface-soft)' }}
            contentStyle={{
              border: '1px solid var(--line)',
              borderRadius: 12,
              boxShadow: '0 8px 28px rgba(16,31,43,.08)',
              fontSize: 12,
              background: 'var(--surface)',
            }}
            formatter={(value) => [
              value == null
                ? 'No matched intervals'
                : `${Number(value).toLocaleString('en-GB', {
                    maximumFractionDigits: 0,
                  })} MW`,
              'Daily MAE',
            ]}
            labelFormatter={(label) => `Decision day · Jan ${label}`}
          />

          <Bar
            dataKey="mae"
            fill="var(--lime-deep)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            cursor="pointer"
            onClick={(item) => {
              const decisionDate = item.payload?.decisionDate

              if (typeof decisionDate === 'string') {
                onSelect?.(decisionDate)
              }
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}