import { type ReactNode, useEffect, useState } from 'react'
import { getMetrics, type GroupedAccuracy, type Meta, type Metrics } from '../api/client'
import { BarPanel, type BarRow } from '../components/BarPanel'
import { type Column, DataTable, TablePanel } from '../components/DataTable'
import { DecisionTimeline } from '../components/DecisionTimeline'
import { ErrorHistogram } from '../components/ErrorHistogram'
import { AccuracySkeleton } from '../components/Skeleton'
import { type PanelView, ViewSwitch } from '../components/ViewSwitch'
import { addDays, clockToMinutes, formatDay, formatMW, formatSignedMW, minutesToClock } from '../lib/format'
import './ForecastView.css'
import './AccuracyView.css'

interface Props {
  meta: Meta
  cutoffMinutes: number
  onCutoffChange: (minutes: number) => void
  /** Open a delivery day in the daily view. */
  onOpenDay: (day: string) => void
}

type GroupRow = BarRow & { group: GroupedAccuracy }

const dayColumns = (onOpenDay: (day: string) => void): Column<GroupedAccuracy>[] => [
  {
    key: 'day',
    label: 'Delivery day',
    rowHeader: true,
    value: (g) => String(g.key),
    render: (g) => (
      <button
        type="button"
        className="av__link"
        onClick={(e) => {
          e.stopPropagation()
          onOpenDay(String(g.key))
        }}
      >
        {formatDay(String(g.key))}
      </button>
    ),
  },
  { key: 'bias', label: 'Bias, MW', bar: true, value: (g) => g.bias ?? null, render: (g) => formatSignedMW(g.bias ?? 0) },
  { key: 'mae', label: 'Average miss, MW', firstDir: 'desc', value: (g) => g.mae ?? null, render: (g) => formatMW(g.mae ?? 0) },
  {
    key: 'buffer',
    label: 'Buffer 90%, MW',
    firstDir: 'desc',
    value: (g) => g.buffer_p90 ?? null,
    render: (g) => formatMW(g.buffer_p90 ?? 0),
  },
  { key: 'n', label: 'Hours', value: (g) => g.n },
]

/** The day the forecast overshot most on average. */
const worstDay = (days: GroupedAccuracy[]) =>
  days.reduce<GroupedAccuracy | null>((w, g) => (g.bias != null && g.bias < (w?.bias ?? 0) ? g : w), null)

const toRows = (groups: GroupedAccuracy[], label: (g: GroupedAccuracy) => string, value: 'mae' | 'bias') =>
  groups.map<GroupRow>((g) => ({ key: String(g.key), label: label(g), value: g[value] ?? 0, group: g }))

const groupTooltip = (title: string) => (row: GroupRow) => (
  <>
    <p className="chart__tooltip-time">{title.replace('{}', row.label)}</p>
    <p>Average miss {formatMW(row.group.mae ?? 0)} MW</p>
    <p>Bias {formatSignedMW(row.group.bias ?? 0)} MW</p>
    <p className="chart__tooltip-note">{row.group.n} hours</p>
  </>
)

/** The regular run in use at a cutoff: the latest scheduled publish at or before it. */
const runAt = (schedule: string[], cutoffMinutes: number) =>
  schedule.filter((t) => clockToMinutes(t) <= cutoffMinutes).at(-1) ?? null

function headline(m: Metrics, run: string | null) {
  const { bias, buffer_p90, buffer_p95 } = m.summary
  if (bias == null) return { main: 'No forecasts to score at this decision time.', sub: null }
  const source = run ? `The ${run} forecast` : 'The previous evening’s forecast'
  const main =
    Math.abs(bias) < 50
      ? `${source} was unbiased across January.`
      : `${source} ran ${formatMW(Math.abs(bias))} MW ${bias < 0 ? 'above' : 'below'} actual wind, on average, across January.`
  const sub =
    buffer_p90 != null && buffer_p95 != null
      ? `Buying ${formatMW(buffer_p90)} MW on top of the forecast would have covered the shortfall in 9 of every 10 hours; ${formatMW(buffer_p95)} MW covers 19 in 20.`
      : null
  return { main, sub }
}

