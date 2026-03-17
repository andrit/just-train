// ------------------------------------------------------------
// schemas/index.ts — Zod validation schemas for API request bodies
//
// Naming convention: CreateXxxSchema, UpdateXxxSchema, etc.
// Types are inferred directly: type CreateXxxInput = z.infer<typeof CreateXxxSchema>
//
// Backend uses these for Fastify request validation.
// Frontend uses the inferred types for form typing.
// One definition — both sides stay in sync automatically.
// ------------------------------------------------------------

import { z } from 'zod'
import {
  WorkoutTypeEnum,
  EquipmentEnum,
  SessionStatusEnum,
  IntensityEnum,
  WeightUnitEnum,
  SideEnum,
  DifficultyEnum,
  ClientFocusEnum,
  ProgressionStateEnum,
  TrainerModeEnum,
} from '../enums'

// ============================================================
// TRAINER
// ============================================================

export const CreateTrainerSchema = z.object({
  name: z.string().min(1).max(100).describe('Full name of the trainer'),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})
export type CreateTrainerInput = z.infer<typeof CreateTrainerSchema>

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof LoginSchema>

// Set at first login after registration — determines product experience.
// athlete = own training only, simplified nav, no client roster.
// trainer = managing clients + optional self-training, full nav.
export const OnboardTrainerSchema = z.object({
  trainerMode: TrainerModeEnum.describe('athlete = own training only; trainer = managing clients'),
})
export type OnboardTrainerInput = z.infer<typeof OnboardTrainerSchema>

// General trainer profile updates — name, weight unit, and preferences
export const UpdateTrainerSchema = z.object({
  name:                 z.string().min(1).max(100).optional(),
  weightUnitPreference: WeightUnitEnum.optional(),
  // Preferences (Phase 4)
  ctaLabel:          z.string().min(1).max(50).optional()
    .describe('CTA button label — e.g. "Start Training", "Just Do It", "Let\'s Go"'),
  alertsEnabled:     z.boolean().optional()
    .describe('false = suppress at-risk client alert on app open'),
  widgetProgression: z.string().nullable().optional()
    .describe('Comma-delimited ordered widget IDs — null resets to mode default'),
  alertColorScheme:  z.enum(['amber', 'red', 'blue', 'green']).optional()
    .describe('Color theme for the at-risk alert'),
  alertTone:         z.enum(['clinical', 'motivating', 'firm']).optional()
    .describe('Message tone for the at-risk alert'),
  sessionLayout:     z.enum(['horizontal', 'vertical']).optional()
    .describe('horizontal = scroll between workout blocks; vertical = stacked overview'),
  weeklySessionTarget: z.number().int().min(1).max(14).optional()
    .describe('Target sessions per week for consistency score'),
  show1rmEstimate:   z.boolean().optional()
    .describe('Athlete mode: show Epley 1RM estimates on KPI cards'),
})
export type UpdateTrainerInput = z.infer<typeof UpdateTrainerSchema>

// ============================================================
// CLIENT
// ============================================================

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(100).describe('Full name — required'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional()
    .describe('ISO date string YYYY-MM-DD e.g. "1990-05-20"'),
  // Legacy quick-notes field — kept for backward compat; structured goals go in ClientGoal
  goals: z.string().max(1000).optional()
    .describe('Quick notes on training goals — use the goals API for tracked, timestamped goals'),
  notes: z.string().max(2000).optional()
    .describe('Private trainer notes about this client'),

  // Phase 3C: focus + progression
  primaryFocus: ClientFocusEnum.optional()
    .describe('Primary training style — drives KPI selection in dashboard and reports'),
  secondaryFocus: ClientFocusEnum.optional()
    .describe('Optional secondary training style (e.g. a runner who also lifts)'),
  progressionState: ProgressionStateEnum.optional().default('assessment')
    .describe('Where the client is in their journey: assessment → programming → maintenance'),
  startDate: z.string().optional()
    .describe('ISO date YYYY-MM-DD — when they became a client'),

  // Nutrition hook — deferred to a future phase; capture intent only
  caloricGoal: z.number().int().min(0).optional()
    .describe('Target kcal/day — optional nutrition hook, not yet computed from logs'),
  nutritionNotes: z.string().max(1000).optional()
    .describe('Trainer-entered nutrition observations'),

  // v1.6.0: KPI preferences
  weeklySessionTarget: z.number().int().min(1).max(14).optional()
    .describe('Target sessions per week for consistency score'),
  show1rmEstimate: z.boolean().optional()
    .describe('Whether to show Epley 1RM estimates for this client'),
})
export type CreateClientInput = z.infer<typeof CreateClientSchema>

export const UpdateClientSchema = CreateClientSchema.partial().extend({
  weeklySessionTarget: z.number().int().min(1).max(14).optional()
    .describe('Target sessions per week for consistency score'),
  show1rmEstimate: z.boolean().optional()
    .describe('Whether to show Epley 1RM estimates for this client'),
  active: z.boolean().optional()
    .describe('false = soft-delete'),
})
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>

