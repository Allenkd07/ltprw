import type { DayForecast } from '../api/client'
import { dayStartMs } from './format'

export const HOUR_MS = 3_600_000

export interface ChartRow {
  t: number
  actual?: number
  forecast?: number
  error?: number | null
  publishTime?: string
  horizon?: number
}

/** Merge half-hourly actuals with hourly forecasts onto one time axis. */
export function toRows(data: DayForecast): ChartRow[] {
  const rows = new Map<number, ChartRow>()
  for (const a of data.actuals_half_hourly) {
    const t = Date.parse(a.startTime)
    rows.set(t, { t, actual: a.generation })
  }
  for (const p of data.points) {
    const t = Date.parse(p.startTime)
    rows.set(t, {
      ...rows.get(t),
      t,
      forecast: p.forecast,
      error: p.error,
      publishTime: p.publishTime,
      horizon: p.horizon_h,
    })
  }
  return [...rows.values()].sort((a, b) => a.t - b.t)
}

/**
 * Shared x-range for the stacked charts so their time axes line up. Half an hour of padding
 * at the start gives the 00:00 error bar room; the end is the last half-hour actual.
 */
export const xDomain = (day: string): [number, number] => [
  dayStartMs(day) - HOUR_MS / 2,
  dayStartMs(day) + 23.5 * HOUR_MS,
]

/** X-axis ticks every 3 hours across the delivery day. */
export const xTicks = (day: string) =>
  [0, 3, 6, 9, 12, 15, 18, 21].map((h) => dayStartMs(day) + h * HOUR_MS)