/** Groups with too few hours to say anything about (e.g. a handful of calm hours). */
const MIN_LEVEL_HOURS = 24

const gw = (mw: number) => String(Math.round(mw / 1000))

/** Bias at the calmest and windiest well-populated forecast levels, if it grows with wind. */
function levelTrend(m: Metrics) {
  const levels = m.by_level.filter((g) => g.n >= MIN_LEVEL_HOURS && g.bias != null)
  if (levels.length < 2) return null
  const [low, high] = [levels[0], levels[levels.length - 1]]
  if ((high.bias ?? 0) - (low.bias ?? 0) > -1000) return null
  const step = levelStep(m)
  const isTop = high === m.by_level[m.by_level.length - 1]
  return {
    low: { bias: low.bias ?? 0, label: `${gw(Number(low.key))}–${gw(Number(low.key) + step)} GW` },
    high: {
      bias: high.bias ?? 0,
      label: isTop ? `above ${gw(Number(high.key))} GW` : `${gw(Number(high.key))}–${gw(Number(high.key) + step)} GW`,
    },
  }
}

const levelStep = (m: Metrics) =>
  m.by_level.length > 1 ? Number(m.by_level[1].key) - Number(m.by_level[0].key) : 4000

/** Short answers for each chapter, written from the data so they hold at any cutoff. */
function answers(m: Metrics) {
  const days = m.by_day.filter((g) => g.bias != null)
  const over = days.filter((g) => (g.bias ?? 0) < 0).length
  const worst = worstDay(m.by_day)
  const daysAnswer =
    over > days.length / 2
      ? `Most of them. The forecast was too high on ${over} of ${days.length} days.`
      : `Mixed. The forecast was too high on ${over} of ${days.length} days.`
  const worstNote = worst ? ` The worst was ${formatDay(String(worst.key))}, ${formatMW(-(worst.bias ?? 0))} MW too high on average.` : ''

  const hz = m.by_horizon.filter((g) => g.mae != null)
  const hzBias = hz.map((g) => g.bias ?? 0)
  const hzStep = hz.length > 1 ? Number(hz[1].key) - Number(hz[0].key) : 6
  const hzLabel = (g: GroupedAccuracy) => `${g.key}–${Number(g.key) + hzStep} hours`
  let horizonAnswer = ''
  if (hz.length > 1) {
    const [fresh, stale] = [hz[0], hz.at(-1)!]
    const gain = 1 - (fresh.mae ?? 0) / (stale.mae ?? 1)
    const verdict = gain >= 0.2 ? 'Yes.' : gain > 0.05 ? 'Only a little.' : 'No.'
    horizonAnswer = `${verdict} Forecasts ${hzLabel(fresh)} ahead missed by ${formatMW(fresh.mae ?? 0)} MW on average; those ${hzLabel(stale)} ahead, by ${formatMW(stale.mae ?? 0)} MW.`
    if (Math.max(...hzBias) < 0)
      horizonAnswer += ` Every horizon ran too high, so the gap is not just weather that is hard to predict.`
  }

  const trend = levelTrend(m)
  const levelAnswer = trend
    ? `On windy days. When the forecast was ${trend.low.label} it ran ${formatMW(-trend.low.bias)} MW high; ${trend.high.label}, ${formatMW(-trend.high.bias)} MW. That pattern fits wind farms being curtailed when the grid is full, though it isn’t confirmed.`
    : 'The overshoot doesn’t change much with how windy the forecast was.'

  const { bias, buffer_p90, buffer_p95 } = m.summary
  const coverAnswer =
    buffer_p90 != null && buffer_p95 != null
      ? `Holding ${formatMW(buffer_p90)} MW below the forecast covered 9 hours in 10, and ${formatMW(buffer_p95)} MW covered 19 in 20.`
      : null
  // Shifting every error by a constant shifts every quantile by the same amount.
  const split =
    bias != null && buffer_p90 != null && bias < -200
      ? `About ${formatMW(-bias)} MW of that is the steady overshoot. Correct for it first, and ${formatMW(Math.max(0, buffer_p90 + bias))} MW is left for genuine uncertainty.`
      : null

  return { days: daysAnswer + worstNote, horizon: horizonAnswer, level: levelAnswer, cover: coverAnswer, split }
}

