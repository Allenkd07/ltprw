import { describe, expect, it } from 'vitest'
import { barExtent, barSizeFor, thousandTicks } from './chartScale'

describe('thousandTicks', () => {
  it('pads all-negative values up to a zero line', () => {
    // Bias by forecast level in January: every bar is below zero.
    expect(thousandTicks([-4551, -278])).toEqual({
      domain: [-5000, 0],
      ticks: [-5000, -4000, -3000, -2000, -1000, 0],
    })
  })

  it('starts all-positive values at zero', () => {
    expect(thousandTicks([1200, 2900])).toEqual({ domain: [0, 3000], ticks: [0, 1000, 2000, 3000] })
  })

  it('keeps zero as a tick when wide ranges switch to 2,000 MW steps', () => {
    // Regression: stepping 2,000 from -7,000 would give -5,000, -3,000, -1,000, +1,000 and skip zero.
    const { domain, ticks } = thousandTicks([-6200, 1500])
    expect(ticks).toEqual([-6000, -4000, -2000, 0, 2000])
    expect(domain).toEqual([-7000, 2000])
  })

  it('handles an all-zero series', () => {
    expect(thousandTicks([0, 0]).ticks).toContain(0)
  })
})

describe('barSizeFor', () => {
  it('fills each slot minus a gap', () => {
    expect(barSizeFor(400, 31, 72)).toBeCloseTo(328 / 31 - 4)
  })

  it('is capped at the maximum width', () => {
    expect(barSizeFor(1000, 10, 100)).toBe(14)
    expect(barSizeFor(1000, 10, 100, 40)).toBe(40)
  })

  it('never goes below 2px, even before the chart has been measured', () => {
    expect(barSizeFor(0, 31, 72)).toBe(2)
  })
})

describe('barExtent', () => {
  it('ends at zero when every value is negative, so bars use the whole track', () => {
    expect(barExtent([-3553, -500, null])).toEqual({ lo: -3553, hi: 0 })
  })

  it('spans both signs when values are mixed', () => {
    expect(barExtent([-3070, 115, null])).toEqual({ lo: -3070, hi: 115 })
  })

  it('never has zero width', () => {
    expect(barExtent([0, null])).toEqual({ lo: 0, hi: 1 })
  })
})
