export type SortDir = 'asc' | 'desc'
export type SortValue = number | string | null

/**
 * A sorted copy of `rows`. Rows without a value (e.g. hours with no actual yet) always go
 * last, whichever the direction, so "worst first" never starts with blanks. Stable for ties.
 */
export function sortRows<T>(rows: readonly T[], value: (row: T) => SortValue, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((row, i) => ({ row, i, v: value(row) }))
    .sort((a, b) => {
      if (a.v == null || b.v == null) return a.v == null ? (b.v == null ? a.i - b.i : 1) : -1
      const c = typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.v).localeCompare(String(b.v))
      return c * sign || a.i - b.i
    })
    .map((x) => x.row)
}
