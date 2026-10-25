import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, ExternalLink,
  CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Database, Download,
  Gauge, LayoutDashboard, RefreshCw, Search, SlidersHorizontal,
  Table2, Wind, Zap,
} from 'lucide-react'
import { BrandMark } from './components/BrandMark'
import { MetricCard } from './components/MetricCard'
import { GenerationChart } from './components/GenerationChart'
import { DailyErrorChart } from './components/DailyErrorChart'
import { exportUrl, fetchAnalysis, type Analysis, type IntervalRecord } from './lib/api'

type View = 'overview' | 'accuracy' | 'data'

function number(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}
function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'Europe/London' }).format(new Date(`${value}T12:00:00+00:00`))
}
function timestampLabel(value: string | null | undefined) {
  if (!value) return 'No eligible forecast'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', timeZoneName: 'short' }).format(new Date(value))
}
function signed(value: number | null | undefined, digits = 0) {
  if (value == null) return '—'
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value), digits)}`
}

function Sidebar({ view, setView, dataMode }: { view: View; setView: (view: View) => void; dataMode?: 'live' | 'demo' }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><BrandMark /><span className="pilot-tag">PILOT</span></div>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className={`nav-link ${view === 'overview' ? 'is-active' : ''}`} onClick={() => setView('overview')}>
          <LayoutDashboard size={17} strokeWidth={1.8} /><span>Overview</span>{view === 'overview' && <i />}
        </button>
        <button className={`nav-link ${view === 'accuracy' ? 'is-active' : ''}`} onClick={() => setView('accuracy')}>
          <Activity size={17} strokeWidth={1.8} /><span>Forecast accuracy</span>{view === 'accuracy' && <i />}
        </button>
        <button className={`nav-link ${view === 'data' ? 'is-active' : ''}`} onClick={() => setView('data')}>
          <Table2 size={17} strokeWidth={1.8} /><span>Data explorer</span>{view === 'data' && <i />}
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-source-icon"><Database size={16} /></div>
        <div className="sidebar-source-copy"><strong>Data source</strong><span>Elexon · BMRS</span></div>
        <span className={`live-indicator ${dataMode === 'demo' ? 'live-indicator--demo' : ''}`} aria-label={dataMode === 'demo' ? 'Synthetic demo data' : dataMode === 'live' ? 'Live Elexon data' : 'Data source status unknown'} />
        <div className="sidebar-footer-rule" />
        <div className="sidebar-meta"><span>WINDLINE / 01</span><span>JAN 2026</span></div>
      </div>
    </aside>
  )
}

function SectionHeading({ eyebrow, title, description, right }: { eyebrow: string; title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="section-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {right && <div className="section-heading__right">{right}</div>}
    </div>
  )
}

function DaySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="date-control">
      <CalendarDays size={16} />
      <span className="sr-only">Purchase decision date</span>
      <input aria-label="Purchase decision date" type="date" min="2026-01-01" max="2026-01-31" value={value} onChange={(event) => { if (event.target.value) onChange(event.target.value) }} />
      <ChevronDown size={14} className="date-chevron" />
    </label>
  )
}

function CutoffControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="cutoff-control">
      <Clock3 size={15} aria-hidden="true" />
      <span className="cutoff-label">Decision cutoff</span>
      <input
        type="time"
        step="60"
        value={value}
        onChange={(event) => { if (event.target.value) onChange(event.target.value) }}
        aria-label="Decision cutoff time in UK local time"
        title="Choose the time when the purchasing decision is made"
      />
    </label>
  )
}

function SourceBanner({ mode, warning }: { mode: 'live' | 'demo'; warning: string | null }) {
  if (mode === 'live' && !warning) return null
  return (
    <div className={`source-banner ${mode === 'demo' ? 'source-banner--demo' : ''}`} role="status">
      <AlertCircle size={16} />
      <div><strong>{mode === 'demo' ? 'Demonstration data' : 'Data source notice'}</strong><span>{warning || 'Synthetic values are being shown for interface demonstration only. They are not Elexon observations.'}</span></div>
    </div>
  )
}

function ForecastSelectionCard({ data, cutoff }: { data: Analysis; cutoff: string }) {
  const matched = data.selected_day.intervals.filter((r: IntervalRecord) => r.status === 'matched').length
  const published = data.selected_day.selected_forecast_publish_time
  const coverage = Math.round(matched / 24 * 100)
  return (
    <aside className="selection-card">
      <div className="selection-card__head"><span className="selection-icon"><Wind size={18} /></span><span className="selection-kicker">DECISION SNAPSHOT</span><span className="selection-lock"><Check size={13} /> AS-OF</span></div>
      <div className="selection-date">{dateLabel(data.selected_day.decision_date, { day: 'numeric', month: 'long' })}</div>
      <div className="selection-subtitle">Decision day <span>→</span> {dateLabel(data.selected_day.delivery_date, { day: 'numeric', month: 'short' })} delivery</div>
      <div className="selection-divider" />
      <div className="selection-row"><span>Cutoff applied</span><strong>{cutoff} UK time</strong></div>
      <div className="selection-row"><span>Latest selected issue</span><strong>{timestampLabel(published)}</strong></div>
      <div className="selection-row"><span>Eligible issues</span><strong>{data.selected_day.forecast_versions_available} <em>vintages</em></strong></div>
      <div className="selection-row"><span>Matched intervals</span><strong>{matched} <em>/ 24</em></strong></div>
      <div className="coverage-track"><div style={{ transform: `scaleX(${coverage / 100})` }} /></div>
      <div className="selection-foot"><span>Matched coverage</span><span>{coverage}%</span></div>
      <div className="selection-note"><CircleHelp size={14} /><span>Only forecast versions published on or before the selected cutoff are eligible.</span></div>
    </aside>
  )
}

function Overview({ data, cutoff, setCutoff, selectedDate, setSelectedDate, setView }: {
  data: Analysis; cutoff: string; setCutoff: (cutoff: string) => void; selectedDate: string; setSelectedDate: (date: string) => void; setView: (view: View) => void
}) {
  const over = data.records.filter((row: IntervalRecord) => row.error_mw != null && row.error_mw > 0).length
  const under = data.records.filter((row: IntervalRecord) => row.error_mw != null && row.error_mw < 0).length
  return (
    <>
      <SectionHeading eyebrow="WIND GENERATION / UK NATIONAL" title="Forecast intelligence" description="A clearer view of what was known before the day-ahead decision." right={<><DaySelector value={selectedDate} onChange={setSelectedDate} /><button className="button button--primary" onClick={() => setView('data')}><Table2 size={15} /> View intervals</button></>} />
      <div className="context-strip"><span className="context-dot" /><span>JANUARY 2026</span><span className="context-separator">/</span><span>DAY-AHEAD ANALYSIS</span><span className="context-spacer" /><CutoffControl value={cutoff} onChange={setCutoff} /><span className="context-subtle">Europe/London</span></div>
      <div className="metrics-grid">
        <MetricCard label="Mean absolute error" value={number(data.metrics.mae_mw)} unit="MW" icon={Gauge} tone="green" note="Lower is better · selected cutoff" />
        <MetricCard label="Forecast bias" value={signed(data.metrics.bias_mw)} unit="MW" icon={data.metrics.bias_mw == null ? Activity : data.metrics.bias_mw > 0 ? ArrowUpRight : ArrowDownRight} tone={data.metrics.bias_mw != null && data.metrics.bias_mw > 0 ? 'amber' : 'blue'} note={data.metrics.bias_mw == null ? 'Awaiting matched data' : data.metrics.bias_mw > 0 ? 'Forecast tends to overstate wind' : data.metrics.bias_mw < 0 ? 'Forecast tends to understate wind' : 'No mean directional bias'} />
        <MetricCard label="Weighted error" value={number(data.metrics.wape_pct, 1)} unit="% WAPE" icon={Activity} tone="blue" note="Absolute error / actual generation" />
        <MetricCard label="Matched intervals" value={number(data.metrics.matched_intervals)} unit={`/ ${number(data.metrics.available_intervals)}`} icon={Check} tone="neutral" note={`${number(data.metrics.coverage_pct, 1)}% evaluation coverage`} />
      </div>
      <div className="main-grid">
        <section className="panel forecast-panel">
          <div className="panel-heading">
            <div><div className="panel-eyebrow">DELIVERY PROFILE</div><h2>Forecast vs actual generation</h2><p>{dateLabel(data.selected_day.delivery_date)} <span className="inline-dot">·</span> 24 hourly periods</p></div>
            <div className="unit-chip">POWER <span>·</span> MW</div>
          </div>
          <GenerationChart records={data.selected_day.intervals} />
          <div className="panel-bottomline"><span><span className="status-square status-square--dark" /> Actual mean <strong>{number(data.selected_day.intervals.filter((r: IntervalRecord) => r.actual_mw != null).reduce((s: number, r: IntervalRecord) => s + (r.actual_mw || 0), 0) / (data.selected_day.intervals.filter((r: IntervalRecord) => r.actual_mw != null).length || 1))} MW</strong></span><span><span className="status-square status-square--lime" /> Forecast mean <strong>{number(data.selected_day.intervals.filter((r: IntervalRecord) => r.forecast_mw != null).reduce((s: number, r: IntervalRecord) => s + (r.forecast_mw || 0), 0) / (data.selected_day.intervals.filter((r: IntervalRecord) => r.forecast_mw != null).length || 1))} MW</strong></span><button className="text-link" onClick={() => setView('accuracy')}>Explore accuracy <ExternalLink size={13} /></button></div>
        </section>
        <ForecastSelectionCard data={data} cutoff={cutoff} />
      </div>
      <div className="lower-grid">
        <section className="panel daily-panel">
          <div className="panel-heading panel-heading--compact"><div><div className="panel-eyebrow">ERROR BY DECISION DAY</div><h2>Daily forecast error</h2><p>MAE across all matched hours, January 2026</p></div><button className="icon-button" aria-label="Open forecast accuracy" onClick={() => setView('accuracy')}><ExternalLink size={16} /></button></div>
          <DailyErrorChart data={data.daily_metrics} onSelect={(day) => setSelectedDate(day)} />
          <div className="chart-footnote">Select a bar to inspect the next day's delivery profile. Blank days indicate no matched observations.</div>
        </section>
        <section className="panel signal-panel">
          <div className="panel-heading panel-heading--compact"><div><div className="panel-eyebrow">DIRECTIONAL SIGNAL</div><h2>Forecast tendency</h2><p>Across matched intervals at this cutoff</p></div><span className="signal-icon"><Zap size={16} /></span></div>
          <div className="signal-counts">
            <div className="signal-count"><span className="signal-swatch signal-swatch--over" /><div><strong>{number(over)}</strong><span>Overforecast periods</span></div></div>
            <div className="signal-count"><span className="signal-swatch signal-swatch--under" /><div><strong>{number(under)}</strong><span>Underforecast periods</span></div></div>
          </div>
          <div className="signal-message"><span className="signal-message__label">HOW TO READ THIS</span><p>Positive error means forecast wind was higher than actual generation. Negative error means actual generation exceeded the forecast.</p></div>
          <button className="button button--secondary button--full" onClick={() => setView('accuracy')}>Open accuracy analysis <ExternalLink size={14} /></button>
        </section>
      </div>
      <div className="fine-print"><span><Database size={13} /> Sources: Elexon FUELHH · WINDFOR</span><span>Purchase decision month is filtered to January 2026; delivery periods are the following day.</span></div>
    </>
  )
}

function Accuracy({ data, cutoff, setSelectedDate, setView }: { data: Analysis; cutoff: string; setSelectedDate: (date: string) => void; setView: (view: View) => void }) {
  const matched = data.records.filter((row: IntervalRecord) => row.status === 'matched')
  const over = matched.filter((row: IntervalRecord) => (row.error_mw || 0) > 0)
  const under = matched.filter((row: IntervalRecord) => (row.error_mw || 0) < 0)
  const largest = [...matched].sort((a: IntervalRecord, b: IntervalRecord) => Math.abs(b.error_mw || 0) - Math.abs(a.error_mw || 0)).slice(0, 8)
  return (
    <>
      <SectionHeading eyebrow="MODEL PERFORMANCE / RETROSPECTIVE" title="Forecast accuracy" description="Measure error using only forecast versions that existed at the purchase decision cutoff." right={<a className="button button--primary" href={exportUrl(cutoff)}><Download size={15} /> Export data</a>} />
      <div className="context-strip"><span className="context-dot" /><span>JANUARY 2026 DECISIONS</span><span className="context-separator">/</span><span>CUTOFF {cutoff} UK</span><span className="context-spacer" /><span className="context-subtle">{number(data.metrics.matched_intervals)} matched intervals</span></div>
      <div className="metrics-grid metrics-grid--accuracy">
        <MetricCard label="MAE" value={number(data.metrics.mae_mw)} unit="MW" icon={Gauge} tone="green" note="Average absolute error" />
        <MetricCard label="RMSE" value={number(data.metrics.rmse_mw)} unit="MW" icon={Activity} tone="blue" note="Penalises larger misses" />
        <MetricCard label="Mean bias" value={signed(data.metrics.bias_mw)} unit="MW" icon={data.metrics.bias_mw != null && data.metrics.bias_mw > 0 ? ArrowUpRight : ArrowDownRight} tone="amber" note="Forecast − actual" />
        <MetricCard label="WAPE" value={number(data.metrics.wape_pct, 1)} unit="%" icon={Gauge} tone="neutral" note="Relative absolute error" />
      </div>
      <div className="main-grid accuracy-layout">
        <section className="panel daily-panel">
          <div className="panel-heading"><div><div className="panel-eyebrow">DAILY VIEW</div><h2>How accuracy changed</h2><p>Daily MAE by purchase decision date; click a bar to inspect that delivery day.</p></div></div>
          <DailyErrorChart data={data.daily_metrics} onSelect={(day) => { setSelectedDate(day); setView('overview') }} />
          <div className="chart-footnote">Days with zero matched intervals have no MAE bar. Use coverage alongside the error metrics.</div>
        </section>
        <section className="panel signal-panel">
          <div className="panel-heading panel-heading--compact"><div><div className="panel-eyebrow">ERROR MIX</div><h2>Directional balance</h2><p>Sign of forecast minus actual</p></div></div>
          <div className="direction-bar"><div className="direction-bar__over" style={{ width: `${matched.length ? over.length / matched.length * 100 : 0}%` }} /><div className="direction-bar__under" style={{ width: `${matched.length ? under.length / matched.length * 100 : 0}%` }} /></div>
          <div className="direction-legend"><span><i className="signal-swatch signal-swatch--over" />Overforecast <strong>{matched.length ? number(over.length / matched.length * 100, 1) : '—'}%</strong></span><span><i className="signal-swatch signal-swatch--under" />Underforecast <strong>{matched.length ? number(under.length / matched.length * 100, 1) : '—'}%</strong></span></div>
          <div className="method-note"><div className="method-note__icon"><CircleHelp size={16} /></div><div><strong>Methodology</strong><p>MAE is the mean of absolute errors; RMSE weights large misses more heavily; bias retains the sign; WAPE divides the sum of absolute errors by total actual generation. Missing pairs are excluded from metric numerators and denominators, and reported separately in coverage.</p></div></div>
        </section>
      </div>
      <section className="panel exceptions-panel">
        <div className="panel-heading"><div><div className="panel-eyebrow">LARGEST DEVIATIONS</div><h2>Hours worth a closer look</h2><p>The eight largest absolute hourly misses. This is a diagnostic list, not a recommendation to trade.</p></div><button className="button button--secondary" onClick={() => setView('data')}><Table2 size={15} /> Open data explorer</button></div>
        <div className="table-shell"><table><thead><tr><th>Decision date</th><th>Delivery period</th><th>Forecast</th><th>Actual</th><th>Error</th><th>Published</th></tr></thead><tbody>{largest.map((row: IntervalRecord) => <tr key={row.delivery_start}><td><button type="button" className="table-link" onClick={() => { setSelectedDate(row.decision_date); setView('overview') }} aria-label={`Inspect decision date ${dateLabel(row.decision_date, { day: 'numeric', month: 'long' })}`}>{dateLabel(row.decision_date, { day: '2-digit', month: 'short' })}</button></td><td>{timestampLabel(row.delivery_start)}</td><td>{number(row.forecast_mw)} MW</td><td>{number(row.actual_mw)} MW</td><td><span className={`error-chip ${(row.error_mw || 0) > 0 ? 'error-chip--positive' : 'error-chip--negative'}`}>{signed(row.error_mw)} MW</span></td><td>{timestampLabel(row.forecast_publish_time)}</td></tr>)}</tbody></table></div>
      </section>
      <div className="fine-print"><span><Database size={13} /> Historical comparison, not a predictive model.</span><span>Results depend on decision cutoff and data completeness.</span></div>
    </>
  )
}

function DataExplorer({ data, cutoff }: { data: Analysis; cutoff: string }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'selected' | 'all'>('selected')
  const [page, setPage] = useState(0)
  const baseRows: IntervalRecord[] = scope === 'selected' ? data.selected_day.intervals : data.records
  const rows = useMemo(() => baseRows.filter((row) => {
    const haystack = [row.decision_date, row.delivery_start, row.delivery_local_time, row.forecast_publish_time, row.status].join(' ').toLowerCase()
    return haystack.includes(query.toLowerCase())
  }), [baseRows, query])
  const PAGE_SIZE = 16
  const maxPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1)
  const visible = rows.slice(Math.min(page, maxPage) * PAGE_SIZE, (Math.min(page, maxPage) + 1) * PAGE_SIZE)
  return (
    <>
      <SectionHeading eyebrow="HOURLY COMPARISONS / AUDIT TRAIL" title="Data explorer" description="Inspect hourly comparisons behind every KPI. Each actual is the mean of two half-hour FUELHH observations; forecast publication time is auditable." right={<a className="button button--primary" href={exportUrl(cutoff)}><Download size={15} /> Download CSV</a>} />
      <div className="context-strip"><span className="context-dot" /><span>JANUARY 2026 DECISIONS</span><span className="context-separator">/</span><span>{number(data.records.length)} EXPECTED PERIODS</span><span className="context-spacer" /><span className="context-subtle">Source rows: {number(data.data_status.actual_rows_loaded)} actuals · {number(data.data_status.forecast_rows_loaded)} forecast versions</span></div>
      <section className="panel explorer-panel">
        <div className="explorer-toolbar">
          <div className="segmented" role="group" aria-label="Data range">
            <button className={scope === 'selected' ? 'is-selected' : ''} onClick={() => { setScope('selected'); setPage(0) }}>Selected delivery day <span>24</span></button>
            <button className={scope === 'all' ? 'is-selected' : ''} onClick={() => { setScope('all'); setPage(0) }}>All decision days <span>744</span></button>
          </div>
          <label className="table-search"><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Search dates or status" /></label>
        </div>
        <div className="table-shell table-shell--explorer"><table><thead><tr><th>Decision date</th><th>Delivery time <span className="th-sub">UK</span></th><th>Forecast <span className="th-sub">MW</span></th><th>Actual <span className="th-sub">MW</span></th><th>Error <span className="th-sub">MW</span></th><th>Forecast published</th><th>Status</th></tr></thead><tbody>
          {visible.map((row) => <tr key={`${row.decision_date}-${row.delivery_start}`}><td>{dateLabel(row.decision_date, { day: '2-digit', month: 'short' })}</td><td><div className="cell-primary">{timestampLabel(row.delivery_start)}</div><div className="cell-subtle">Period starts {row.delivery_local_time}</div></td><td>{number(row.forecast_mw)}</td><td>{number(row.actual_mw)}</td><td>{row.error_mw == null ? '—' : <span className={`error-chip ${row.error_mw > 0 ? 'error-chip--positive' : row.error_mw < 0 ? 'error-chip--negative' : ''}`}>{signed(row.error_mw)}</span>}</td><td>{timestampLabel(row.forecast_publish_time)}</td><td><span className={`status-pill status-pill--${row.status}`}>{row.status === 'matched' ? 'Matched' : row.status === 'missing_forecast' ? 'No forecast' : 'No actual'}</span></td></tr>)}
          {visible.length === 0 && <tr><td colSpan={7} className="empty-row"><Search size={18} /><strong>No matching intervals</strong><span>Try a different date or status.</span></td></tr>}
        </tbody></table></div>
        <div className="table-pagination"><span>Showing <strong>{rows.length ? Math.min(page * PAGE_SIZE + 1, rows.length) : 0}–{Math.min((Math.min(page, maxPage) + 1) * PAGE_SIZE, rows.length)}</strong> of <strong>{number(rows.length)}</strong> intervals</span><div><button className="pagination-button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button><span className="page-number">{Math.min(page + 1, maxPage + 1)} / {maxPage + 1}</span><button className="pagination-button" disabled={page >= maxPage} onClick={() => setPage((p) => Math.min(maxPage, p + 1))}>Next</button></div></div>
      </section>
      <section className="footnote-grid"><div><Database size={16} /><div><strong>Source fields</strong><span>FUELHH fuelType = WIND; generation and startTime. WINDFOR generation, startTime and publishTime.</span></div></div><div><Clock3 size={16} /><div><strong>As-of selection</strong><span>For each hourly delivery interval, select the latest publication timestamp at or before the selected decision cutoff.</span></div></div><div><SlidersHorizontal size={16} /><div><strong>Missing values</strong><span>Missing hourly pairs are not imputed. Each hourly actual requires both underlying FUELHH half-hours; coverage is shown alongside error metrics.</span></div></div></section>
      <div className="fine-print"><span><Database size={13} /> Source attribution: Contains BMRS data © Elexon Limited copyright and database right.</span><span>All times shown in Europe/London.</span></div>
    </>
  )
}

function LoadingState() {
  return <div className="loading-state"><div className="loading-orbit"><Wind size={24} /></div><div className="eyebrow">WINDLINE / DATA ENGINE</div><h2>Preparing your decision view</h2><p>Aligning actual generation with the forecast versions that were available at the selected cutoff.</p><div className="loading-track"><span /></div></div>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-state"><span className="error-icon"><AlertCircle size={22} /></span><h2>We couldn’t load the analysis</h2><p>{message}</p><button className="button button--primary" onClick={onRetry}><RefreshCw size={15} /> Try again</button></div>
}

export default function App() {
  const [view, setView] = useState<View>('overview')
  const [cutoff, setCutoff] = useState('12:00')
  const [selectedDate, setSelectedDate] = useState('2026-01-15')
  const [refreshCount, setRefreshCount] = useState(0)
  const lastConsumedRefresh = useRef(0)
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['analysis', cutoff, selectedDate, refreshCount],
    queryFn: () => {
      const forceRefresh = refreshCount > lastConsumedRefresh.current
      lastConsumedRefresh.current = refreshCount
      return fetchAnalysis(cutoff, selectedDate, forceRefresh)
    },
  })
  const currentTab = view === 'overview' ? 'Overview' : view === 'accuracy' ? 'Forecast accuracy' : 'Data explorer'
  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} dataMode={data?.data_status.mode} />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{currentTab}</strong></div>
          <div className="topbar-right">
            <span className="topbar-context"><span className="context-dot" /> UK NATIONAL WIND</span>
            <span className="topbar-divider" />
            <button className="topbar-button" onClick={() => { setRefreshCount((count) => count + 1) }} disabled={isFetching}><RefreshCw size={15} className={isFetching ? 'spin' : ''} /> <span>{isFetching ? 'Refreshing' : 'Refresh data'}</span></button>
            <a href={exportUrl(cutoff)} className="topbar-export" aria-label="Export January dataset" title="Export January dataset"><Download size={15} /></a>
          </div>
        </header>
        <div className="page-content">
          {isLoading && <LoadingState />}
          {!isLoading && error && <ErrorState message={error instanceof Error ? error.message : 'Unexpected response from the analysis API.'} onRetry={() => { setRefreshCount((n) => n + 1) }} />}
          {!isLoading && data && <>
            <SourceBanner mode={data.data_status.mode} warning={data.data_status.warning} />
            {view === 'overview' && <Overview data={data} cutoff={cutoff} setCutoff={setCutoff} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setView={setView} />}
            {view === 'accuracy' && <Accuracy data={data} cutoff={cutoff} setSelectedDate={setSelectedDate} setView={setView} />}
            {view === 'data' && <DataExplorer key={`${selectedDate}-${cutoff}`} data={data} cutoff={cutoff} />}
          </>}
        </div>
        <footer className="app-footer"><span>WINDLINE <span className="footer-dot">·</span> FORECAST INTELLIGENCE</span><span>Research pilot <span className="footer-dot">·</span> 2026</span></footer>
      </main>
    </div>
  )
}
