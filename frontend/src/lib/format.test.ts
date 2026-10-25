import { describe, expect, it } from 'vitest'
import {
  addDays,
  clockToMinutes,
  formatClock,
  formatClockMs,
  formatDay,
  formatMW,
  formatSignedMW,
  minutesToClock,
} from './format'

describe('formatMW', () => {
  it('rounds to whole MW with thousands separators', () => {
    expect(formatMW(1746.4)).toBe('1,746')
    expect(formatMW(17805)).toBe('17,805')
    expect(formatMW(0)).toBe('0')
  })
})

describe('formatSignedMW', () => {
  it('uses a real minus sign and an explicit plus', () => {
    expect(formatSignedMW(-1746)).toBe('−1,746')
    expect(formatSignedMW(426)).toBe('+426')
  })

  it('shows zero without a sign', () => {
    expect(formatSignedMW(0)).toBe('0')
  })
})

describe('clock helpers', () => {
  it('reads the time straight from a UTC timestamp, whatever the local time zone', () => {
    expect(formatClock('2026-01-14T07:30:00Z')).toBe('07:30')
    expect(formatClockMs(Date.parse('2026-01-15T13:30:00Z'))).toBe('13:30')
  })

  it('converts between minutes and HH:MM', () => {
    expect(minutesToClock(0)).toBe('00:00')
    expect(minutesToClock(540)).toBe('09:00')
    expect(minutesToClock(1410)).toBe('23:30')
    expect(clockToMinutes('09:30')).toBe(570)
  })

  it('round-trips every cutoff the timeline can produce', () => {
    for (let m = 0; m < 24 * 60; m += 30) expect(clockToMinutes(minutesToClock(m))).toBe(m)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-02', -1)).toBe('2026-01-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('formatDay', () => {
  it('formats the calendar day in UTC', () => {
    // ICU versions differ on the comma after the weekday.
    expect(formatDay('2026-01-15')).toMatch(/^Thu,? 15 Jan$/)
    expect(formatDay('2026-02-01', true)).toMatch(/^Sun,? 1 Feb 2026$/)
  })
})
