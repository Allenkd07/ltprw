import { clockToMinutes, formatClock, formatDay, minutesToClock } from '../lib/format'
import './DecisionTimeline.css'

interface Props {
  /** The day before delivery (YYYY-MM-DD), when the purchase decision is made. */
  decisionDay: string
  cutoffMinutes: number
  onCutoffChange: (minutes: number) => void
  /** ISO publish times of every forecast run on the decision day. */
  runs: string[]
  /** ISO publish time(s) of the run(s) the forecast view is using. */
  usedRuns: string[]
  /** Replaces the default caption under the heading. */
  description?: string
}

const DAY_MINUTES = 24 * 60
const STEP = 30
const HOUR_MARKS = [0, 6, 12, 18, 24]

const pct = (minutes: number) => `${(minutes / DAY_MINUTES) * 100}%`

/** A 24h strip for D-1 showing which forecast runs exist before the decision cutoff. */
export function DecisionTimeline({
  decisionDay,
  cutoffMinutes,
  onCutoffChange,
  runs,
  usedRuns,
  description,
}: Props) {
  const cutoff = minutesToClock(cutoffMinutes)

  return (
    <section className="timeline" aria-labelledby="timeline-title">
      <div className="timeline__head">
        <h2 id="timeline-title">Decision time</h2>
        <p>
          {description ??
            `Forecast runs published on ${formatDay(decisionDay)}, the day before delivery. Drag to move the cutoff.`}
        </p>
      </div>

      <div className="timeline__track">
        <div className="timeline__past" style={{ width: pct(cutoffMinutes) }} />
        {runs.map((iso) => {
          const minutes = clockToMinutes(formatClock(iso))
          const state = usedRuns.includes(iso)
            ? 'used'
            : minutes <= cutoffMinutes
              ? 'available'
              : 'later'
          return (
            <div key={iso} className={`timeline__run timeline__run--${state}`} style={{ left: pct(minutes) }}>
              <span className="timeline__run-label">{formatClock(iso)}</span>
              <span className="timeline__run-dot" />
            </div>
          )
        })}
        <div className="timeline__cutoff" style={{ left: pct(cutoffMinutes) }}>
          <span>{cutoff}</span>
        </div>
        <input
          className="timeline__input"
          type="range"
          min={0}
          max={DAY_MINUTES - STEP}
          step={STEP}
          value={cutoffMinutes}
          onChange={(e) => onCutoffChange(Number(e.target.value))}
          aria-label="Decision cutoff time on the day before delivery"
          aria-valuetext={`${cutoff} UK time`}
        />
      </div>

      <div className="timeline__hours" aria-hidden="true">
        {HOUR_MARKS.map((h) => (
          <span key={h} style={{ left: pct(h * 60) }}>
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>

      <ul className="timeline__key">
        <li>
          <span className="timeline__run-dot timeline__run-dot--used" /> In use
        </li>
        <li>
          <span className="timeline__run-dot timeline__run-dot--available" /> Earlier run
        </li>
        <li>
          <span className="timeline__run-dot timeline__run-dot--later" /> Not yet published
        </li>
      </ul>
    </section>
  )
}
