// ------------------------------------------------------------
// schema/snapshot-media.ts — Progress photo media (v2.12.0)
//
// Photos attached to client snapshots. The visual dimension of
// the "then vs now" comparison — front/side/back poses that tell
// the story numbers sometimes miss.
//
// HIERARCHY:
//   Client → ClientSnapshot → SnapshotMedia
//
// Follows the same pattern as exercise_media — Cloudinary URL +
// public ID stored per record, cascade delete with parent.
//
// PRIVACY:
//   The `shareable` flag gates which photos are eligible for social
//   sharing (v2.13.0). Only relevant when the trainer's
//   photoSharingPreference = 'share_selected'. When preference is
//   'private', no photos are shareable regardless of this flag.
//   When 'share_all', all photos are shareable regardless of flag.
// ------------------------------------------------------------

import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { SnapshotPoseEnum } from '@trainer-app/shared'
import { clientSnapshots } from './client-snapshots'

// ------------------------------------------------------------
// POSTGRES ENUM
// ------------------------------------------------------------
export const snapshotPoseEnum = pgEnum('snapshot_pose', SnapshotPoseEnum.options)

// ------------------------------------------------------------
// SNAPSHOT MEDIA
// ------------------------------------------------------------
export const snapshotMedia = pgTable('snapshot_media', {
  id: uuid('id').primaryKey().defaultRandom(),

  snapshotId: uuid('snapshot_id')
    .notNull()
    .references(() => clientSnapshots.id, { onDelete: 'cascade' }),

  pose: snapshotPoseEnum('pose').notNull(),

  // Cloudinary storage — same pattern as exercise_media
  cloudinaryUrl:      text('cloudinary_url').notNull(),
  cloudinaryPublicId: text('cloudinary_public_id').notNull(),

  // Image dimensions — populated from Cloudinary upload response
  width:  integer('width'),
  height: integer('height'),

  // Optional trainer/athlete note — e.g. "Week 4, post-cut"
  caption: text('caption'),

  // Social sharing gate — only matters when trainer.photoSharingPreference = 'share_selected'
  shareable: boolean('shareable').notNull().default(false),

  orderIndex: integer('order_index').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type SnapshotMedia    = typeof snapshotMedia.$inferSelect
export type NewSnapshotMedia = typeof snapshotMedia.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const snapshotMediaRelations = relations(snapshotMedia, ({ one }) => ({
  snapshot: one(clientSnapshots, {
    fields: [snapshotMedia.snapshotId],
    references: [clientSnapshots.id],
  }),
}))
