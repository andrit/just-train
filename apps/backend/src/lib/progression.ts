// lib/progression.ts — pure trend math for per-exercise weight progression.
//
// Given a weight-over-time series (one point per session), report the trend:
// a least-squares SLOPE (robust to a single noisy session) for the direction,
// and the first→last DELTA as the human-facing number ("+20 lb over 6 wks").
// No I/O — unit-tested in __tests__/lib/progression.test.ts.

export interface WeightPoint {
  date:   string   // ISO date (session date)
  weight: number
}

export interface WeightTrend {
  direction:        'up' | 'flat' | 'down'
  deltaFirstToLast: number   // latest weight − earliest weight (display number)
  slopePerWeek:     number   // least-squares slope, weight units per week
  spanWeeks:        number   // weeks between first and last point
  points:           number   // data points used
}

const DAY_MS = 86_400_000
// Below this |slope| (weight/week) we call it flat — filters numerical noise.
const FLAT_EPS = 0.01

const ms   = (d: string): number => new Date(d).getTime()
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
const round1 = (n: number): number => Math.round(n * 10) / 10
const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Trend of a weight series. Points are sorted by date and non-finite weights
 * dropped. 0 or 1 usable points → a flat, zero trend.
 */
export function weightTrend(series: WeightPoint[]): WeightTrend {
  const pts = series
    .filter((p) => Number.isFinite(p.weight))
    .sort((a, b) => ms(a.date) - ms(b.date))

  const n = pts.length
  if (n === 0) return { direction: 'flat', deltaFirstToLast: 0, slopePerWeek: 0, spanWeeks: 0, points: 0 }

  const first = pts[0]
  const last  = pts[n - 1]
  if (!first || !last) return { direction: 'flat', deltaFirstToLast: 0, slopePerWeek: 0, spanWeeks: 0, points: n }

  const spanWeeks = round1((ms(last.date) - ms(first.date)) / DAY_MS / 7)
  if (n === 1) return { direction: 'flat', deltaFirstToLast: 0, slopePerWeek: 0, spanWeeks: 0, points: 1 }

  const delta = round1(last.weight - first.weight)

  // Least-squares slope of weight (y) vs. time in weeks (x, from the first point).
  const t0 = ms(first.date)
  const xs = pts.map((p) => (ms(p.date) - t0) / DAY_MS / 7)
  const ys = pts.map((p) => p.weight)
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx
    num += dx * ((ys[i] ?? 0) - my)
    den += dx * dx
  }
  // den === 0 when every session shares a date — no time axis, treat as flat.
  const slope = den === 0 ? 0 : round2(num / den)

  const direction: WeightTrend['direction'] =
    slope > FLAT_EPS ? 'up' : slope < -FLAT_EPS ? 'down' : 'flat'

  return { direction, deltaFirstToLast: delta, slopePerWeek: slope, spanWeeks, points: n }
}
