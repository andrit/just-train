import { describe, it, expect } from 'vitest'
import { resolveNameTokens, formatShortDate, defaultSessionName } from '@/lib/sessionName'

describe('formatShortDate', () => {
  it('formats YYYY-MM-DD as "MMM-DD-YY", zero-padding the day', () => {
    expect(formatShortDate('2026-07-28')).toBe('Jul-28-26')
    expect(formatShortDate('2026-07-05')).toBe('Jul-05-26')
    expect(formatShortDate('2026-01-01')).toBe('Jan-01-26')
  })

  it('returns the raw string on an invalid date', () => {
    expect(formatShortDate('not-a-date')).toBe('not-a-date')
  })
})

describe('resolveNameTokens', () => {
  const ctx = { date: '2026-07-28' }

  it('substitutes {date} with the friendly short date', () => {
    expect(resolveNameTokens('Leg Day - {date}', ctx)).toBe('Leg Day - Jul-28-26')
  })

  it('is case-insensitive on the token key', () => {
    expect(resolveNameTokens('{Date}', ctx)).toBe('Jul-28-26')
    expect(resolveNameTokens('{DATE}', ctx)).toBe('Jul-28-26')
  })

  it('leaves token-free names unchanged', () => {
    expect(resolveNameTokens('Push Day', ctx)).toBe('Push Day')
  })

  it('leaves unknown tokens untouched', () => {
    expect(resolveNameTokens('{client} - {date}', ctx)).toBe('{client} - Jul-28-26')
  })

  it('replaces multiple {date} occurrences', () => {
    expect(resolveNameTokens('{date} / {date}', ctx)).toBe('Jul-28-26 / Jul-28-26')
  })
})

describe('defaultSessionName', () => {
  it('date-stamps the fallback name', () => {
    expect(defaultSessionName('2026-08-28')).toBe('Session - Aug-28-26')
  })

  it('matches what typing "Session - {date}" by hand produces', () => {
    // The default and a hand-written token name must be indistinguishable —
    // otherwise a defaulted session looks second-class in history.
    const byHand = resolveNameTokens('Session - {date}', { date: '2026-08-28' })
    expect(defaultSessionName('2026-08-28')).toBe(byHand)
  })
})
