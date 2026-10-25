import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Metrics } from '../api/client'
import { formatMW, formatSignedMW } from '../lib/format'
import { barSizeFor } from '../lib/chartScale'
import { RoundedBar } from './RoundedBar'
import './charts.css'

const Y_AXIS_W = 40
const MARGIN_RIGHT = 16

interface Props {
  bins: Metrics['histogram']
  bufferP90?: number | null
  bufferP95?: number | null
}

/** Distribution of hourly errors, with the buffer lines that cover 90% / 95% of shortfalls. */
export function ErrorHistogram({ bins, bufferP90, bufferP95 }: Props) {
  const [width, setWidth] = useState(0)
  if (!bins.length) return null

  const step = bins[0].hi - bins[0].lo
  const rows = bins.map((b) => ({ ...b, mid: (b.lo + b.hi) / 2 }))
  const lo = bins[0].lo
  const hi = bins.at(-1)!.hi
  const firstTick = Math.ceil(lo / 2000) * 2000
  const xTicks = Array.from({ length: Math.floor((hi - firstTick) / 2000) + 1 }, (_, i) => firstTick + i * 2000)
  // Adjacent bins sit 2px apart, so the bar is the full slot minus the gap.
  const barSize = barSizeFor(width, bins.length, Y_AXIS_W + MARGIN_RIGHT, 40) + 2

  const bufferLine = (mw: number, label: string, dy: number) => (
    <ReferenceLine
      x={-mw}
      stroke="var(--ink-2)"
      strokeWidth={1}
      label={{ value: label, position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 12, dy, dx: 4 }}
    />
  )

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <h3>How often the forecast missed, by size of miss</h3>
        <p className="chart__sub">
          Hours by actual minus forecast, in {formatMW(step)} MW bins. Everything left of a line is a shortfall
          that buffer would not have covered.
        </p>
      </figcaption>
      <div className="chart__plot" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
          <BarChart data={rows} margin={{ top: 40, right: MARGIN_RIGHT, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis
              dataKey="mid"
              type="number"
              domain={[lo, hi]}
              ticks={xTicks}
              tickFormatter={formatSignedMW}
              stroke="var(--rule-strong)"
              tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              width={Y_AXIS_W}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
            />
            <ReferenceLine x={0} stroke="var(--ink-3)" />
            {bufferP90 != null && bufferP90 > 0 && bufferLine(bufferP90, `90% buffer ${formatMW(bufferP90)} MW`, -34)}
            {bufferP95 != null && bufferP95 > 0 && bufferLine(bufferP95, `95% ${formatMW(bufferP95)} MW`, -18)}
            <Tooltip
              cursor={{ fill: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as (typeof rows)[number] | undefined
                if (!active || !row) return null
                return (
                  <div className="chart__tooltip">
                    <p className="chart__tooltip-time">
                      {formatSignedMW(row.lo)} to {formatSignedMW(row.hi)} MW
                    </p>
                    <p>{row.count} hours</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="count" barSize={barSize} shape={RoundedBar} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
