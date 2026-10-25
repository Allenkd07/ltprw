import { type ReactNode, useState } from 'react'
import { barExtent } from '../lib/chartScale'
import { type SortDir, type SortValue, sortRows } from '../lib/sort'
import './DataTable.css'

export interface Column<T> {
  key: string
  label: string
  /** Used for sorting and, on bar columns, for the bar length. */
  value: (row: T) => SortValue
  /** Display; defaults to the value. */
  render?: (row: T) => ReactNode
  /** Draw a bar from a zero line next to the number, scaled to the column's range. */
  bar?: boolean
  /** Direction on first click: 'asc' puts the biggest shortfall first on signed columns. */
  firstDir?: SortDir
  /** The row's label column (a <th scope="row">), kept visible when scrolling sideways. */
  rowHeader?: boolean
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Accessible name for the table. */
  caption: string
  defaultSort: { key: string; dir: SortDir }
  /** Marks one row (e.g. the biggest shortfall) with a tinted background and a text tag. */
  flag?: { row: T | null; label: string }
  onRowSelect?: (row: T) => void
  maxHeight?: number
}

/** Fixed-height, sortable table with a sticky header: the chart's data, not a long page. */
export function DataTable<T>({ rows, columns, rowKey, caption, defaultSort, flag, onRowSelect, maxHeight = 360 }: Props<T>) {
  const [sort, setSort] = useState(defaultSort)
  const column = columns.find((c) => c.key === sort.key) ?? columns[0]
  const sorted = sortRows(rows, column.value, sort.dir)
  const barRange = Object.fromEntries(
    columns.filter((c) => c.bar).map((c) => [c.key, barExtent(rows.map(c.value))]),
  )

  const toggle = (c: Column<T>) =>
    setSort((s) =>
      s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.firstDir ?? 'asc' },
    )

  return (
    <div className="dt" style={{ maxHeight }}>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = c.key === sort.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={c.rowHeader ? 'dt__row-head' : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" onClick={() => toggle(c)}>
                    {c.label}
                    <span className={`dt__arrow${active ? ' dt__arrow--on' : ''}`} aria-hidden="true">
                      {active && sort.dir === 'desc' ? '▼' : '▲'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const flagged = flag?.row === row
            return (
              <tr
                key={rowKey(row)}
                className={`${flagged ? 'dt__row--flag' : ''}${onRowSelect ? ' dt__row--select' : ''}`}
                onClick={onRowSelect ? () => onRowSelect(row) : undefined}
              >
                {columns.map((c) => {
                  const content = c.render ? c.render(row) : c.value(row)
                  const Cell = c.rowHeader ? 'th' : 'td'
                  return (
                    <Cell key={c.key} scope={c.rowHeader ? 'row' : undefined} className={c.rowHeader ? 'dt__row-head' : undefined}>
                      {c.bar ? <BarCell value={c.value(row)} range={barRange[c.key]}>{content}</BarCell> : content}
                      {c.rowHeader && flagged && <span className="dt__flag">{flag.label}</span>}
                    </Cell>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BarCell({ value, range, children }: { value: SortValue; range: { lo: number; hi: number }; children: ReactNode }) {
  const v = typeof value === 'number' ? value : null
  const span = range.hi - range.lo
  // Zero line position: at the right edge when every value is negative, so bars use the full track.
  const zero = (-range.lo / span) * 100
  const width = v == null ? 0 : (Math.abs(v) / span) * 100
  return (
    <span className="dt__bar-cell">
      <span className="dt__num">{children}</span>
      <span className="dt__bar" aria-hidden="true" style={{ backgroundPosition: `${zero}% 0` }}>
        {v != null && v !== 0 && (
          <span
            className="dt__bar-fill"
            style={v < 0 ? { right: `${100 - zero}%`, width: `${width}%` } : { left: `${zero}%`, width: `${width}%` }}
          />
        )}
      </span>
    </span>
  )
}

interface TablePanelProps {
  title: string
  sub?: string
  actions?: ReactNode
  children: ReactNode
}

/** Same frame and caption as the chart panels, so switching views keeps the layout steady. */
export function TablePanel({ title, sub, actions, children }: TablePanelProps) {
  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <h3>{title}</h3>
        {actions && <div className="chart__tools">{actions}</div>}
        {sub && <p className="chart__sub">{sub}</p>}
      </figcaption>
      {children}
    </figure>
  )
}
