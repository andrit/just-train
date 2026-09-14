// ------------------------------------------------------------
// schema/client-events.ts — first-party product telemetry
//
// The app reports a handful of usage events (offline cache hits, queue
// flushes, sessions completed, records detected) to its own database —
// no third-party analytics, no cookie, nothing leaves the product. This is
// the Phase 18 "offline usage tracked" deliverable and the seed of the
// product counters the value chain names.
//
// Row shape is deliberately PostHog-`capture`-compatible (distinct id, event
// name, properties, client timestamp) so a vendor sink can be added later by
// mapping fields, never by re-instrumenting the app. See lib/telemetry/sink.ts.
//
// Counters, not a firehose: the client sends per-session aggregates
// ({ count }) rather than one row per cache hit.
// ------------------------------------------------------------

import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { trainers } from './trainers'

export const clientEvents = pgTable('client_events', {
  id:        uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),                 // e.g. 'offline.cache_hit'
  props:     jsonb('props').$type<Record<string, unknown>>(),
  clientTs:  timestamp('client_ts', { withTimezone: true }).notNull(), // when it happened on the device
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  trainerNameTsIdx: index('client_events_trainer_name_ts_idx').on(t.trainerId, t.name, t.createdAt),
}))

export type ClientEvent    = typeof clientEvents.$inferSelect
export type NewClientEvent = typeof clientEvents.$inferInsert
