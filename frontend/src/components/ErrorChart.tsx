import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DayForecast } from '../api/client'
import { xDomain, xTicks } from '../lib/chartData'
import { formatClockMs, formatMW, formatSignedMW } from '../lib/format'
import { barSizeFor, thousandTicks } from '../lib/chartScale'
import { RoundedBar } from './RoundedBar'
import './charts.css'

const Y_AXIS_W = 56
const MARGIN_RIGHT = 72

export function ErrorChart({ data }: { data: DayForecast }) {
  const rows = data.points
    .filter((p) => p.error != null)
    .map((p) => ({ t: Date.parse(p.startTime), error: p.error as number }))

  // Bars fill each hourly slot minus a visible gap; slot width depends on the container.
  const [width, setWidth] = useState(0)
  const barSize = barSizeFor(width, 24, Y_AXIS_W + MARGIN_RIGHT)
  const { domain, ticks: yTicks } = thousandTicks(rows.map((r) => r.error))

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <h3>Actual minus forecast, MW</h3>
        <p className="chart__sub">Bars below zero are hours when wind fell short and extra power had to be bought.</p>
      </figcaption>
      <div className="chart__plot" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
          <ComposedChart data={rows} margin={{ top: 8, right: MARGIN_RIGHT, bottom: 0, left: 0 }}>
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
              width={Y_AXIS_W}
              domain={domain}
              ticks={yTicks}
              tickFormatter={formatMW}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="var(--ink-2)" />
            <Tooltip
              cursor={{ fill: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as { t: number; error: number } | undefined
                if (!active || !row) return null
                return (
                  <div className="chart__tooltip">
                    <p className="chart__tooltip-time">{formatClockMs(row.t)}</p>
                    <p>{formatSignedMW(row.error)} MW</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="error" barSize={barSize} shape={RoundedBar} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
