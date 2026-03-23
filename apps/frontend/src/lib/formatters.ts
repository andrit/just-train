// ------------------------------------------------------------
// lib/formatters.ts (v2.5.0)
//
// Single source of truth for all display formatting functions.
// Previously duplicated across SessionsPage, SessionHistoryPage,
// SessionHistoryPanel, ActiveSessionOverlay.
//
// USAGE:
//   import { formatDate, formatDuration, formatEpley } from '@/lib/formatters'
// ------------------------------------------------------------

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Formats a YYYY-MM-DD date string as a human-readable label.
 * Today / Yesterday / weekday name (within 7 days) / "Mon Mar 18"
 */
export function formatDate(dateStr: string): string {
  const d         = new Date(dateStr + 'T00:00:00')
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  if (daysAgo < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Formats a full date string as long form: "Monday, March 18, 2026"
 */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

// ── Duration formatting ───────────────────────────────────────────────────────

/**
 * Formats a start/end ISO datetime pair as a duration string.
 * Returns null if either value is missing.
 * e.g. "45m" or "1h 15m"
 */
export function formatDuration(
  startTime: string | null | undefined,
  endTime:   string | null | undefined,
): string | null {
  if (!startTime || !endTime) return null
  const mins = Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000
  )
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

/**
 * Formats seconds as a duration string. e.g. 90 → "1:30"
 */
export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Formats an elapsed time from a start ISO string to now.
 * Updates reactively when called inside a component with a tick.
 * e.g. "4:32" or "1:04:32"
 */
export function formatElapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

// ── Fitness metrics ───────────────────────────────────────────────────────────

/**
 * Epley 1RM estimate: weight × (1 + reps / 30)
 * Returns null if weight or reps are missing/zero.
 * Rounds to 1 decimal place.
 */
export function formatEpley(
  weight: number | null | undefined,
  reps:   number | null | undefined,
): number | null {
  if (!weight || !reps || reps <= 0) return null
  return Math.round((weight * (1 + reps / 30)) * 10) / 10
}

/**
 * Single-set volume: weight × reps
 * Returns null if either value is missing.
 */
export function formatVolume(
  weight: number | null | undefined,
  reps:   number | null | undefined,
): number | null {
  if (!weight || !reps) return null
  return weight * reps
}

/**
 * Formats a set's logged values as a compact string.
 * e.g. "100 × 8", "30s", "400m", "moderate"
 */
export function formatSetSummary(set: {
  weight?:          number | null
  reps?:            number | null
  durationSeconds?: number | null
  distance?:        number | null
  intensity?:       string | null
}): string {
  const parts: string[] = []
  if (set.weight         != null) parts.push(String(set.weight))
  if (set.weight != null && set.reps != null) parts.push('×')
  if (set.reps           != null) parts.push(String(set.reps))
  if (set.durationSeconds!= null) parts.push(`${set.durationSeconds}s`)
  if (set.distance       != null) parts.push(`${set.distance}m`)
  if (set.intensity      != null) parts.push(set.intensity)
  return parts.join(' ')
}

// ── Volume totals ─────────────────────────────────────────────────────────────

/**
 * Formats a total volume number compactly.
 * e.g. 1200 → "1.2k", 850 → "850"
 */
export function formatTotalVolume(volume: number): string {
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`
  return volume.toLocaleString()
}
