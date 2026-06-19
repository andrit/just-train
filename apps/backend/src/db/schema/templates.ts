// ------------------------------------------------------------
// schema/templates.ts — Reusable workout plan templates
//
// Flat structure: Template → TemplateExercises (no intermediate block layer).
// workoutType on each exercise is inherited from the exercise record at add time.
//
// FLOW: Trainer builds a template → applies it to a session →
// session_exercises are created directly from template_exercises →
// trainer adjusts targets if needed → records actuals on the day.
// ------------------------------------------------------------

import { pgTable, uuid, text, integer, real, timestamp, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { IntensityEnum, TemplateTypeEnum } from '@trainer-app/shared'
import { trainers, weightUnitEnum } from './trainers'
import { exercises, workoutTypeEnum } from './exercises'

// ------------------------------------------------------------
// POSTGRES ENUMS
// ------------------------------------------------------------
export const intensityEnum    = pgEnum('intensity_level', IntensityEnum.options)
export const templateTypeEnum = pgEnum('template_type',   TemplateTypeEnum.options)

// ------------------------------------------------------------
// TEMPLATES
// ------------------------------------------------------------
export const templates = pgTable('templates', {
  id:        uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  // Advisory scope hint — 'session' allows mixed types, 'workout' implies one type.
  // Not schema-enforced; used as a UI pre-filter only.
  type:        templateTypeEnum('type').notNull().default('session'),
  description: text('description'),
  notes:       text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type Template    = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert

// ------------------------------------------------------------
// TEMPLATE EXERCISES — exercises directly within a template
// workoutType is denormalized from the exercise at add time for
// efficient filtering without a join to the exercises table.
// ------------------------------------------------------------
export const templateExercises = pgTable('template_exercises', {
  id:         uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  exerciseId: uuid('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'restrict' }),

  workoutType: workoutTypeEnum('workout_type').notNull(),
  orderIndex:  integer('order_index').notNull().default(0),

  // Target / planned performance values
  targetSets:            integer('target_sets'),
  targetReps:            integer('target_reps'),
  targetRepsPerSet:      text('target_reps_per_set'),
  targetWeight:          real('target_weight'),
  targetWeightUnit:      weightUnitEnum('target_weight_unit').notNull().default('lbs'),
  targetDurationSeconds: integer('target_duration_seconds'),
  targetDistance:        real('target_distance'),
  targetIntensity:       intensityEnum('target_intensity'),
  notes:                 text('notes'),
}, (t) => ({
  templateIdIdx: index('template_exercises_template_id_idx').on(t.templateId),
  exerciseIdIdx: index('template_exercises_exercise_id_idx').on(t.exerciseId),
}))

export type TemplateExercise    = typeof templateExercises.$inferSelect
export type NewTemplateExercise = typeof templateExercises.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const templatesRelations = relations(templates, ({ one, many }) => ({
  trainer:           one(trainers,  { fields: [templates.trainerId], references: [trainers.id] }),
  templateExercises: many(templateExercises),
}))

export const templateExercisesRelations = relations(templateExercises, ({ one }) => ({
  template: one(templates,  { fields: [templateExercises.templateId], references: [templates.id] }),
  exercise: one(exercises,  { fields: [templateExercises.exerciseId], references: [exercises.id] }),
}))