// ============================================================
// CLIENT GOAL — tracked, timestamped goals with achievement state
// ============================================================

export const CreateClientGoalSchema = z.object({
  goal: z.string().min(1).max(500)
    .describe('Plain-English goal statement e.g. "Run a 5K in under 30 minutes"'),
  progressionState: ProgressionStateEnum.optional()
    .describe('State at the time this goal was set — defaults to client\'s current state'),
})
export type CreateClientGoalInput = z.infer<typeof CreateClientGoalSchema>

export const UpdateClientGoalSchema = z.object({
  goal: z.string().min(1).max(500).optional(),
  achievedAt: z.string().optional().nullable()
    .describe('ISO datetime — set when goal is achieved; null to un-achieve'),
})
export type UpdateClientGoalInput = z.infer<typeof UpdateClientGoalSchema>

// ============================================================
// CLIENT SNAPSHOT — time-series baseline measurements
// All measurement fields are nullable — capture what's available.
// ============================================================

export const CreateClientSnapshotSchema = z.object({
  progressionState: ProgressionStateEnum.optional()
    .describe('State at time of snapshot — defaults to client\'s current state'),

  // Body Composition
  weightLbs:          z.number().positive().optional(),
  heightIn:           z.number().positive().optional(),
  bodyFatPct:         z.number().min(0).max(100).optional(),
  leanMuscleMassLbs:  z.number().positive().optional(),
  bmi:                z.number().positive().optional().describe('Can be calculated or entered directly'),

  // Circumference (inches)
  waistIn:            z.number().positive().optional(),
  hipsIn:             z.number().positive().optional(),
  chestIn:            z.number().positive().optional(),
  bicepsLeftIn:       z.number().positive().optional(),
  bicepsRightIn:      z.number().positive().optional(),
  quadsLeftIn:        z.number().positive().optional(),
  quadsRightIn:       z.number().positive().optional(),
  calvesLeftIn:       z.number().positive().optional(),
  calvesRightIn:      z.number().positive().optional(),

  // Cardiovascular
  restingHeartRateBpm:      z.number().int().positive().optional(),
  bloodPressureSystolic:    z.number().int().positive().optional(),
  bloodPressureDiastolic:   z.number().int().positive().optional(),
  vo2MaxEstimate:           z.number().positive().optional(),

  // Functional
  maxPushUps:           z.number().int().min(0).optional(),
  maxPullUps:           z.number().int().min(0).optional(),
  plankDurationSecs:    z.number().int().min(0).optional(),
  mileTimeSecs:         z.number().int().min(0).optional().describe('Stored in seconds — e.g. 9:45 = 585'),
  sitAndReachIn:        z.number().optional(),
  gripStrengthLeftLbs:  z.number().positive().optional(),
  gripStrengthRightLbs: z.number().positive().optional(),

  // Subjective (1–10 scale)
  energyLevel:    z.number().int().min(1).max(10).optional().describe('1 = exhausted, 10 = full energy'),
  sleepQuality:   z.number().int().min(1).max(10).optional().describe('1 = terrible, 10 = excellent'),
  stressLevel:    z.number().int().min(1).max(10).optional().describe('1 = calm, 10 = extremely stressed'),
  mobilityFeel:   z.number().int().min(1).max(10).optional().describe('1 = very stiff, 10 = full range of motion'),
  selfImageScore: z.number().int().min(1).max(10).optional()
    .describe('How the client sees themselves in the mirror — 1 = very negative, 10 = very positive'),

  // Notes
  trainerNotes: z.string().max(2000).optional(),
  clientNotes:  z.string().max(2000).optional().describe('Trainer transcribes what the client says'),
})
export type CreateClientSnapshotInput = z.infer<typeof CreateClientSnapshotSchema>

export const UpdateClientSnapshotSchema = CreateClientSnapshotSchema
export type UpdateClientSnapshotInput = z.infer<typeof UpdateClientSnapshotSchema>

// ============================================================
// EXERCISE
// ============================================================

export const CreateExerciseSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(5000).optional()
    .describe('Step-by-step form instructions'),
  bodyPartId: z.string().uuid().describe('ID from GET /body-parts'),
  workoutType: WorkoutTypeEnum,
  equipment: EquipmentEnum.default('none'),
  difficulty: DifficultyEnum.default('beginner'),
  isDraft: z.boolean().default(false)
    .describe('true = quick-added mid-session, needs enriching in the library later'),
  isPublic: z.boolean().default(false)
    .describe('When true, visible to all trainers (future multi-trainer support)'),
})
export type CreateExerciseInput = z.infer<typeof CreateExerciseSchema>

export const QuickAddExerciseSchema = z.object({
  name: z.string().min(1).max(150),
  bodyPartId: z.string().uuid(),
  workoutType: WorkoutTypeEnum,
})
export type QuickAddExerciseInput = z.infer<typeof QuickAddExerciseSchema>

