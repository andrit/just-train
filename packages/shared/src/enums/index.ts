// ------------------------------------------------------------
// enums/index.ts — All application enums as Zod schemas
//
// Defined here as Zod enums so they can be:
//   1. Used directly in Zod schemas for validation
//   2. Converted to JSON Schema by fastify-type-provider-zod for Swagger
//   3. Inferred as TypeScript types with z.infer<>
//
// Both backend (Drizzle schema, route validation) and frontend
// (form types, state) import from this single file.
// ------------------------------------------------------------

import { z } from 'zod'

// Default workout progression within a session (editable by trainer)
export const WorkoutTypeEnum = z.enum(['cardio', 'stretching', 'calisthenics', 'resistance', 'cooldown'])
export type WorkoutType = z.infer<typeof WorkoutTypeEnum>

export const WORKOUT_TYPE_DEFAULT_ORDER: Record<WorkoutType, number> = {
  cardio: 1,
  stretching: 2,
  calisthenics: 3,
  resistance: 3, // interchangeable with calisthenics in slot 3
  cooldown: 4,
}

export const BodyPartEnum = z.enum(['arms', 'back', 'chest', 'legs', 'shoulders', 'core', 'full_body'])
export type BodyPart = z.infer<typeof BodyPartEnum>

export const EquipmentEnum = z.enum(['none', 'bodyweight', 'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell', 'resistance_band', 'cardio_machine', 'other'])
export type Equipment = z.infer<typeof EquipmentEnum>

export const SessionStatusEnum = z.enum(['planned', 'in_progress', 'completed', 'cancelled'])
export type SessionStatus = z.infer<typeof SessionStatusEnum>

export const IntensityEnum = z.enum(['low', 'moderate', 'high', 'max'])
export type Intensity = z.infer<typeof IntensityEnum>

export const WeightUnitEnum = z.enum(['lbs', 'kg'])
export type WeightUnit = z.infer<typeof WeightUnitEnum>

export const SideEnum = z.enum(['left', 'right', 'both'])
export type Side = z.infer<typeof SideEnum>

export const DifficultyEnum = z.enum(['beginner', 'intermediate', 'advanced'])
export type Difficulty = z.infer<typeof DifficultyEnum>

export const MediaTypeEnum = z.enum(['image', 'video'])
export type MediaType = z.infer<typeof MediaTypeEnum>

export const TrainerRoleEnum = z.enum(['trainer', 'admin'])
export type TrainerRole = z.infer<typeof TrainerRoleEnum>

export const SyncOperationEnum = z.enum(['insert', 'update', 'delete'])
export type SyncOperation = z.infer<typeof SyncOperationEnum>

// ── Client focus / progression ────────────────────────────────────────────────

// What kind of training a client is focused on.
// Drives which KPIs are surfaced in the dashboard and monthly report.
export const ClientFocusEnum = z.enum(['cardio', 'resistance', 'calisthenics', 'mixed'])
export type ClientFocus = z.infer<typeof ClientFocusEnum>

// Where a client is in their journey with the trainer.
//   assessment   — gathering baseline, learning what they can do and want
//   programming  — plan committed, actively working a program
//   maintenance  — goals achieved, sustaining performance
export const ProgressionStateEnum = z.enum(['assessment', 'programming', 'maintenance'])
export type ProgressionState = z.infer<typeof ProgressionStateEnum>

// ── SaaS / subscription ───────────────────────────────────────────────────────

// Subscription tier — what the trainer is paying for.
//   free    — self-training only (isSelf client only)
//   pro     — up to N external clients (to be defined)
//   studio  — unlimited clients, team features
export const SubscriptionTierEnum = z.enum(['free', 'pro', 'studio'])
export type SubscriptionTier = z.infer<typeof SubscriptionTierEnum>

export const SubscriptionStatusEnum = z.enum(['trialing', 'active', 'pastDue', 'cancelled'])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusEnum>

// Phase 3D: trainer mode — determines the product experience.
// 'athlete' = tracking own training only, no client roster shown.
// 'trainer' = managing one or more clients, full nav.
// Both modes can be free or paid — mode and tier are orthogonal.
export const TrainerModeEnum = z.enum(['athlete', 'trainer'])
export type TrainerMode = z.infer<typeof TrainerModeEnum>
