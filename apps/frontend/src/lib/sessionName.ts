// ------------------------------------------------------------
// lib/sessionName.ts — resolve {token} placeholders in a session name.
//
// Tokens are resolved at SAVE time and the literal result is stored, so what's
// stored is exactly what people see. Extensible: add to TOKENS to support more.
//   {date} → the session's date, short friendly form e.g. "Jul-28-26"
// Unknown {tokens} and token-free names pass through unchanged. Case-insensitive.
// ------------------------------------------------------------

export interface NameTokenContext {
  /** Session date, "YYYY-MM-DD". */
  date: string
}

/** "2026-07-28" → "Jul-28-26" (short month · zero-padded day · 2-digit year). */
export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  const mon = d.toLocaleDateString('en-US', { month: 'short' })
  const day = String(d.getDate()).padStart(2, '0')
  const yy  = String(d.getFullYear()).slice(-2)
  return `${mon}-${day}-${yy}`
}

/**
 * The name given to a session the user finished without naming — "Session - Aug-28-26".
 *
 * Stored, not computed at render, for two reasons: the monthly report builds its
 * session table on the backend (`report.service.ts`) and prints the name only when
 * present, so a render-time fallback would show in the app and vanish from the
 * email; and this file's own rule is that what is stored is exactly what people
 * see. Identical in form to typing "Session - {date}" by hand, so a default and a
 * hand-written name are indistinguishable — which is the point. Editable after the
 * fact like any other name.
 */
export function defaultSessionName(date: string): string {
  return `Session - ${formatShortDate(date)}`
}

/** Replace known {tokens} in `name`; unknown tokens are left as-is. */
export function resolveNameTokens(name: string, ctx: NameTokenContext): string {
  const tokens: Record<string, () => string> = {
    date: () => formatShortDate(ctx.date),
  }
  return name.replace(/\{(\w+)\}/g, (match, key: string) => {
    const fn = tokens[key.toLowerCase()]
    return fn ? fn() : match
  })
}