export const UpdateExerciseSchema = CreateExerciseSchema.partial()
export type UpdateExerciseInput = z.infer<typeof UpdateExerciseSchema>

// ============================================================
// SESSION
// ============================================================

export const CreateSessionSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(150).optional()
    .describe('Optional label e.g. "Push Day A"'),
  date: z.string().describe('ISO date YYYY-MM-DD'),
  startTime: z.string().optional().describe('ISO datetime'),
  notes: z.string().max(2000).optional(),
  templateId: z.string().uuid().optional()
    .describe('If provided, session workouts are pre-populated from this template'),
})
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>

export const UpdateSessionSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  status: SessionStatusEnum.optional(),
  notes: z.string().max(2000).optional(),

  // Phase 3C: per-session subjective scores — captured in 3 taps at end of session
  energyLevel:  z.number().int().min(1).max(10).optional()
    .describe('How the client felt energy-wise — 1 = exhausted, 10 = full energy'),
  mobilityFeel: z.number().int().min(1).max(10).optional()
    .describe('How movement felt — 1 = very stiff, 10 = full range of motion'),
  stressLevel:  z.number().int().min(1).max(10).optional()
    .describe('Stress level coming into the session — 1 = calm, 10 = extremely stressed'),
  sessionNotes: z.string().max(1000).optional()
    .describe('Trainer\'s note for this specific session — distinct from general notes'),
})
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>

// ============================================================
// WORKOUT
// ============================================================

export const CreateWorkoutSchema = z.object({
  sessionId: z.string().uuid(),
  workoutType: WorkoutTypeEnum,
  orderIndex: z.number().int().min(1)
    .describe('Position in session. Default: cardio=1, stretching=2, calisthenics/resistance=3, cooldown=4'),
  notes: z.string().max(1000).optional(),
})
export type CreateWorkoutInput = z.infer<typeof CreateWorkoutSchema>

export const UpdateWorkoutSchema = z.object({
  orderIndex: z.number().int().min(1).optional(),
  notes: z.string().max(1000).optional(),
})
export type UpdateWorkoutInput = z.infer<typeof UpdateWorkoutSchema>

// ============================================================
// SESSION EXERCISE
// ============================================================

export const AddSessionExerciseSchema = z.object({
  workoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().min(1),
  targetSets: z.number().int().min(1).optional(),
  targetReps: z.number().int().min(1).optional(),
  targetWeight: z.number().min(0).optional(),
  targetWeightUnit: WeightUnitEnum.default('lbs'),
  targetDurationSeconds: z.number().int().min(1).optional(),
  targetDistance: z.number().min(0).optional(),
  targetIntensity: IntensityEnum.optional(),
  notes: z.string().max(1000).optional(),
})
export type AddSessionExerciseInput = z.infer<typeof AddSessionExerciseSchema>

// ============================================================
// SET
// ============================================================

export const CreateSetSchema = z.object({
  sessionExerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1).describe('1-based set index'),
  reps: z.number().int().min(0).optional(),
  weight: z.number().min(0).optional(),
  weightUnit: WeightUnitEnum.default('lbs')
    .describe('Stored per-set — historical records stay accurate if unit changes mid-session'),
  durationSeconds: z.number().int().min(0).optional(),
  distance: z.number().min(0).optional(),
  speed: z.number().min(0).optional(),
  intensity: IntensityEnum.optional(),
  side: SideEnum.optional(),
  rpe: z.number().int().min(1).max(10).optional()
    .describe('Rate of Perceived Exertion 1-10'),
  notes: z.string().max(500).optional(),
})
export type CreateSetInput = z.infer<typeof CreateSetSchema>

export const UpdateSetSchema = CreateSetSchema.omit({ sessionExerciseId: true, setNumber: true }).partial()
export type UpdateSetInput = z.infer<typeof UpdateSetSchema>

// ============================================================
// TEMPLATE
// ============================================================

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
})
export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>

export const CreateTemplateWorkoutSchema = z.object({
  templateId: z.string().uuid(),
  workoutType: WorkoutTypeEnum,
  orderIndex: z.number().int().min(1),
  notes: z.string().max(1000).optional(),
})
export type CreateTemplateWorkoutInput = z.infer<typeof CreateTemplateWorkoutSchema>

export const AddTemplateExerciseSchema = z.object({
  templateWorkoutId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().min(1),
  targetSets: z.number().int().min(1).optional(),
  targetReps: z.number().int().min(1).optional(),
  targetWeight: z.number().min(0).optional(),
  targetWeightUnit: WeightUnitEnum.default('lbs'),
  targetDurationSeconds: z.number().int().min(1).optional(),
  targetDistance: z.number().min(0).optional(),
  targetIntensity: IntensityEnum.optional(),
  notes: z.string().max(1000).optional(),
})
export type AddTemplateExerciseInput = z.infer<typeof AddTemplateExerciseSchema>
