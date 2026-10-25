export type IntervalRecord = {
  decision_date: string
  delivery_start: string
  delivery_local_time: string
  forecast_mw: number | null
  actual_mw: number | null
  error_mw: number | null
  abs_error_mw: number | null
  forecast_publish_time: string | null
  forecast_lead_minutes: number | null
  status: 'matched' | 'missing_forecast' | 'missing_actual'
}

export type DailyMetric = {
  decision_date: string
  delivery_date: string
  mae_mw: number | null
  bias_mw: number | null
  matched_intervals: number
  forecast_coverage_pct: number
}

export type Analysis = {
  decision_month: string
  decision_cutoff: string
  timezone: string
  interpretation: string
  metrics: {
    mae_mw: number | null
    rmse_mw: number | null
    bias_mw: number | null
    wape_pct: number | null
    matched_intervals: number
    available_intervals: number
    coverage_pct: number
  }
  daily_metrics: DailyMetric[]
  records: IntervalRecord[]
  selected_day: {
    decision_date: string
    delivery_date: string
    selected_forecast_publish_time: string | null
    forecast_versions_available: number
    intervals: IntervalRecord[]
  }
  data_status: {
    mode: 'live' | 'demo'
    source: string
    retrieved_at: string
    forecast_rows_loaded: number
    actual_rows_loaded: number
    warning: string | null
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export async function fetchAnalysis(cutoff: string, selectedDate: string, refresh = false): Promise<Analysis> {
  const url = new URL(`${API_BASE}/api/v1/analysis`, window.location.origin)
  url.searchParams.set('decision_cutoff', cutoff)
  url.searchParams.set('selected_decision_date', selectedDate)
  if (refresh) url.searchParams.set('refresh', 'true')
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail || `Unable to load analysis (${response.status})`)
  }
  return response.json() as Promise<Analysis>
}

export function exportUrl(cutoff: string): string {
  const url = new URL(`${API_BASE}/api/v1/export.csv`, window.location.origin)
  url.searchParams.set('decision_cutoff', cutoff)
  return url.toString()
}
