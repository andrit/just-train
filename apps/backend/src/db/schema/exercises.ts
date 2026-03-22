// ------------------------------------------------------------
// schema/exercises.ts — Exercise Library tables
//
// The exercise library is the trainer's catalogue of movements.
// Exercises are reusable — the same exercise can appear in
// multiple sessions and templates.
//
// isDraft = true when quick-added mid-session (minimal fields).
// The trainer is reminded to enrich these in the library view.
// ------------------------------------------------------------

import {
  pgTable, uuid, text, boolean, integer, pgEnum, timestamp
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import {
  BodyPartEnum, WorkoutTypeEnum, EquipmentEnum,
  DifficultyEnum, MediaTypeEnum, ExerciseCategoryEnum,
} from '@trainer-app/shared'
import { trainers } from './trainers'

// ------------------------------------------------------------
// POSTGRES ENUMS — derived from Zod enum .options
// ------------------------------------------------------------
export const bodyPartEnum        = pgEnum('body_part',       BodyPartEnum.options)
export const workoutTypeEnum     = pgEnum('workout_type',    WorkoutTypeEnum.options)
export const equipmentEnum       = pgEnum('equipment',       EquipmentEnum.options)
export const difficultyEnum      = pgEnum('difficulty',      DifficultyEnum.options)
export const mediaTypeEnum       = pgEnum('media_type',      MediaTypeEnum.options)
export const exerciseCategoryEnum = pgEnum('exercise_category', ExerciseCategoryEnum.options)

// ------------------------------------------------------------
// BODY PARTS — lookup/reference table
// displayOrder controls how they appear in the UI picker
// ------------------------------------------------------------
export const bodyParts = pgTable('body_parts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         bodyPartEnum('name').notNull().unique(),
  displayOrder: integer('display_order').notNull().default(0),
})

export type BodyPart = typeof bodyParts.$inferSelect

// ------------------------------------------------------------
// EXERCISES
// ------------------------------------------------------------
export const exercises = pgTable('exercises', {
  id:       uuid('id').primaryKey().defaultRandom(),
  // null = public library exercise (no trainer owner)
  // set = trainer-created exercise (private or public)
  trainerId: uuid('trainer_id')
    .references(() => trainers.id, { onDelete: 'cascade' }),

  name:         text('name').notNull(),
  description:  text('description'),
  instructions: text('instructions'),   // Step-by-step form cues

  // bodyPartId is nullable — draft exercises (quick-added mid-session)
  // don't require a body part. Assigned during post-session enrichment.
  bodyPartId: uuid('body_part_id')
    .references(() => bodyParts.id),

  // workoutType on the exercise is the default/intended type.
  // When added to a workout block, the block's type should match
  // (enforced by UI, not DB constraint, for flexibility).
  workoutType: workoutTypeEnum('workout_type').notNull(),
  equipment:   equipmentEnum('equipment').notNull().default('none'),
  difficulty:  difficultyEnum('difficulty').notNull().default('beginner'),
  // compound = multi-joint (squat, bench). isolation = single-joint (curl, extension).
  // Optional — mainly relevant for resistance exercises.
  category:    exerciseCategoryEnum('exercise_category'),

  // true = quick-added mid-session, needs description/media added in library
  isDraft: boolean('is_draft').notNull().default(false),

  // true = visible to all trainers (future multi-trainer feature)
  isPublic: boolean('is_public').notNull().default(false),

  // Media — populated in Phase 9 (post-SPA refactor)
  // visualization: URL to a still image showing muscle groups (like a gym machine diagram)
  // demonstration: URL to a video demonstrating proper form
  visualization:  text('visualization'),
  demonstration:  text('demonstration'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Exercise    = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert

// ------------------------------------------------------------
// EXERCISE MEDIA
// Images and videos stored on Cloudinary.
// We only store the URL and public_id (needed to delete/transform).
// isPrimary = true marks the thumbnail shown in list cards.
// ------------------------------------------------------------
export const exerciseMedia = pgTable('exercise_media', {
  id:         uuid('id').primaryKey().defaultRandom(),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),

  mediaType:          mediaTypeEnum('media_type').notNull(),
  cloudinaryUrl:      text('cloudinary_url').notNull(),
  cloudinaryPublicId: text('cloudinary_public_id').notNull(),
  isPrimary:          boolean('is_primary').notNull().default(false),
  displayOrder:       integer('display_order').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type ExerciseMedia    = typeof exerciseMedia.$inferSelect
export type NewExerciseMedia = typeof exerciseMedia.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const bodyPartsRelations = relations(bodyParts, ({ many }) => ({
  exercises: many(exercises),
}))

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  trainer:  one(trainers,   { fields: [exercises.trainerId],  references: [trainers.id] }),
  bodyPart: one(bodyParts,  { fields: [exercises.bodyPartId], references: [bodyParts.id] }),
  media:    many(exerciseMedia),
}))

export const exerciseMediaRelations = relations(exerciseMedia, ({ one }) => ({
  exercise: one(exercises, { fields: [exerciseMedia.exerciseId], references: [exercises.id] }),
}))
