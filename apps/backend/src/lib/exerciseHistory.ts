// lib/exerciseHistory.ts — pure selection helper for exercise history.
//
// The history endpoint asks the DB for recent sets across several sessions and
// then has to narrow that to "the last session". No I/O — the route does the
// query, this picks the rows. Unit-tested.

/**
 * Take the rows belonging to the first row's session.
 *
 * Grouping is by session id, never by date: `sessions.date` is text 'YYYY-MM-DD'
 * with no time component, so two completed sessions on the same day (two-a-days,
 * morning cardio + evening lifting) are indistinguishable by date. Filtering on
 * the date string keeps both, and the result interleaves as [1,1,2,2,3,3] —
 * callers that index by set position then read the other session's set 1 as
 * their set 2.
 *
 * Assumes `rows` arrives ordered newest-session-first (the route orders by
 * date desc, createdAt desc, setNumber), so rows[0] identifies the target
 * session and its own rows are already in set order.
 */
export function mostRecentSessionSets<T extends { sessionId: string }>(
  rows: T[],
  max = 10,
): T[] {
  const first = rows[0]
  if (!first) return []
  return rows.filter((r) => r.sessionId === first.sessionId).slice(0, max)
}
