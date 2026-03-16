// ------------------------------------------------------------
// schema/client-snapshots.ts — Client Snapshot (baseline) table (Phase 3C)
//
// Time-series capture of client metrics. Taken at:
//   - Start of assessment phase (initial baseline)
//   - Each phase transition (assessment → programming → maintenance)
//   - Monthly during programming (ties to the monthly report cycle)
//   - Any notable change the trainer wants to record
//
// ALL measurement fields are nullable — capture what's available.
// Never block a snapshot because one measurement wasn't taken.
//
// The power of this table is the "then vs. now" comparison:
//   "When you started, your resting heart rate was 88bpm. It's now 64bpm."
//   "Your mile time has dropped from 12:30 to 9:45 over 6 months."
//
// Subjective scores (1–10) are the most consistently captured
// and often the most revealing — self-image trending 3→8 over
// a year IS the product working.
// ------------------------------------------------------------

import { pgTable, uuid, text, integer, real, timestamp } from 'drizzle-orm/pg-core'
import { relations }                                      from 'drizzle-orm'
import { clients, progressionStateEnum, trainers }       from './trainers'

export const clientSnapshots = pgTable('client_snapshots', {
  id:       uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),

  capturedAt: timestamp('captured_at').notNull().defaultNow(),
  capturedBy: uuid('captured_by')
    .notNull()
    .references(() => trainers.id, { onDelete: 'restrict' }),

  // State at the time of capture
  progressionState: progressionStateEnum('progression_state').notNull().default('assessment'),

  // ── Body Composition ──────────────────────────────────────────────────────
  weightLbs:         real('weight_lbs'),
  heightIn:          real('height_in'),
  bodyFatPct:        real('body_fat_pct'),
  leanMuscleMassLbs: real('lean_muscle_mass_lbs'),
  bmi:               real('bmi'),            // Can be computed or entered directly

  // ── Circumference (inches) ────────────────────────────────────────────────
  waistIn:       real('waist_in'),
  hipsIn:        real('hips_in'),
  chestIn:       real('chest_in'),
  bicepsLeftIn:  real('biceps_left_in'),
  bicepsRightIn: real('biceps_right_in'),
  quadsLeftIn:   real('quads_left_in'),
  quadsRightIn:  real('quads_right_in'),
  calvesLeftIn:  real('calves_left_in'),
  calvesRightIn: real('calves_right_in'),

  // ── Cardiovascular ────────────────────────────────────────────────────────
  restingHeartRateBpm:    integer('resting_heart_rate_bpm'),
  bloodPressureSystolic:  integer('blood_pressure_systolic'),
  bloodPressureDiastolic: integer('blood_pressure_diastolic'),
  vo2MaxEstimate:         real('vo2_max_estimate'),

  // ── Functional ────────────────────────────────────────────────────────────
  maxPushUps:           integer('max_push_ups'),
  maxPullUps:           integer('max_pull_ups'),
  plankDurationSecs:    integer('plank_duration_secs'),
  mileTimeSecs:         integer('mile_time_secs'),    // e.g. 585 = 9:45 mile
  sitAndReachIn:        real('sit_and_reach_in'),
  gripStrengthLeftLbs:  real('grip_strength_left_lbs'),
  gripStrengthRightLbs: real('grip_strength_right_lbs'),

  // ── Subjective (1–10) ─────────────────────────────────────────────────────
  // These 5 scores are the fastest to capture (< 60 seconds per snapshot)
  // and over time become the most revealing dataset in the app.
  energyLevel:    integer('energy_level'),     // 1 = exhausted, 10 = full energy
  sleepQuality:   integer('sleep_quality'),    // 1 = terrible, 10 = excellent
  stressLevel:    integer('stress_level'),     // 1 = calm, 10 = extremely stressed
  mobilityFeel:   integer('mobility_feel'),    // 1 = very stiff, 10 = full ROM
  selfImageScore: integer('self_image_score'), // 1 = very negative, 10 = very positive

  // ── Notes ─────────────────────────────────────────────────────────────────
  trainerNotes: text('trainer_notes'),
  clientNotes:  text('client_notes'),   // Trainer transcribes what client says

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type ClientSnapshot    = typeof clientSnapshots.$inferSelect
export type NewClientSnapshot = typeof clientSnapshots.$inferInsert

// ── Relations ────────────────────────────────────────────────────────────────
export const clientSnapshotsRelations = relations(clientSnapshots, ({ one }) => ({
  client:  one(clients,  { fields: [clientSnapshots.clientId],  references: [clients.id] }),
  trainer: one(trainers, { fields: [clientSnapshots.capturedBy], references: [trainers.id] }),
}))
