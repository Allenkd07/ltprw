import { describe, expect, it } from 'vitest'
import type { DayForecast } from '../api/client'
import { HOUR_MS, toRows, xDomain, xTicks } from './chartData'

const RUN = '2026-01-14T07:30:00Z'

const day: DayForecast = {
  day: '2026-01-15',
  cutoff: '09:00',
  publish_times_used: [RUN],
  runs_on_decision_day: [RUN],
  points: [
    { startTime: '2026-01-15T00:00:00Z', publishTime: RUN, horizon_h: 16.5, forecast: 1000, actual: 1100, error: 100 },
    { startTime: '2026-01-15T01:00:00Z', publishTime: RUN, horizon_h: 17.5, forecast: 2000, actual: 1500, error: -500 },
    // Forecast hour with no actual yet.
    { startTime: '2026-01-15T02:00:00Z', publishTime: RUN, horizon_h: 18.5, forecast: 3000, actual: null, error: null },
  ],
  actuals_half_hourly: [
    { startTime: '2026-01-15T00:30:00Z', generation: 1200 },
    { startTime: '2026-01-15T00:00:00Z', generation: 1100 },
    { startTime: '2026-01-15T01:00:00Z', generation: 1500 },
  ],
  summary: { n: 2 },
}

describe('toRows', () => {
  const rows = toRows(day)
  const at = (iso: string) => rows.find((r) => r.t === Date.parse(iso))

  it('puts half-hourly actuals and hourly forecasts on one sorted time axis', () => {
    expect(rows.map((r) => new Date(r.t).toISOString().slice(11, 16))).toEqual([
      '00:00',
      '00:30',
      '01:00',
      '02:00',
    ])
  })

  it('merges an actual and a forecast for the same hour into one row', () => {
    expect(at('2026-01-15T01:00:00Z')).toMatchObject({
      actual: 1500,
      forecast: 2000,
      error: -500,
      publishTime: RUN,
      horizon: 17.5,
    })
  })

  it('leaves the half-hour between forecasts as actual only', () => {
    const row = at('2026-01-15T00:30:00Z')
    expect(row?.actual).toBe(1200)
    expect(row?.forecast).toBeUndefined()
  })

  it('keeps forecast hours that have no actual', () => {
    const row = at('2026-01-15T02:00:00Z')
    expect(row?.forecast).toBe(3000)
    expect(row?.actual).toBeUndefined()
    expect(row?.error).toBeNull()
  })
})

describe('x axis', () => {
  const start = Date.parse('2026-01-15T00:00:00Z')

  it('spans the delivery day with half an hour of padding before 00:00', () => {
    expect(xDomain('2026-01-15')).toEqual([start - HOUR_MS / 2, start + 23.5 * HOUR_MS])
  })

  it('ticks every 3 hours from midnight', () => {
    const ticks = xTicks('2026-01-15')
    expect(ticks).toHaveLength(8)
    expect(ticks[0]).toBe(start)
    expect(ticks[7]).toBe(start + 21 * HOUR_MS)
  })
})
