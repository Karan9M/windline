import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { IntervalRecord } from '../lib/api'

function formatNumber(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(value)
}

export function GenerationChart({ records }: { records: IntervalRecord[] }) {
  const data = useMemo(() => records.map((row) => ({
    time: row.delivery_local_time,
    forecast: row.forecast_mw,
    actual: row.actual_mw,
  })), [records])

  return (
    <div className="chart-wrap chart-wrap--generation">
      <div className="chart-legend">
        <span><i className="legend-dot legend-dot--forecast" /> Forecast at cutoff</span>
        <span><i className="legend-dot legend-dot--actual" /> Actual generation</span>
      </div>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="time" tickLine={false} axisLine={false} interval={records.length > 30 ? 7 : 3} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={10} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} width={42} />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '4 4' }}
              contentStyle={{ border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 8px 28px rgba(16,31,43,.08)', fontSize: 12, background: 'var(--surface)' }}
              labelStyle={{ color: 'var(--muted)', marginBottom: 5 }}
              formatter={(value, name) => [`${formatNumber(Number(value))} MW`, name === 'forecast' ? 'Forecast' : 'Actual']}
              labelFormatter={(label) => `${label} UK time`}
            />
            <Line type="monotone" dataKey="forecast" name="forecast" stroke="var(--lime-deep)" strokeWidth={2.1} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false} />
            <Line type="monotone" dataKey="actual" name="actual" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-footnote">Each point represents a one-hour delivery period. Actual generation is the mean of the two half-hour FUELHH observations in that hour. Forecast versions published after the decision cutoff are excluded.</div>
    </div>
  )
}
