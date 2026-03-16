// ------------------------------------------------------------
// schema/templates.ts — Reusable workout plan templates
//
// Templates mirror the Session → Workout → Exercise hierarchy
// but store target/planned values instead of actual performance.
//
// FLOW: Trainer builds a template → applies it to a session →
// session is pre-populated with workouts and exercises →
// trainer adjusts targets if needed → records actuals on the day.
// ------------------------------------------------------------

import { pgTable, uuid, text, integer, real, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { IntensityEnum } from '@trainer-app/shared'
import { trainers, weightUnitEnum } from './trainers'
import { exercises, workoutTypeEnum } from './exercises'

// ------------------------------------------------------------
// POSTGRES ENUM
// ------------------------------------------------------------
export const intensityEnum = pgEnum('intensity_level', IntensityEnum.options)

// ------------------------------------------------------------
// TEMPLATES
// ------------------------------------------------------------
export const templates = pgTable('templates', {
  id:        uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),   // e.g. "Push Day A", "Full Body Cardio"
  description: text('description'),
  notes:       text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Template    = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert

// ------------------------------------------------------------
// TEMPLATE WORKOUTS — each block within a template
// orderIndex controls default order when applied to a session
// ------------------------------------------------------------
export const templateWorkouts = pgTable('template_workouts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  templateId:  uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  workoutType: workoutTypeEnum('workout_type').notNull(),
  orderIndex:  integer('order_index').notNull().default(0),
  notes:       text('notes'),
})

export type TemplateWorkout    = typeof templateWorkouts.$inferSelect
export type NewTemplateWorkout = typeof templateWorkouts.$inferInsert

// ------------------------------------------------------------
// TEMPLATE EXERCISES — exercises within a template workout block
// targetIntensity is for cardio exercises only.
// ------------------------------------------------------------
export const templateExercises = pgTable('template_exercises', {
  id:               uuid('id').primaryKey().defaultRandom(),
  templateWorkoutId: uuid('template_workout_id')
    .notNull()
    .references(() => templateWorkouts.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'restrict' }),
    // onDelete restrict: cannot delete an exercise used in a template

  orderIndex: integer('order_index').notNull().default(0),

  // Target / planned performance values
  targetSets:            integer('target_sets'),
  targetReps:            integer('target_reps'),
  targetWeight:          real('target_weight'),
  targetWeightUnit:      weightUnitEnum('target_weight_unit').notNull().default('lbs'),
  targetDurationSeconds: integer('target_duration_seconds'),
  targetDistance:        real('target_distance'),
  targetIntensity:       intensityEnum('target_intensity'),
  notes:                 text('notes'),
})

export type TemplateExercise    = typeof templateExercises.$inferSelect
export type NewTemplateExercise = typeof templateExercises.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const templatesRelations = relations(templates, ({ one, many }) => ({
  trainer:          one(trainers,        { fields: [templates.trainerId],             references: [trainers.id] }),
  templateWorkouts: many(templateWorkouts),
}))

export const templateWorkoutsRelations = relations(templateWorkouts, ({ one, many }) => ({
  template:          one(templates,         { fields: [templateWorkouts.templateId], references: [templates.id] }),
  templateExercises: many(templateExercises),
}))

export const templateExercisesRelations = relations(templateExercises, ({ one }) => ({
  templateWorkout: one(templateWorkouts, { fields: [templateExercises.templateWorkoutId], references: [templateWorkouts.id] }),
  exercise:        one(exercises,        { fields: [templateExercises.exerciseId],        references: [exercises.id] }),
}))
