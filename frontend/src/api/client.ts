// Typed client for the FastAPI backend. In dev, Vite proxies /api to localhost:8000;
// in the Docker image the backend serves this app from the same origin.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export interface Health {
  status: string
  data_loaded: boolean
}

export interface Meta {
  delivery_start: string
  delivery_end: string
  default_cutoff: string
  publish_times_utc: string[]
}

export interface AccuracySummary {
  n: number
  mae?: number | null
  rmse?: number | null
  bias?: number | null
  mean_actual?: number | null
  mae_pct_of_mean_actual?: number | null
  error_p10?: number | null
  error_p50?: number | null
  error_p90?: number | null
  buffer_p90?: number | null
  buffer_p95?: number | null
}

export interface GroupedAccuracy extends AccuracySummary {
  /** Hour of day (0-23), horizon bucket start in hours, forecast bucket start in MW, or delivery day (YYYY-MM-DD). */
  key: number | string
}

export interface Metrics {
  cutoff: string
  summary: AccuracySummary
  by_hour: GroupedAccuracy[]
  by_horizon: GroupedAccuracy[]
  by_level: GroupedAccuracy[]
  by_day: GroupedAccuracy[]
  histogram: { lo: number; hi: number; count: number }[]
}

export interface ForecastPoint {
  startTime: string
  publishTime: string
  horizon_h: number
  forecast: number
  actual: number | null
  /** actual - forecast, MW. Negative = wind below forecast. */
  error: number | null
}

export interface DayForecast {
  day: string
  cutoff: string
  publish_times_used: string[]
  runs_on_decision_day: string[]
  points: ForecastPoint[]
  actuals_half_hourly: { startTime: string; generation: number }[]
  summary: AccuracySummary
}

async function get<T>(path: string, params?: Record<string, string>, signal?: AbortSignal) {
  const qs = params ? `?${new URLSearchParams(params)}` : ''
  const res = await fetch(`${API_BASE}/api${path}${qs}`, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export const getHealth = () => get<Health>('/health')
export const getMeta = (signal?: AbortSignal) => get<Meta>('/meta', undefined, signal)
export const getForecast = (day: string, cutoff: string, signal?: AbortSignal) =>
  get<DayForecast>('/forecast', { day, cutoff }, signal)
export const getMetrics = (cutoff: string, signal?: AbortSignal) =>
  get<Metrics>('/metrics', { cutoff }, signal)
