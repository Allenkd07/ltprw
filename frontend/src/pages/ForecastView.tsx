import { useEffect, useState } from 'react'
import { getForecast, type DayForecast, type ForecastPoint, type Meta } from '../api/client'
import { type Column, DataTable, TablePanel } from '../components/DataTable'
import { DecisionTimeline } from '../components/DecisionTimeline'
import { ErrorChart } from '../components/ErrorChart'
import { ForecastChart } from '../components/ForecastChart'
import { type PanelView, ViewSwitch } from '../components/ViewSwitch'
import {
  addDays,
  formatClock,
  formatDay,
  formatMW,
  formatSignedMW,
  minutesToClock,
} from '../lib/format'
import './ForecastView.css'

const HOUR_COLUMNS: Column<ForecastPoint>[] = [
  { key: 'hour', label: 'Hour', rowHeader: true, value: (p) => p.startTime, render: (p) => formatClock(p.startTime) },
  { key: 'forecast', label: 'Forecast, MW', firstDir: 'desc', value: (p) => p.forecast, render: (p) => formatMW(p.forecast) },
  {
    key: 'actual',
    label: 'Actual, MW',
    firstDir: 'desc',
    value: (p) => p.actual,
    render: (p) => (p.actual == null ? 'No data' : formatMW(p.actual)),
  },
  {
    key: 'error',
    label: 'Actual − forecast, MW',
    bar: true,
    value: (p) => p.error,
    render: (p) => (p.error == null ? 'No data' : formatSignedMW(p.error)),
  },
  { key: 'run', label: 'Run', value: (p) => p.publishTime, render: (p) => formatClock(p.publishTime) },
  { key: 'ahead', label: 'Hours ahead', value: (p) => p.horizon_h },
]

/** The hour with the largest shortfall, if wind fell short at all. */
const worstHour = (points: ForecastPoint[]) =>
  points.reduce<ForecastPoint | null>((w, p) => (p.error != null && p.error < (w?.error ?? 0) ? p : w), null)

function headline(data: DayForecast) {
  const { bias, n } = data.summary
  if (!n || bias == null) return { main: 'No actual generation recorded for this day yet.', sub: null }
  const main =
    Math.abs(bias) < 50
      ? 'Wind came in almost exactly as forecast.'
      : `Wind came in ${formatMW(Math.abs(bias))} MW ${bias < 0 ? 'below' : 'above'} the forecast on average.`
  const worst = worstHour(data.points)
  const sub = worst
    ? `Biggest shortfall: ${formatMW(-(worst.error as number))} MW at ${formatClock(worst.startTime)}.`
    : 'Wind never fell short of the forecast.'
  return { main, sub }
}

interface Props {
  meta: Meta
  day: string
  onDayChange: (day: string) => void
  cutoffMinutes: number
  onCutoffChange: (minutes: number) => void
}

export function ForecastView({ meta, day, onDayChange: setDay, cutoffMinutes, onCutoffChange }: Props) {
  // Results are tagged with the request they answer, so "loading" is derived, not stored.
  const [result, setResult] = useState<{ key: string; data?: DayForecast; error?: string } | null>(
    null,
  )

  // Kept across day and cutoff changes, so a table reader can step through days.
  const [panelView, setPanelView] = useState<PanelView>('chart')

  const cutoff = minutesToClock(cutoffMinutes)
  const key = `${day}|${cutoff}`

  useEffect(() => {
    const ctrl = new AbortController()
    getForecast(day, cutoff, ctrl.signal)
      .then((d) => setResult({ key: `${day}|${cutoff}`, data: d }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setResult((r) => ({ ...r, key: `${day}|${cutoff}`, error: e.message }))
      })
    return () => ctrl.abort()
  }, [day, cutoff])

  const loading = result?.key !== key
  const data = result?.data ?? null
  const error = !loading ? (result?.error ?? null) : null

  const canPrev = day > meta.delivery_start
  const canNext = day < meta.delivery_end
  const text = data ? headline(data) : null
  const used = data?.publish_times_used ?? []
  const s = data?.summary
  const switcher = <ViewSwitch view={panelView} onChange={setPanelView} label="Wind generation" />

  return (
    <div className="fv">
      <div className="deck fv__controls">
        <div className="fv__day">
          <label htmlFor="delivery-day">Delivery day</label>
          <div className="fv__day-row">
            <button type="button" onClick={() => setDay(addDays(day, -1))} disabled={!canPrev} aria-label="Previous day">
              ‹
            </button>
            <input
              id="delivery-day"
              type="date"
              value={day}
              min={meta.delivery_start}
              max={meta.delivery_end}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
            <button type="button" onClick={() => setDay(addDays(day, 1))} disabled={!canNext} aria-label="Next day">
              ›
            </button>
          </div>
        </div>
        <DecisionTimeline
          decisionDay={addDays(day, -1)}
          cutoffMinutes={cutoffMinutes}
          onCutoffChange={onCutoffChange}
          runs={data?.runs_on_decision_day ?? []}
          usedRuns={used}
        />
      </div>

      {error && (
        <p className="fv__error" role="alert">
          Couldn’t load the forecast: {error}. Check that the backend is running on port 8000.
        </p>
      )}

      {data && text && (
        <div className={`fv__body${loading ? ' fv__body--loading' : ''}`} aria-busy={loading}>
          <header className="fv__headline">
            <p className="fv__date">{formatDay(data.day, true)}</p>
            <h2>{text.main}</h2>
            {text.sub && <p className="fv__sub">{text.sub}</p>}
          </header>

          <div className="fv__grid">
            <div className="fv__charts">
              {panelView === 'chart' ? (
                <ForecastChart data={data} actions={switcher} />
              ) : (
                <TablePanel
                  title="Wind generation, MW"
                  sub="Each hour of the delivery day. Select a column heading to sort; the first select on Actual − forecast puts the biggest shortfall first."
                  actions={switcher}
                >
                  <DataTable
                    rows={data.points}
                    columns={HOUR_COLUMNS}
                    rowKey={(p) => p.startTime}
                    caption={`Hourly forecast and actual wind generation, ${formatDay(data.day, true)}`}
                    defaultSort={{ key: 'hour', dir: 'asc' }}
                    flag={{ row: worstHour(data.points), label: 'Biggest shortfall' }}
                  />
                </TablePanel>
              )}
              <ErrorChart data={data} />
            </div>

            <aside className="fv__summary" aria-label="Day summary">
              <dl>
                <div>
                  <dt>Forecast used</dt>
                  <dd>
                    {used.length ? used.map(formatClock).join(', ') : 'None'}
                    <small>
                      published {formatDay(addDays(data.day, -1))}
                      {data.points.length > 0 &&
                        `, ${data.points[0].horizon_h} to ${data.points.at(-1)!.horizon_h} hours ahead`}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Average miss</dt>
                  <dd>
                    {s?.mae != null ? `${formatMW(s.mae)} MW` : 'No data'}
                    <small>mean absolute error over {s?.n ?? 0} hours</small>
                  </dd>
                </div>
                <div>
                  <dt>Bias</dt>
                  <dd>
                    {s?.bias != null ? `${formatSignedMW(s.bias)} MW` : 'No data'}
                    <small>average of actual minus forecast</small>
                  </dd>
                </div>
                <div>
                  <dt>Buffer for 90% of hours</dt>
                  <dd>
                    {s?.buffer_p90 != null ? `${formatMW(s.buffer_p90)} MW` : 'No data'}
                    <small>extra power that would have covered the shortfall in 9 of 10 hours</small>
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}
