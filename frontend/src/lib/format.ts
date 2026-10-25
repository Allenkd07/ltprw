// All timestamps are UTC, which equals UK local time throughout January.

const mwFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export const formatMW = (mw: number) => mwFormat.format(Math.round(mw))

/** Signed MW, with a real minus sign. */
export const formatSignedMW = (mw: number) =>
  `${mw > 0 ? '+' : mw < 0 ? '−' : ''}${formatMW(Math.abs(mw))}`

/** "07:30" from an ISO timestamp. */
export const formatClock = (iso: string) => iso.slice(11, 16)

export const formatClockMs = (ms: number) => new Date(ms).toISOString().slice(11, 16)

/** "Thu 15 Jan" from "2026-01-15". */
export const formatDay = (day: string, withYear = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const dayStartMs = (day: string) => Date.parse(`${day}T00:00:00Z`)

/** Minutes since midnight <-> "HH:MM". */
export const minutesToClock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export const clockToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
