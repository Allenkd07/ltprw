import { describe, expect, it } from 'vitest'
import { sortRows } from './sort'

type Row = { id: string; error: number | null }

const rows: Row[] = [
  { id: 'a', error: -500 },
  { id: 'b', error: null },
  { id: 'c', error: 120 },
  { id: 'd', error: -3576 },
  { id: 'e', error: 120 },
]
const ids = (r: Row[]) => r.map((x) => x.id).join('')
const byError = (r: Row) => r.error

describe('sortRows', () => {
  it('sorts numbers ascending, so the biggest shortfall comes first', () => {
    expect(ids(sortRows(rows, byError, 'asc'))).toBe('daceb')
  })

  it('sorts numbers descending', () => {
    expect(ids(sortRows(rows, byError, 'desc'))).toBe('ceadb')
  })

  it('keeps rows without a value last in both directions', () => {
    expect(sortRows(rows, byError, 'asc').at(-1)?.id).toBe('b')
    expect(sortRows(rows, byError, 'desc').at(-1)?.id).toBe('b')
  })

  it('keeps the original order for ties', () => {
    const sorted = ids(sortRows(rows, byError, 'desc'))
    expect(sorted.indexOf('c')).toBeLessThan(sorted.indexOf('e'))
  })

  it('sorts strings such as ISO dates and times', () => {
    const days = [{ d: '2026-01-15' }, { d: '2026-01-02' }, { d: '2026-02-01' }]
    expect(sortRows(days, (x) => x.d, 'asc').map((x) => x.d)).toEqual(['2026-01-02', '2026-01-15', '2026-02-01'])
  })

  it('does not modify the input', () => {
    const before = ids(rows)
    sortRows(rows, byError, 'asc')
    expect(ids(rows)).toBe(before)
  })
})
