// lib/serializeDates.ts — every `Date` anywhere in a response tree → ISO string.
//
// Drizzle returns `timestamp` columns as Date; every response schema declares
// them as strings. Top-level-only conversions kept 500ing the moment a nested
// relation carried its own createdAt (templateExercises → exercise → media,
// exercise → media) — found by the real-database lane, invisible to mocked
// tests whose factories already hold strings. One deep pass, used at the
// reply boundary, closes the class rather than the instance.

export function serializeDates<T>(value: T): T {
  if (value instanceof Date) return value.toISOString() as unknown as T
  if (Array.isArray(value)) return value.map(serializeDates) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = serializeDates(v)
    return out as T
  }
  return value
}
