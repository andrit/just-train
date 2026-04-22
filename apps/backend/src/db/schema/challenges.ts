// ------------------------------------------------------------
// schema/challenges.ts — Coach challenges (v2.12.0)
//
// A challenge is a measurable goal with a deadline.
// "10 unassisted pull-ups by June 30th."
//
// Both trainers and athletes create challenges. For athletes,
// clientId points to the self-client. The backend is identical
// for both modes — the frontend handles the UI distinction.
//
// AUTO-DETECTION:
//   When a set is logged, the set logging route checks for active
//   challenges tied to that exercise and updates currentValue.
//   When a session completes, sessions_completed challenges are
//   incremented. Qualitative challenges are manual-only.
//
// EXPIRY:
//   The BullMQ scheduler checks daily for challenges past their
//   deadline that are still active, and flips them to expired.
// ------------------------------------------------------------

import { pgTable, uuid, text, real, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { ChallengeMetricTypeEnum, ChallengeStatusEnum } from '@trainer-app/shared'
import { clients, trainers } from './trainers'
import { exercises } from './exercises'

// ------------------------------------------------------------
// POSTGRES ENUMS
// ------------------------------------------------------------
export const challengeMetricTypeEnum = pgEnum('challenge_metric_type', ChallengeMetricTypeEnum.options)
export const challengeStatusEnum     = pgEnum('challenge_status',      ChallengeStatusEnum.options)

// ------------------------------------------------------------
// CHALLENGES
// ------------------------------------------------------------
export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),

  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),

  trainerId: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id, { onDelete: 'cascade' }),

  title: text('title').notNull(),
  description: text('description'),

  metricType: challengeMetricTypeEnum('metric_type').notNull(),

  // Optional — ties challenge to a specific exercise.
  // Required for weight_lifted, reps_achieved, distance, duration.
  // Null for sessions_completed and qualitative.
  exerciseId: uuid('exercise_id')
    .references(() => exercises.id, { onDelete: 'set null' }),

  targetValue:  real('target_value').notNull(),
  targetUnit:   text('target_unit'),       // 'lbs' | 'kg' | 'reps' | 'km' | etc.
  currentValue: real('current_value').notNull().default(0),

  deadline: text('deadline').notNull(),    // YYYY-MM-DD

  status: challengeStatusEnum('status').notNull().default('active'),
  completedAt: timestamp('completed_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Challenge    = typeof challenges.$inferSelect
export type NewChallenge = typeof challenges.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const challengesRelations = relations(challenges, ({ one }) => ({
  client:   one(clients,   { fields: [challenges.clientId],   references: [clients.id] }),
  trainer:  one(trainers,  { fields: [challenges.trainerId],  references: [trainers.id] }),
  exercise: one(exercises, { fields: [challenges.exerciseId], references: [exercises.id] }),
}))
