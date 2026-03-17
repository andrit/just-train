// ------------------------------------------------------------
// response-schemas.ts — Zod schemas for API responses
//
// These schemas serve two purposes:
//   1. SWAGGER DOCS — @fastify/swagger reads them to document what
//      each endpoint returns in the interactive OpenAPI spec at /documentation
//   2. RESPONSE SERIALIZATION — Fastify serializes responses through these
//      schemas, stripping any fields not listed (e.g. passwordHash never leaks)
//
// PHASE 2 ADDITIONS:
//   - TrainerResponseSchema: added emailVerified, lastLoginAt fields
//   - AuthResponseSchema: access token + trainer profile (login/register/refresh)
//
// Schemas are built bottom-up: atomic schemas compose into nested ones.
// ------------------------------------------------------------

import { z } from 'zod'
import {
  WorkoutTypeEnum,
  BodyPartEnum,
  EquipmentEnum,
  SessionStatusEnum,
  IntensityEnum,
  WeightUnitEnum,
  SideEnum,
  DifficultyEnum,
  MediaTypeEnum,
  TrainerRoleEnum,
  ClientFocusEnum,
  ProgressionStateEnum,
  SubscriptionTierEnum,
  SubscriptionStatusEnum,
  TrainerModeEnum,
} from '../enums'

// ============================================================
// SHARED UTILITY
// ============================================================

