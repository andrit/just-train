// ------------------------------------------------------------
// schema/sessions.ts — Session, Workout, SessionExercise, Set, SyncLog
//
// This is the core tracking layer of the app.
//
// HIERARCHY:
//   Session → Workouts → SessionExercises → Sets
//
// A session can be built two ways:
//   - Pre-planned: created from a template (status: planned)
//   - Live:        built in real-time during training (status: in_progress)
// Both produce identical data structure — difference is timing only.
// ------------------------------------------------------------

import {
  pgTable, uuid, text, integer, real,
  timestamp, pgEnum, boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { SessionStatusEnum, SideEnum } from '@trainer-app/shared'
import { trainers, clients, weightUnitEnum } from './trainers'
import { exercises, workoutTypeEnum } from './exercises'
import { templates, intensityEnum } from './templates'

// ------------------------------------------------------------
// POSTGRES ENUMS
// ------------------------------------------------------------
export const sessionStatusEnum = pgEnum('session_status', SessionStatusEnum.options)
export const sideEnum          = pgEnum('side',           SideEnum.options)

// ------------------------------------------------------------
// SESSIONS
// Top-level record for a training event.
// ------------------------------------------------------------
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),

  trainerId: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id, { onDelete: 'cascade' }),

  // null = session was built live from scratch (not from a template)
  templateId: uuid('template_id')
    .references(() => templates.id, { onDelete: 'set null' }),

  name:      text('name'),            // Optional e.g. "Week 3 Push Day"
  date:      text('date').notNull(),  // Stored as 'YYYY-MM-DD'
  startTime: timestamp('start_time'), // Set when trainer taps "Start Session"
  endTime:   timestamp('end_time'),   // Set when trainer taps "End Session"
  status:    sessionStatusEnum('status').notNull().default('planned'),
  notes:     text('notes'),

  // Phase 3C: per-session subjective scores — captured in 3 taps at end of session.
  // Low friction (< 10 seconds), high long-term value.
  // A client whose energy is consistently 4/10 on Mondays tells a story.
  // A client whose self-image score trends from 3 to 8 over a year IS the product working.
  energyLevel:  integer('energy_level'),   // 1 = exhausted, 10 = full energy
  mobilityFeel: integer('mobility_feel'),  // 1 = very stiff, 10 = full range of motion
  stressLevel:  integer('stress_level'),   // 1 = calm, 10 = extremely stressed

  // Session-specific trainer note — distinct from the general session notes field
  sessionNotes: text('session_notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Session    = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

// ------------------------------------------------------------
// WORKOUTS — typed blocks within a session
// Default order: cardio → stretching → calisthenics/resistance → cooldown
// orderIndex is editable by the trainer.
// ------------------------------------------------------------
export const workouts = pgTable('workouts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  sessionId:   uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  workoutType: workoutTypeEnum('workout_type').notNull(),
  orderIndex:  integer('order_index').notNull().default(0),
  notes:       text('notes'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export type Workout    = typeof workouts.$inferSelect
export type NewWorkout = typeof workouts.$inferInsert

// ------------------------------------------------------------
// SESSION EXERCISES — exercise linked into a workout block
// target_* = planned values (from template or pre-planning)
// Actual performance is in the sets table.
// ------------------------------------------------------------
export const sessionExercises = pgTable('session_exercises', {
  id:         uuid('id').primaryKey().defaultRandom(),
  workoutId:  uuid('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'restrict' }),
  orderIndex: integer('order_index').notNull().default(0),

  // Target / planned values
  targetSets:            integer('target_sets'),
  targetReps:            integer('target_reps'),
  targetWeight:          real('target_weight'),
  targetWeightUnit:      weightUnitEnum('target_weight_unit').notNull().default('lbs'),
  targetDurationSeconds: integer('target_duration_seconds'),
  targetDistance:        real('target_distance'),
  targetIntensity:       intensityEnum('target_intensity'),
  notes:                 text('notes'),
})

export type SessionExercise    = typeof sessionExercises.$inferSelect
export type NewSessionExercise = typeof sessionExercises.$inferInsert

// ------------------------------------------------------------
// SETS — the atomic unit of recorded performance
//
// Not every field applies to every workout type:
//   Resistance:   reps, weight, weightUnit, rpe
//   Calisthenics: reps, rpe, durationSeconds
//   Cardio:       durationSeconds, distance, speed, intensity
//   Stretching:   durationSeconds, side
//   All types:    rpe, notes
//
// Null on unused fields is intentional and expected.
// The workoutType on the parent exercise determines which fields matter.
// ------------------------------------------------------------
export const sets = pgTable('sets', {
  id:                uuid('id').primaryKey().defaultRandom(),
  sessionExerciseId: uuid('session_exercise_id')
    .notNull()
    .references(() => sessionExercises.id, { onDelete: 'cascade' }),

  setNumber: integer('set_number').notNull(), // 1, 2, 3... per exercise

  // Resistance & calisthenics
  reps:   integer('reps'),
  weight: real('weight'),
  // weightUnit stored per-set — historical records stay accurate even if
  // the trainer switches between lbs and kg mid-session
  weightUnit: weightUnitEnum('weight_unit').notNull().default('lbs'),

  // Cardio
  durationSeconds: integer('duration_seconds'),
  distance:        real('distance'),
  speed:           real('speed'),
  intensity:       intensityEnum('intensity'),

  // Stretching
  side: sideEnum('side'),

  // Universal — Rate of Perceived Exertion 1 (easy) to 10 (max effort)
  rpe:   integer('rpe'),
  notes: text('notes'),

  // Personal records — set at log time by comparing historical maxes.
  // isPR:       Epley 1RM estimate (weight × (1 + reps/30)) exceeds prior best.
  // isPRVolume: weight × reps exceeds prior best.
  // Both tracked independently — a set can be one, both, or neither.
  isPR:       boolean('is_pr').notNull().default(false),
  isPRVolume: boolean('is_pr_volume').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type Set    = typeof sets.$inferSelect
export type NewSet = typeof sets.$inferInsert

// ------------------------------------------------------------
// SYNC LOG — offline-first write queue
//
// Every local write while offline is appended here.
// When connectivity returns, the app replays these against
// the server. syncedAt = null means still pending.
// Phase 6 will wire the full sync mechanism.
// ------------------------------------------------------------
export const syncLog = pgTable('sync_log', {
  id:       uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  deviceId:  text('device_id').notNull(),    // Which device made the change
  tableName: text('table_name').notNull(),   // e.g. 'sets', 'session_exercises'
  recordId:  uuid('record_id').notNull(),    // PK of the affected record
  operation: text('operation').notNull(),   // insert | update | delete
  payload:   text('payload').notNull(),     // Full record as JSON string
  createdLocallyAt: timestamp('created_locally_at').notNull(),
  syncedAt:         timestamp('synced_at'), // null = pending
})

export type SyncLog    = typeof syncLog.$inferSelect
export type NewSyncLog = typeof syncLog.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  client:   one(clients,    { fields: [sessions.clientId],   references: [clients.id] }),
  trainer:  one(trainers,   { fields: [sessions.trainerId],  references: [trainers.id] }),
  template: one(templates,  { fields: [sessions.templateId], references: [templates.id] }),
  workouts: many(workouts),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  session:          one(sessions, { fields: [workouts.sessionId], references: [sessions.id] }),
  sessionExercises: many(sessionExercises),
}))

export const sessionExercisesRelations = relations(sessionExercises, ({ one, many }) => ({
  workout:  one(workouts,  { fields: [sessionExercises.workoutId],  references: [workouts.id] }),
  exercise: one(exercises, { fields: [sessionExercises.exerciseId], references: [exercises.id] }),
  sets:     many(sets),
}))

export const setsRelations = relations(sets, ({ one }) => ({
  sessionExercise: one(sessionExercises, {
    fields: [sets.sessionExerciseId], references: [sessionExercises.id],
  }),
}))
