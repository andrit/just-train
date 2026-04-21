// ------------------------------------------------------------
// schema/session-exercise-media.ts — Form check clips/photos (v2.12.0)
//
// Short video clips (≤30s) or photos attached to a session exercise.
// The trainer records a client's form during a set, reviews it
// between sessions, or references it in the monthly report.
//
// HIERARCHY:
//   Session → Workout → SessionExercise → SessionExerciseMedia
//
// WHY SESSION EXERCISES (not sets):
//   A form check applies to how the client performs the movement
//   in general during that session — not to a specific set.
//   Attaching to session_exercises avoids multiplying storage per set.
//
// CLOUDINARY FOLDER:
//   trainer-app/clients/<clientId>/sessions/<sessionId>/<sessionExerciseId>/
// ------------------------------------------------------------

import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sessionExercises } from './sessions'
import { mediaTypeEnum } from './exercises'

// ------------------------------------------------------------
// SESSION EXERCISE MEDIA
// ------------------------------------------------------------
export const sessionExerciseMedia = pgTable('session_exercise_media', {
  id: uuid('id').primaryKey().defaultRandom(),

  sessionExerciseId: uuid('session_exercise_id')
    .notNull()
    .references(() => sessionExercises.id, { onDelete: 'cascade' }),

  // Reuse existing media_type pgEnum from exercises schema
  mediaType: mediaTypeEnum('media_type').notNull(),

  // Cloudinary storage
  cloudinaryUrl:      text('cloudinary_url').notNull(),
  cloudinaryPublicId: text('cloudinary_public_id').notNull(),

  // Video duration in seconds — null for images
  durationSeconds: integer('duration_seconds'),

  // Optional note — e.g. "knee caving on rep 3"
  caption: text('caption'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type SessionExerciseMedia    = typeof sessionExerciseMedia.$inferSelect
export type NewSessionExerciseMedia = typeof sessionExerciseMedia.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const sessionExerciseMediaRelations = relations(sessionExerciseMedia, ({ one }) => ({
  sessionExercise: one(sessionExercises, {
    fields: [sessionExerciseMedia.sessionExerciseId],
    references: [sessionExercises.id],
  }),
}))
