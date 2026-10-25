import { type ReactNode, useState } from 'react'
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
import { formatMW } from '../lib/format'
import { barSizeFor, thousandTicks } from '../lib/chartScale'
import { RoundedBar } from './RoundedBar'
import './charts.css'

const Y_AXIS_W = 56
const MARGIN_RIGHT = 16

export interface BarRow {
  key: string
  /** Short x-axis label. */
  label: string
  value: number
}

interface Props<R extends BarRow> {
  title: string
  sub?: string
  /** Controls for the panel header, e.g. a chart/table switch. */
  actions?: ReactNode
  rows: R[]
  height?: number
  /** Show every nth x label (1 = all). */
  labelEvery?: number
  tooltip: (row: R) => ReactNode
  onSelect?: (row: R) => void
}

/** One neutral bar per category on a single MW axis; signed values hang from the zero line. */
export function BarPanel<R extends BarRow>({
  title,
  sub,
  actions,
  rows,
  height = 200,
  labelEvery = 1,
  tooltip,
  onSelect,
}: Props<R>) {
  const [width, setWidth] = useState(0)
  const barSize = barSizeFor(width, rows.length, Y_AXIS_W + MARGIN_RIGHT, 28)
  const { domain, ticks } = thousandTicks(rows.map((r) => r.value))

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <h3>{title}</h3>
        {actions && <div className="chart__tools">{actions}</div>}
        {sub && <p className="chart__sub">{sub}</p>}
      </figcaption>
      <div className={`chart__plot${onSelect ? ' chart__plot--clickable' : ''}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
          <BarChart data={rows} margin={{ top: 8, right: MARGIN_RIGHT, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis
              dataKey="label"
              interval={labelEvery - 1}
              stroke="var(--rule-strong)"
              tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              width={Y_AXIS_W}
              domain={domain}
              ticks={ticks}
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
                const row = payload?.[0]?.payload as R | undefined
                return active && row ? <div className="chart__tooltip">{tooltip(row)}</div> : null
              }}
            />
            <Bar
              dataKey="value"
              barSize={barSize}
              shape={RoundedBar}
              isAnimationActive={false}
              onClick={onSelect ? (d) => onSelect(d.payload as R) : undefined}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
