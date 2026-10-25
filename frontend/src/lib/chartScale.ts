import type { SortValue } from './sort'

/** Bar width that fills each slot minus a visible gap, for a plot of `width` px. */
export const barSizeFor = (width: number, slots: number, axisAndMargin: number, max = 14) =>
  Math.max(2, Math.min(max, (width - axisAndMargin) / slots - 4))

/** Y-axis ticks in whole thousands that always include zero. */
export function thousandTicks(values: number[]) {
  const lo = Math.min(0, Math.floor(Math.min(...values, 0) / 1000) * 1000)
  const hi = Math.max(0, Math.ceil(Math.max(...values, 0) / 1000) * 1000)
  const step = hi - lo > 6000 ? 2000 : 1000
  const first = Math.ceil(lo / step) * step
  const ticks = Array.from({ length: Math.floor((hi - first) / step) + 1 }, (_, i) => first + i * step)
  return { domain: [Math.min(lo, ticks[0]), Math.max(hi, ticks.at(-1)!)] as [number, number], ticks }
}

/** Range of a bar column, always including zero, so the zero line sits where the data needs it. */
export function barExtent(values: SortValue[]) {
  const nums = values.filter((v): v is number => typeof v === 'number')
  const lo = Math.min(0, ...nums)
  const hi = Math.max(0, ...nums)
  return { lo, hi: hi === lo ? lo + 1 : hi }
}