/** One question, its answer, and the chart that shows it. */
function Chapter({ title, children, figure }: { title: string; children: ReactNode; figure: ReactNode }) {
  return (
    <section className="av__chapter">
      <div className="av__lede">
        <h3>{title}</h3>
        {children}
      </div>
      <div className="av__figure">{figure}</div>
    </section>
  )
}

export function AccuracyView({ meta, cutoffMinutes, onCutoffChange, onOpenDay }: Props) {
  const cutoff = minutesToClock(cutoffMinutes)
  const [dayView, setDayView] = useState<PanelView>('chart')
  const [result, setResult] = useState<{ cutoff: string; data?: Metrics; error?: string } | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    getMetrics(cutoff, ctrl.signal)
      .then((d) => setResult({ cutoff, data: d }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setResult((r) => ({ ...r, cutoff, error: e.message }))
      })
    return () => ctrl.abort()
  }, [cutoff])

  const loading = result?.cutoff !== cutoff
  const data = result?.data ?? null
  const error = !loading ? (result?.error ?? null) : null

  // A nominal decision day, only used to place the regular schedule on the timeline.
  const nominalDay = addDays(meta.delivery_start, -1)
  const run = runAt(meta.publish_times_utc, cutoffMinutes)
  const iso = (hhmm: string) => `${nominalDay}T${hhmm}:00Z`
  const s = data?.summary
  const text = data ? headline(data, run) : null
  const said = data ? answers(data) : null
  const daySwitch = <ViewSwitch view={dayView} onChange={setDayView} label="Bias by delivery day" />

  const dayRows = data ? toRows(data.by_day, (g) => String(g.key).slice(8), 'bias') : []
  const horizonStep = data && data.by_horizon.length > 1 ? Number(data.by_horizon[1].key) - Number(data.by_horizon[0].key) : 6
  const horizonRows = data
    ? toRows(data.by_horizon, (g) => `${g.key}–${Number(g.key) + horizonStep}h`, 'mae')
    : []
  const hourRows = data ? toRows(data.by_hour, (g) => String(g.key).padStart(2, '0'), 'mae') : []
  const step = data ? levelStep(data) : 4000
  const levelRows = data
    ? toRows(data.by_level.filter((g) => g.n >= MIN_LEVEL_HOURS), (g) => `${gw(Number(g.key))}–${gw(Number(g.key) + step)}`, 'bias')
    : []

  return (
    <div className="fv">
      <div className="deck av__controls">
        <DecisionTimeline
          decisionDay={nominalDay}
          cutoffMinutes={cutoffMinutes}
          onCutoffChange={onCutoffChange}
          runs={meta.publish_times_utc.map(iso)}
          usedRuns={run ? [iso(run)] : []}
          description="The regular forecast schedule on each day before delivery. Drag to see how accuracy changes if the purchase is made earlier or later."
        />
      </div>

      {error && (
        <p className="fv__error" role="alert">
          Couldn’t load the accuracy figures: {error}. Check that the backend is running on port 8000.
        </p>
      )}

      {!data && !error && <AccuracySkeleton />}

      {data && s && text && (
        <div className={`fv__body${loading ? ' fv__body--loading' : ''}`} aria-busy={loading}>
          <header className="fv__headline">
            <p className="fv__date">
              Delivery days {formatDay(meta.delivery_start)} to {formatDay(meta.delivery_end, true)}, decided at {cutoff}{' '}
              the day before
            </p>
            <h2>{text.main}</h2>
            {text.sub && <p className="fv__sub">{text.sub}</p>}
          </header>

          <dl className="av__stats">
            <div>
              <dt>Average miss</dt>
              <dd>
                {formatMW(s.mae ?? 0)} MW
                <small>
                  mean absolute error, {Math.round(s.mae_pct_of_mean_actual ?? 0)}% of average wind output
                </small>
              </dd>
            </div>
            <div>
              <dt>Bias</dt>
              <dd>
                {formatSignedMW(s.bias ?? 0)} MW
                <small>average of actual minus forecast; negative means the forecast was too high</small>
              </dd>
            </div>
            <div>
              <dt>Buffer for 90% of hours</dt>
              <dd>
                {formatMW(s.buffer_p90 ?? 0)} MW
                <small>95% of hours: {formatMW(s.buffer_p95 ?? 0)} MW</small>
              </dd>
            </div>
            <div>
              <dt>Typical range of misses</dt>
              <dd>
                {formatSignedMW(s.error_p10 ?? 0)} to {formatSignedMW(s.error_p90 ?? 0)}
                <small>
                  middle 80% of hours, MW; RMSE {formatMW(s.rmse ?? 0)} MW over {s.n} hours
                </small>
              </dd>
            </div>
          </dl>

          {said && (
            <>
              <Chapter
                title="Was it a few bad days, or most of them?"
                figure={
                  dayView === 'chart' ? (
                    <BarPanel
                      title="Bias by delivery day, MW"
                      sub="Average of actual minus forecast; below zero means the forecast was too high. Select a day to open it."
                      actions={daySwitch}
                      rows={dayRows}
                      height={220}
                      labelEvery={dayRows.length > 16 ? 2 : 1}
                      onSelect={(row) => onOpenDay(row.key)}
                      tooltip={(row) => (
                        <>
                          <p className="chart__tooltip-time">{formatDay(row.key)}</p>
                          <p>Bias {formatSignedMW(row.group.bias ?? 0)} MW</p>
                          <p>Average miss {formatMW(row.group.mae ?? 0)} MW</p>
                          <p className="chart__tooltip-note">Select to open this day</p>
                        </>
                      )}
                    />
                  ) : (
                    <TablePanel
                      title="Bias by delivery day, MW"
                      sub="Select a column heading to sort; the first select on Bias puts the worst day first. Select a day to open it."
                      actions={daySwitch}
                    >
                      <DataTable
                        rows={data.by_day}
                        columns={dayColumns(onOpenDay)}
                        rowKey={(g) => String(g.key)}
                        caption="Forecast accuracy by delivery day"
                        defaultSort={{ key: 'day', dir: 'asc' }}
                        flag={{ row: worstDay(data.by_day), label: 'Worst day' }}
                        onRowSelect={(g) => onOpenDay(String(g.key))}
                      />
                    </TablePanel>
                  )
                }
              >
                <p>{said.days}</p>
              </Chapter>

              <Chapter
                title="Does a fresher forecast do better?"
                figure={
                  <div className="av__pair">
                    <BarPanel
                      title="Average miss by hours ahead, MW"
                      sub="Time between the forecast's publication and the hour it predicts."
                      rows={horizonRows}
                      tooltip={groupTooltip('{} ahead')}
                    />
                    <BarPanel
                      title="Average miss by hour of day, MW"
                      sub="Delivery hour, UK time."
                      rows={hourRows}
                      labelEvery={3}
                      tooltip={groupTooltip('{}:00')}
                    />
                  </div>
                }
              >
                <p>{said.horizon}</p>
              </Chapter>

              <Chapter
                title="When does it overshoot most?"
                figure={
                  <BarPanel
                    title="Bias by forecast level, MW"
                    sub="Hours grouped by the decision-time forecast, GW. Levels with fewer than a day of hours are left out."
                    rows={levelRows}
                    tooltip={(row) => {
                      const g = row.group
                      const actual = g.mean_actual ?? 0
                      return (
                        <>
                          <p className="chart__tooltip-time">Forecast {row.label} GW</p>
                          <p>Bias {formatSignedMW(g.bias ?? 0)} MW</p>
                          <p>
                            Forecast {formatMW(actual - (g.bias ?? 0))} MW, actual {formatMW(actual)} MW on average
                          </p>
                          <p className="chart__tooltip-note">{g.n} hours</p>
                        </>
                      )
                    }}
                  />
                }
              >
                <p>{said.level}</p>
              </Chapter>

              <Chapter
                title="How much cover was needed?"
                figure={<ErrorHistogram bins={data.histogram} bufferP90={s.buffer_p90} bufferP95={s.buffer_p95} />}
              >
                {said.cover && <p>{said.cover}</p>}
                {said.split && <p>{said.split}</p>}
                <p className="av__note">In hindsight, from January’s own data; check other months before trading on it.</p>
              </Chapter>
            </>
          )}

        </div>
      )}
    </div>
  )
}
