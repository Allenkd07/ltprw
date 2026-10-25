import type { ReactNode } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DayForecast } from '../api/client'
import { type ChartRow, toRows, xDomain, xTicks } from '../lib/chartData'
import { formatClock, formatClockMs, formatMW } from '../lib/format'
import './charts.css'

const lastIndex = (rows: ChartRow[], key: 'actual' | 'forecast') =>
  rows.findLastIndex((r) => r[key] !== undefined)

/** Direct label at the end of a line, so identity never relies on colour alone. */
function endLabel(text: string, index: number) {
  return (props: { index?: number; x?: number | string; y?: number | string }) =>
    props.index === index ? (
      <text x={Number(props.x) + 8} y={Number(props.y)} dy={4} className="chart__end-label">
        {text}
      </text>
    ) : (
      <g />
    )
}

export function ForecastChart({ data, actions }: { data: DayForecast; actions?: ReactNode }) {
  const rows = toRows(data)

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <h3>Wind generation, MW</h3>
        <div className="chart__tools">
          <ul className="chart__legend">
            <li>
              <span className="chart__swatch chart__swatch--actual" /> Actual (half-hourly)
            </li>
            <li>
              <span className="chart__swatch chart__swatch--forecast" /> Forecast at decision time (hourly)
            </li>
          </ul>
          {actions}
        </div>
      </figcaption>
      <div className="chart__plot" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 72, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={xDomain(data.day)}
              ticks={xTicks(data.day)}
              tickFormatter={formatClockMs}
              stroke="var(--rule-strong)"
              tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              width={56}
              tickFormatter={formatMW}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as ChartRow | undefined
                if (!active || !row) return null
                return (
                  <div className="chart__tooltip">
                    <p className="chart__tooltip-time">{formatClockMs(row.t)}</p>
                    {row.actual !== undefined && (
                      <p>
                        <span className="chart__swatch chart__swatch--actual" /> Actual {formatMW(row.actual)} MW
                      </p>
                    )}
                    {row.forecast !== undefined && (
                      <p>
                        <span className="chart__swatch chart__swatch--forecast" /> Forecast {formatMW(row.forecast)} MW
                      </p>
                    )}
                    {row.error != null && (
                      <p className="chart__tooltip-note">
                        {row.error < 0 ? 'Wind short by ' : 'Wind above forecast by '}
                        {formatMW(Math.abs(row.error))} MW
                      </p>
                    )}
                    {row.publishTime && (
                      <p className="chart__tooltip-note">
                        Run {formatClock(row.publishTime)}, {row.horizon}h ahead
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Line
              dataKey="actual"
              stroke="var(--series-actual)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)' }}
              isAnimationActive={false}
              connectNulls
              label={endLabel('Actual', lastIndex(rows, 'actual'))}
            />
            <Line
              dataKey="forecast"
              stroke="var(--series-forecast)"
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: 'var(--panel)', fill: 'var(--series-forecast)' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--panel)' }}
              isAnimationActive={false}
              connectNulls
              label={endLabel('Forecast', lastIndex(rows, 'forecast'))}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
