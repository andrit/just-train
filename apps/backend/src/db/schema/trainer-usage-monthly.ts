// ------------------------------------------------------------
// schema/trainer-usage-monthly.ts — Monthly usage rollup (Phase 3D)
//
// One row per trainer per calendar month. Written by a background
// job or updated incrementally on each relevant event.
//
// PURPOSE:
//   This is the billing meter. When Stripe or any billing system
//   needs to know what a trainer used in a given month, it reads
//   this table — not raw sessions or clients.
//
//   It also powers:
//     - The trainer's usage dashboard ("here's what you used this month")
//     - Internal analytics for pricing decisions
//     - Churn signals (usage dropping month-over-month)
//
// KEY METRIC — activeClientCount:
//   Clients who had at least one completed session in the period.
//   This is the recommended primary value metric for pricing:
//   it scales exactly with the value a trainer delivers (a client
//   they're actively training = a client generating income for them).
//
// POPULATION STRATEGY (deferred to billing phase):
//   Option A: Nightly background job recalculates the current month's row.
//   Option B: Increment counters in-place on each relevant API event.
//   Option B is simpler to implement first. Option A catches edge cases.
//   See DEFERRED_ITEMS.md.
//
// UNIQUENESS:
//   One row per (trainerId, periodYear, periodMonth).
//   Upsert on conflict — the job always has current data.
// ------------------------------------------------------------

import { pgTable, uuid, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { relations }                                  from 'drizzle-orm'
import { trainers }                                   from './trainers'

export const trainerUsageMonthly = pgTable('trainer_usage_monthly', {
  id:        uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id, { onDelete: 'cascade' }),

  // The billing period this row covers
  periodYear:  integer('period_year').notNull(),   // e.g. 2025
  periodMonth: integer('period_month').notNull(),  // 1–12

  // ── Core value metrics ────────────────────────────────────────────────────

  // Clients who had at least one completed session this month.
  // PRIMARY BILLING METRIC — scales with value delivered.
  activeClientCount: integer('active_client_count').notNull().default(0),

  // Total sessions with status='completed' this month.
  // Secondary metric — reflects usage intensity.
  sessionsCompleted: integer('sessions_completed').notNull().default(0),

  // ── Data richness metrics ──────────────────────────────────────────────────

  // Individual set entries logged this month.
  // Proxy for session depth — a trainer logging 20 sets/session
  // is more engaged than one logging 5.
  totalSetsLogged: integer('total_sets_logged').notNull().default(0),

  // Baseline snapshots taken this month.
  // Reflects how diligently the trainer tracks client progress.
  snapshotsTaken: integer('snapshots_taken').notNull().default(0),

  // ── Engagement metrics ────────────────────────────────────────────────────

  // Monthly reports dispatched via email this month.
  // Direct signal of the product's client-facing value delivery.
  reportsGenerated: integer('reports_generated').notNull().default(0),

  // Goals created or marked achieved this month.
  // Signals active coaching engagement, not just session logging.
  goalsActioned: integer('goals_actioned').notNull().default(0),

  // ── Computed summary ──────────────────────────────────────────────────────

  // Total active clients on the roster at end of period (not just active ones).
  // Useful for roster-size-based pricing tier checks.
  totalClientCount: integer('total_client_count').notNull().default(0),

  // When this row was last recalculated
  calculatedAt: timestamp('calculated_at').notNull().defaultNow(),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Enforce one row per trainer per month
  uniquePeriod: unique('trainer_usage_monthly_trainer_period')
    .on(table.trainerId, table.periodYear, table.periodMonth),
}))

export type TrainerUsageMonthly    = typeof trainerUsageMonthly.$inferSelect
export type NewTrainerUsageMonthly = typeof trainerUsageMonthly.$inferInsert

// ── Relations ─────────────────────────────────────────────────────────────────
export const trainerUsageMonthlyRelations = relations(trainerUsageMonthly, ({ one }) => ({
  trainer: one(trainers, {
    fields:     [trainerUsageMonthly.trainerId],
    references: [trainers.id],
  }),
}))