export const ErrorResponseSchema = z.object({
  error:   z.string().describe('Human-readable error message'),
  code:    z.string().optional().describe('Machine-readable code e.g. TOKEN_EXPIRED'),
  details: z.unknown().optional().describe('Zod field-level validation details — only on 400'),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

export const UuidParamSchema = z.object({
  id: z.string().uuid().describe('Resource UUID'),
})
export type UuidParam = z.infer<typeof UuidParamSchema>

export const SessionWorkoutParamSchema = z.object({
  sessionId: z.string().uuid(),
  id:        z.string().uuid(),
})

export const WorkoutExerciseParamSchema = z.object({
  workoutId: z.string().uuid(),
  id:        z.string().uuid(),
})

// ============================================================
// TRAINER (Phase 2: added emailVerified, lastLoginAt)
// ============================================================

export const TrainerResponseSchema = z.object({
  id:                   z.string().uuid(),
  name:                 z.string(),
  email:                z.string().email(),
  role:                 TrainerRoleEnum,
  weightUnitPreference: WeightUnitEnum,

  // Phase 2 additions — audit + future email verification
  emailVerified: z.boolean()
    .describe('Always false in Phase 2 — email verification flow is deferred. See DEFERRED_ITEMS.md.'),
  lastLoginAt: z.string().datetime().nullable()
    .describe('ISO datetime of last successful login. null if never logged in via this system.'),

  // Phase 3C: SaaS subscription fields
  subscriptionTier:   SubscriptionTierEnum
    .describe('free = limited usage; pro = full features; studio = trainer-only unlimited'),
  subscriptionStatus: SubscriptionStatusEnum,
  onboardedAt: z.string().datetime().nullable()
    .describe('Set when the trainer completes the onboarding mode selection'),

  // Phase 3D: usage metrics
  trainerMode: TrainerModeEnum
    .describe('athlete = own training only; trainer = managing clients + optional self-training'),
  reportsSentCount: z.number().int()
    .describe('Lifetime count of monthly reports dispatched — usage billing signal'),
  lastActiveAt: z.string().datetime().nullable()
    .describe('Last time a meaningful write action was made — usage billing signal'),

  // Phase 4: personalization preferences
  ctaLabel: z.string()
    .describe('Wording for the "start training" CTA button — e.g. "Start Training", "Just Do It"'),
  alertsEnabled: z.boolean()
    .describe('Whether the at-risk client alert shows on every app open'),
  widgetProgression: z.string().nullable()
    .describe('Comma-delimited ordered widget IDs — null means use the mode default order'),
  alertColorScheme: z.enum(['amber', 'red', 'blue', 'green'])
    .describe('Color theme for the at-risk alert widget'),
  alertTone: z.enum(['clinical', 'motivating', 'firm'])
    .describe('Message tone for the at-risk alert'),
  sessionLayout: z.enum(['horizontal', 'vertical'])
    .describe('How workout blocks are arranged in the live session screen'),
  weeklySessionTarget: z.number().int()
    .describe('Target sessions per week — used for consistency score'),
  show1rmEstimate: z.boolean()
    .describe('Athlete mode: whether to show Epley 1RM estimates on KPI cards'),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // passwordHash intentionally excluded — never returned
})
export type TrainerResponse = z.infer<typeof TrainerResponseSchema>

// ============================================================
// AUTH (Phase 2)
// ============================================================

export const AuthResponseSchema = z.object({
  accessToken: z.string()
    .describe('Short-lived JWT (15 min). Store in memory only — never localStorage. Attach as "Authorization: Bearer <token>".'),
  trainer: TrainerResponseSchema,
})
export type AuthResponse = z.infer<typeof AuthResponseSchema>

export const MessageResponseSchema = z.object({
  message: z.string(),
})
export type MessageResponse = z.infer<typeof MessageResponseSchema>

// ============================================================
// BODY PART
// ============================================================

export const BodyPartResponseSchema = z.object({
  id:           z.string().uuid(),
  name:         BodyPartEnum,
  displayOrder: z.number().int(),
})
export type BodyPartResponse = z.infer<typeof BodyPartResponseSchema>

export const BodyPartListResponseSchema = z.array(BodyPartResponseSchema)
  .describe('All body parts ordered by displayOrder — used to populate exercise library filters and pickers')
export type BodyPartListResponse = z.infer<typeof BodyPartListResponseSchema>

// ============================================================
// CLIENT
// ============================================================

export const ClientResponseSchema = z.object({
  id:        z.string().uuid(),
  trainerId: z.string().uuid(),
  name:      z.string(),
  email:     z.string().email().nullable(),
  phone:     z.string().nullable(),
  photoUrl:  z.string().nullable().describe('Cloudinary URL — null until a photo is uploaded'),
  dateOfBirth: z.string().nullable().describe('YYYY-MM-DD'),
  goals:  z.string().nullable().describe('Legacy quick-notes. Structured goals are in the goals sub-resource.'),
  notes:  z.string().nullable(),
  active: z.boolean().describe('false = soft-deleted. Full session history is preserved.'),

  // Phase 3C additions
  primaryFocus:     ClientFocusEnum.nullable(),
  secondaryFocus:   ClientFocusEnum.nullable(),
  progressionState: ProgressionStateEnum,
  startDate:        z.string().nullable().describe('YYYY-MM-DD'),
  caloricGoal:      z.number().int().nullable().describe('Target kcal/day — nutrition hook'),
  nutritionNotes:   z.string().nullable(),
  isSelf:           z.boolean()
    .describe('true = this is the trainer training themselves. Auto-created at registration.'),
  lastActiveAt:     z.string().datetime().nullable()
    .describe('Last session logged for this client — used for active client billing metric'),

  // v1.6.0: per-client KPI preferences
  weeklySessionTarget: z.number().int()
    .describe('Target sessions per week for consistency score'),
  show1rmEstimate: z.boolean()
    .describe('Whether to show Epley 1RM estimates for this client'),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ClientResponse = z.infer<typeof ClientResponseSchema>

export const ClientListResponseSchema = z.array(ClientResponseSchema)
  .describe('All active clients for the trainer, ordered by name')
export type ClientListResponse = z.infer<typeof ClientListResponseSchema>

// ============================================================
// CLIENT GOAL (Phase 3C)
// ============================================================

export const ClientGoalResponseSchema = z.object({
  id:               z.string().uuid(),
  clientId:         z.string().uuid(),
  goal:             z.string(),
  progressionState: ProgressionStateEnum.describe('State at the time this goal was set'),
  setAt:            z.string().datetime(),
  achievedAt:       z.string().datetime().nullable().describe('null = still in progress'),
  createdAt:        z.string().datetime(),
})
export type ClientGoalResponse = z.infer<typeof ClientGoalResponseSchema>

export const ClientGoalListResponseSchema = z.array(ClientGoalResponseSchema)
  .describe('All goals for the client ordered by setAt descending')
export type ClientGoalListResponse = z.infer<typeof ClientGoalListResponseSchema>

// ============================================================
// CLIENT SNAPSHOT (Phase 3C)
// ============================================================

export const ClientSnapshotResponseSchema = z.object({
  id:               z.string().uuid(),
  clientId:         z.string().uuid(),
  capturedAt:       z.string().datetime(),
  capturedBy:       z.string().uuid().describe('Trainer ID who captured this snapshot'),
  progressionState: ProgressionStateEnum.describe('State at time of snapshot'),

  // Body Composition
  weightLbs:         z.number().nullable(),
  heightIn:          z.number().nullable(),
  bodyFatPct:        z.number().nullable(),
  leanMuscleMassLbs: z.number().nullable(),
  bmi:               z.number().nullable(),

  // Circumference (inches)
  waistIn:      z.number().nullable(),
  hipsIn:       z.number().nullable(),
  chestIn:      z.number().nullable(),
  bicepsLeftIn:  z.number().nullable(),
  bicepsRightIn: z.number().nullable(),
  quadsLeftIn:   z.number().nullable(),
  quadsRightIn:  z.number().nullable(),
  calvesLeftIn:  z.number().nullable(),
  calvesRightIn: z.number().nullable(),

  // Cardiovascular
  restingHeartRateBpm:    z.number().int().nullable(),
  bloodPressureSystolic:  z.number().int().nullable(),
  bloodPressureDiastolic: z.number().int().nullable(),
  vo2MaxEstimate:         z.number().nullable(),

  // Functional
  maxPushUps:           z.number().int().nullable(),
  maxPullUps:           z.number().int().nullable(),
  plankDurationSecs:    z.number().int().nullable(),
  mileTimeSecs:         z.number().int().nullable().describe('Seconds — e.g. 585 = 9:45 mile'),
  sitAndReachIn:        z.number().nullable(),
  gripStrengthLeftLbs:  z.number().nullable(),
  gripStrengthRightLbs: z.number().nullable(),

  // Subjective (1–10)
  energyLevel:    z.number().int().nullable(),
  sleepQuality:   z.number().int().nullable(),
  stressLevel:    z.number().int().nullable(),
  mobilityFeel:   z.number().int().nullable(),
  selfImageScore: z.number().int().nullable(),

  trainerNotes: z.string().nullable(),
  clientNotes:  z.string().nullable(),
  createdAt:    z.string().datetime(),
})
export type ClientSnapshotResponse = z.infer<typeof ClientSnapshotResponseSchema>

export const ClientSnapshotListResponseSchema = z.array(ClientSnapshotResponseSchema)
  .describe('All snapshots for the client ordered by capturedAt descending')
export type ClientSnapshotListResponse = z.infer<typeof ClientSnapshotListResponseSchema>

// ============================================================
// EXERCISE MEDIA
// ============================================================

export const ExerciseMediaResponseSchema = z.object({
  id:                 z.string().uuid(),
  exerciseId:         z.string().uuid(),
  mediaType:          MediaTypeEnum,
  cloudinaryUrl:      z.string().describe('Full Cloudinary URL — use directly in <img> or <video> src'),
  cloudinaryPublicId: z.string().describe('Cloudinary public ID — required to delete media from Cloudinary'),
  isPrimary:          z.boolean().describe('true = thumbnail shown in exercise list cards'),
  displayOrder:       z.number().int(),
  createdAt:          z.string().datetime(),
})
export type ExerciseMediaResponse = z.infer<typeof ExerciseMediaResponseSchema>

// ============================================================
// EXERCISE
// ============================================================

export const ExerciseSummaryResponseSchema = z.object({
  id:          z.string().uuid(),
  name:        z.string(),
  workoutType: WorkoutTypeEnum,
  equipment:   EquipmentEnum,
  difficulty:  DifficultyEnum,
  isDraft:     z.boolean().describe('true = quick-added mid-session, needs enriching in the library'),
  bodyPart:    BodyPartResponseSchema.nullable(),
  media:       z.array(ExerciseMediaResponseSchema).max(1)
    .describe('Primary thumbnail only. Use GET /exercises/:id for all media.'),
})
export type ExerciseSummaryResponse = z.infer<typeof ExerciseSummaryResponseSchema>

export const ExerciseDetailResponseSchema = ExerciseSummaryResponseSchema.extend({
  trainerId:    z.string().uuid(),
  bodyPartId:   z.string().uuid(),
  description:  z.string().nullable(),
  instructions: z.string().nullable().describe('Step-by-step form instructions'),
  isPublic:     z.boolean().describe('true = visible to all trainers (future multi-trainer)'),
  media:        z.array(ExerciseMediaResponseSchema).describe('All media ordered by displayOrder'),
  createdAt:    z.string().datetime(),
  updatedAt:    z.string().datetime(),
})
export type ExerciseDetailResponse = z.infer<typeof ExerciseDetailResponseSchema>

export const ExerciseListResponseSchema = z.array(ExerciseSummaryResponseSchema)
  .describe('Exercise library entries matching the filter criteria, ordered by name')
export type ExerciseListResponse = z.infer<typeof ExerciseListResponseSchema>

// ============================================================
// SET
// ============================================================

export const SetResponseSchema = z.object({
  id:                z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
  setNumber:         z.number().int().describe('1-based index — 1st set, 2nd set, 3rd set'),
  reps:              z.number().int().nullable(),
  weight:            z.number().nullable(),
  weightUnit:        WeightUnitEnum.describe('Stored per-set — can differ from trainer preference'),
  durationSeconds:   z.number().int().nullable(),
  distance:          z.number().nullable(),
  speed:             z.number().nullable(),
  intensity:         IntensityEnum.nullable(),
  side:              SideEnum.nullable(),
  rpe:               z.number().int().nullable().describe('Rate of Perceived Exertion 1–10'),
  notes:             z.string().nullable(),
  createdAt:         z.string().datetime(),
})
export type SetResponse = z.infer<typeof SetResponseSchema>

// ============================================================
// SESSION EXERCISE
// ============================================================

export const SessionExerciseResponseSchema = z.object({
  id:         z.string().uuid(),
  workoutId:  z.string().uuid(),
  exerciseId: z.string().uuid(),
  exercise:   ExerciseSummaryResponseSchema.nullable()
    .describe('Null if exercise was deleted after being added to this session'),
  orderIndex:            z.number().int(),
  targetSets:            z.number().int().nullable(),
  targetReps:            z.number().int().nullable(),
  targetWeight:          z.number().nullable(),
  targetWeightUnit:      WeightUnitEnum,
  targetDurationSeconds: z.number().int().nullable(),
  targetDistance:        z.number().nullable(),
  targetIntensity:       IntensityEnum.nullable(),
  notes:                 z.string().nullable(),
  sets:                  z.array(SetResponseSchema).describe('All recorded sets ordered by setNumber'),
})
export type SessionExerciseResponse = z.infer<typeof SessionExerciseResponseSchema>

// ============================================================
// WORKOUT
// ============================================================

export const WorkoutResponseSchema = z.object({
  id:          z.string().uuid(),
  sessionId:   z.string().uuid(),
  workoutType: WorkoutTypeEnum,
  orderIndex:  z.number().int()
    .describe('Position in session. Default: cardio=1, stretching=2, calisthenics/resistance=3, cooldown=4'),
  notes:            z.string().nullable(),
  sessionExercises: z.array(SessionExerciseResponseSchema)
    .describe('Exercises in this block ordered by orderIndex'),
  createdAt: z.string().datetime(),
})
export type WorkoutResponse = z.infer<typeof WorkoutResponseSchema>

// ============================================================
// SESSION
// ============================================================

const ClientSummarySchema = z.object({
  id:       z.string().uuid(),
  name:     z.string(),
  photoUrl: z.string().nullable(),
})

export const SessionSummaryResponseSchema = z.object({
  id:         z.string().uuid(),
  clientId:   z.string().uuid(),
  client:     ClientSummarySchema.nullable(),
  trainerId:  z.string().uuid(),
  templateId: z.string().uuid().nullable().describe('null = session was built live'),
  name:       z.string().nullable(),
  date:       z.string().describe('YYYY-MM-DD'),
  startTime:  z.string().datetime().nullable(),
  endTime:    z.string().datetime().nullable(),
  status:     SessionStatusEnum,
  notes:      z.string().nullable(),

  // Phase 3C: per-session subjective scores
  energyLevel:  z.number().int().nullable().describe('1–10 at time of session'),
  mobilityFeel: z.number().int().nullable().describe('1–10 at time of session'),
  stressLevel:  z.number().int().nullable().describe('1–10 at time of session'),
  sessionNotes: z.string().nullable().describe('Session-specific trainer note'),

  createdAt:  z.string().datetime(),
  updatedAt:  z.string().datetime(),
})
export type SessionSummaryResponse = z.infer<typeof SessionSummaryResponseSchema>

export const SessionDetailResponseSchema = SessionSummaryResponseSchema.extend({
  workouts: z.array(WorkoutResponseSchema)
    .describe('All workout blocks ordered by orderIndex, with full exercise and set data'),
})
export type SessionDetailResponse = z.infer<typeof SessionDetailResponseSchema>

export const SessionListResponseSchema = z.array(SessionSummaryResponseSchema)
  .describe('Sessions matching the filter, ordered by date descending')
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>

// ============================================================
// TEMPLATE
// ============================================================

const TemplateExerciseResponseSchema = z.object({
  id:               z.string().uuid(),
  templateWorkoutId: z.string().uuid(),
  exerciseId:        z.string().uuid(),
  exercise:          ExerciseSummaryResponseSchema.nullable(),
  orderIndex:            z.number().int(),
  targetSets:            z.number().int().nullable(),
  targetReps:            z.number().int().nullable(),
  targetWeight:          z.number().nullable(),
  targetWeightUnit:      WeightUnitEnum,
  targetDurationSeconds: z.number().int().nullable(),
  targetDistance:        z.number().nullable(),
  notes:                 z.string().nullable(),
})

const TemplateWorkoutResponseSchema = z.object({
  id:          z.string().uuid(),
  templateId:  z.string().uuid(),
  workoutType: WorkoutTypeEnum,
  orderIndex:  z.number().int(),
  notes:       z.string().nullable(),
  templateExercises: z.array(TemplateExerciseResponseSchema),
})

export const TemplateSummaryResponseSchema = z.object({
  id:          z.string().uuid(),
  trainerId:   z.string().uuid(),
  name:        z.string(),
  description: z.string().nullable(),
  notes:       z.string().nullable(),
  createdAt:   z.string().datetime(),
  updatedAt:   z.string().datetime(),
})
export type TemplateSummaryResponse = z.infer<typeof TemplateSummaryResponseSchema>

export const TemplateDetailResponseSchema = TemplateSummaryResponseSchema.extend({
  templateWorkouts: z.array(TemplateWorkoutResponseSchema)
    .describe('Workout blocks ordered by orderIndex, with exercises and target values'),
})
export type TemplateDetailResponse = z.infer<typeof TemplateDetailResponseSchema>

export const TemplateListResponseSchema = z.array(TemplateSummaryResponseSchema)
  .describe('All templates for the trainer, ordered by name')
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>

// ============================================================
// TRAINER USAGE MONTHLY (Phase 3D)
// ============================================================

export const TrainerUsageMonthlyResponseSchema = z.object({
  id:               z.string().uuid(),
  trainerId:        z.string().uuid(),
  periodYear:       z.number().int().describe('e.g. 2025'),
  periodMonth:      z.number().int().min(1).max(12).describe('1–12'),
  activeClientCount: z.number().int()
    .describe('Clients with at least one completed session this month — primary billing metric'),
  sessionsCompleted: z.number().int(),
  totalSetsLogged:  z.number().int(),
  snapshotsTaken:   z.number().int(),
  reportsGenerated: z.number().int(),
  goalsActioned:    z.number().int(),
  totalClientCount: z.number().int().describe('Total roster size at end of period'),
  calculatedAt:     z.string().datetime(),
  createdAt:        z.string().datetime(),
  updatedAt:        z.string().datetime(),
})
export type TrainerUsageMonthlyResponse = z.infer<typeof TrainerUsageMonthlyResponseSchema>

export const TrainerUsageMonthlyListResponseSchema = z.array(TrainerUsageMonthlyResponseSchema)
  .describe('Monthly usage history ordered by period descending')
export type TrainerUsageMonthlyListResponse = z.infer<typeof TrainerUsageMonthlyListResponseSchema>

// ============================================================
// CLIENT KPIs (v1.6.0)
// ============================================================

// Focus-specific KPI — shape depends on client's primaryFocus
export const FocusKpiSchema = z.discriminatedUnion('type', [
  z.object({
    type:        z.literal('resistance'),
    topExercise: z.string().nullable()
      .describe('Exercise with highest estimated 1RM or most volume'),
    estOnermKg:  z.number().nullable()
      .describe('Epley 1RM estimate in kg — null if show1rmEstimate=false'),
    volumeTrend: z.enum(['up', 'down', 'flat', 'insufficient_data']),
  }),
  z.object({
    type:         z.literal('cardio'),
    totalDistanceKm: z.number().nullable(),
    avgPaceMinPerKm: z.number().nullable(),
    paceTrend:    z.enum(['up', 'down', 'flat', 'insufficient_data']),
  }),
  z.object({
    type:        z.literal('calisthenics'),
    topExercise: z.string().nullable(),
    maxReps:     z.number().int().nullable(),
    repsTrend:   z.enum(['up', 'down', 'flat', 'insufficient_data']),
  }),
  z.object({
    type:            z.literal('mixed'),
    totalVolumeLbs:  z.number().nullable(),
    volumeTrend:     z.enum(['up', 'down', 'flat', 'insufficient_data']),
  }),
  z.object({
    type: z.literal('insufficient_data'),
  }),
])
export type FocusKpi = z.infer<typeof FocusKpiSchema>

export const ClientKpiResponseSchema = z.object({
  clientId:   z.string().uuid(),
  computedAt: z.string().datetime(),

  // Card 1 — Streak
  currentStreakWeeks: z.number().int()
    .describe('Consecutive weeks with at least one session'),
  bestStreakWeeks:    z.number().int(),

  // Card 2 — This week
  sessionsThisWeek:    z.number().int(),
  weeklySessionTarget: z.number().int(),

  // Card 3 — Last session
  daysSinceLastSession: z.number().int().nullable()
    .describe('null = no sessions ever'),
  lastSessionDate:      z.string().nullable()
    .describe('YYYY-MM-DD of most recent completed session'),

  // Card 4 — Focus-specific KPI
  focusKpi: FocusKpiSchema,

  // Card 5 — Volume this month
  volumeThisMonthLbs: z.number().nullable(),

  // Card 6 — Total sessions
  totalSessionsAllTime: z.number().int(),

  // Card 7 — Avg energy
  avgEnergyThisMonth: z.number().nullable()
    .describe('Average energyLevel score (1–10) across sessions this month'),

  // Card 8 — Avg stress
  avgStressThisMonth: z.number().nullable()
    .describe('Average stressLevel score (1–10) across sessions this month'),
})
export type ClientKpiResponse = z.infer<typeof ClientKpiResponseSchema>
