import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

type Props = {
  label: string
  value: string
  unit?: string
  icon: LucideIcon
  note: string
  tone?: 'green' | 'blue' | 'amber' | 'neutral'
  trend?: 'up' | 'down' | 'flat'
}

export function MetricCard({ label, value, unit, icon: Icon, note, tone = 'neutral', trend }: Props) {
  return (
    <article className="metric-card">
      <div className="metric-card__top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon metric-icon--${tone}`}><Icon size={17} strokeWidth={1.8} /></span>
      </div>
      <div className="metric-value-row">
        <span className="metric-value">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      <div className="metric-note">
        {trend === 'up' && <ArrowUpRight size={14} />}
        {trend === 'down' && <ArrowDownRight size={14} />}
        {trend === 'flat' && <Minus size={14} />}
        <span>{note}</span>
      </div>
    </article>
  )
}
