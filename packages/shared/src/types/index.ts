// ------------------------------------------------------------
// types.ts — Core TypeScript types for the Trainer App
//
// These types represent the shape of data as it flows through
// the application — from the database, through the API, to the UI.
//
// They are intentionally separate from the Zod schemas (which are
// for INPUT validation) — these types represent full DB records
// as they would be returned from the API.
// ------------------------------------------------------------

import type {
  WorkoutType,
  BodyPart,
  Equipment,
  SessionStatus,
  Intensity,
  WeightUnit,
  Side,
  Difficulty,
  MediaType,
  TrainerRole,
} from '../enums/index'

// ============================================================
// TRAINER
// ============================================================

export interface Trainer {
  id: string
  name: string
  email: string
  role: TrainerRole
  weightUnitPreference: WeightUnit
  createdAt: string
  updatedAt: string
}

// ============================================================
// CLIENT
// ============================================================

export interface Client {
  id: string
  trainerId: string
  name: string
  email?: string
  phone?: string
  photoUrl?: string
  dateOfBirth?: string
  goals?: string
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================
// EXERCISE LIBRARY
// ============================================================

export interface BodyPartRecord {
  id: string
  name: BodyPart
  displayOrder: number
}

export interface Exercise {
  id: string
  trainerId: string
  name: string
  description?: string
  instructions?: string
  bodyPartId: string
  bodyPart?: BodyPartRecord // joined when fetching exercise details
  workoutType: WorkoutType
  equipment: Equipment
  difficulty: Difficulty
  isDraft: boolean   // true = quick-added mid-session, needs enriching in library
  isPublic: boolean
  media?: ExerciseMedia[] // joined when fetching exercise details
  createdAt: string
  updatedAt: string
}

export interface ExerciseMedia {
  id: string
  exerciseId: string
  mediaType: MediaType
  cloudinaryUrl: string
  cloudinaryPublicId: string
  isPrimary: boolean
  displayOrder: number
  createdAt: string
}

// ============================================================
// TEMPLATES (reusable workout blueprints)
// ============================================================

export interface Template {
  id: string
  trainerId: string
  name: string
  description?: string
  notes?: string
  templateWorkouts?: TemplateWorkout[] // joined when fetching full template
  createdAt: string
  updatedAt: string
}

export interface TemplateWorkout {
  id: string
  templateId: string
  workoutType: WorkoutType
  orderIndex: number
  notes?: string
  templateExercises?: TemplateExercise[]
}

export interface TemplateExercise {
  id: string
  templateWorkoutId: string
  exerciseId: string
  exercise?: Exercise // joined
  orderIndex: number
  targetSets?: number
  targetReps?: number
  targetWeight?: number
  targetWeightUnit: WeightUnit
  targetDurationSeconds?: number
  targetDistance?: number
  targetIntensity?: Intensity
  notes?: string
}

// ============================================================
// SESSIONS
// ============================================================

export interface Session {
  id: string
  clientId: string
  client?: Client // joined
  trainerId: string
  templateId?: string
  name?: string
  date: string
  startTime?: string
  endTime?: string
  status: SessionStatus
  notes?: string
  workouts?: Workout[] // joined when fetching full session
  createdAt: string
  updatedAt: string
}

// A workout block within a session (e.g. the 'resistance' block for arms & back)
export interface Workout {
  id: string
  sessionId: string
  workoutType: WorkoutType
  orderIndex: number
  notes?: string
  sessionExercises?: SessionExercise[] // joined when fetching full workout
  createdAt: string
}

// An exercise added to a workout block in a session
export interface SessionExercise {
  id: string
  workoutId: string
  exerciseId: string
  exercise?: Exercise // joined
  orderIndex: number
  targetSets?: number
  targetReps?: number
  targetWeight?: number
  targetWeightUnit: WeightUnit
  targetDurationSeconds?: number
  targetDistance?: number
  targetIntensity?: Intensity
  notes?: string
  sets?: Set[] // joined when fetching full session exercise
}

// An individual recorded set — the atomic unit of workout tracking
export interface Set {
  id: string
  sessionExerciseId: string
  setNumber: number
  // Resistance & calisthenics
  reps?: number
  weight?: number
  weightUnit: WeightUnit
  // Cardio
  durationSeconds?: number
  distance?: number
  speed?: number
  intensity?: Intensity
  // Stretching
  side?: Side
  // Universal
  rpe?: number // Rate of Perceived Exertion 1-10
  notes?: string
  createdAt: string
}

// ============================================================
// SYNC
// ============================================================

// A pending change that needs to be replayed on the server
// after the device comes back online
export interface SyncLogEntry {
  id: string
  trainerId: string
  deviceId: string
  tableName: string
  recordId: string
  operation: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  createdLocallyAt: string
  syncedAt?: string // null = still pending
}
