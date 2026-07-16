// ------------------------------------------------------------
// schema/idempotency.ts — Idempotency keys for offline write replay
//
// When the offline queue replays a mutation on reconnect, a write the
// server already processed but whose HTTP response was lost would be
// inserted a second time. The client sends an `Idempotency-Key` header —
// a per-operation UUID generated before the FIRST attempt and reused on
// every replay. This table records each key with the response the server
// produced, so a replayed request returns the stored response instead of
// re-running the mutation.
//
// See lib/idempotency.ts for the preHandler/onSend hooks, and
// design/offline-contract.md for which writes are replayed offline.
// ------------------------------------------------------------

import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { trainers } from './trainers'

export const idempotencyKeys = pgTable('idempotency_keys', {
  // The client-generated key (crypto.randomUUID). This IS the dedup identity
  // and is globally unique, so it is the primary key. Stored as text (not uuid)
  // so a malformed client key is rejected as a normal request, never a 500.
  key: text('key').primaryKey(),

  // Owner, captured when the request was authenticated. Nullable so the hook
  // never depends on auth-hook ordering — the key alone is the dedup identity.
  trainerId: uuid('trainer_id').references(() => trainers.id, { onDelete: 'cascade' }),

  method: text('method').notNull(),   // POST | PATCH | DELETE
  path:   text('path').notNull(),     // request URL — audit only

  // Response captured on the ORIGINAL request, replayed verbatim to duplicates.
  // Null while the original is still in flight (lets a concurrent replay 409).
  responseStatus: integer('response_status'),
  responseBody:   text('response_body'),   // serialized JSON string; null for 204

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  createdAtIdx: index('idempotency_keys_created_at_idx').on(t.createdAt),
}))

export type IdempotencyKey    = typeof idempotencyKeys.$inferSelect
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert
