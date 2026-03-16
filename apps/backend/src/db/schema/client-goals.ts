// ------------------------------------------------------------
// schema/client-goals.ts — Client Goal history table (Phase 3C)
//
// Goals are tracked as a history, not a single field.
// This enables:
//   - Full goal arc narrative in monthly reports
//   - "Then vs. now" on goal state across progression phases
//   - SaaS signal: clients stuck in assessment with no clear goal
//
// A client can have multiple active goals (achievedAt = null).
// When a goal is achieved, achievedAt is set.
// Goals are never deleted — they are part of the client's history.
// ------------------------------------------------------------

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { relations }                       from 'drizzle-orm'
import { ProgressionStateEnum }            from '@trainer-app/shared'
import { clients, progressionStateEnum }   from './trainers'

export const clientGoals = pgTable('client_goals', {
  id:       uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),

  // Plain-English goal statement — what the client is working toward
  goal: text('goal').notNull(),

  // The client's progression state at the time this goal was set.
  // Useful for filtering by phase in reports ("goals set during programming").
  progressionState: progressionStateEnum('progression_state').notNull().default('assessment'),

  // When this goal was recorded
  setAt: timestamp('set_at').notNull().defaultNow(),

  // When this goal was achieved — null means still in progress
  achievedAt: timestamp('achieved_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type ClientGoal    = typeof clientGoals.$inferSelect
export type NewClientGoal = typeof clientGoals.$inferInsert

// ── Relations ────────────────────────────────────────────────────────────────
export const clientGoalsRelations = relations(clientGoals, ({ one }) => ({
  client: one(clients, {
    fields:     [clientGoals.clientId],
    references: [clients.id],
  }),
}))
