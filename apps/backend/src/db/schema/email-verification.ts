// ------------------------------------------------------------
// schema/email-verification.ts — Email verification tokens (Phase 10.5)
//
// One row per pending verification. Single-use — used_at is set on
// redemption. Short-lived (24h). Same pattern as refresh_tokens.
// ------------------------------------------------------------

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { trainers } from './trainers'

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),

  trainerId: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id, { onDelete: 'cascade' }),

  // SHA-256 hex digest of the raw token sent in the email link.
  // The raw token is never stored — only the hash.
  tokenHash: text('token_hash').notNull(),

  expiresAt: timestamp('expires_at').notNull(),

  // Set when the token is redeemed — prevents reuse.
  usedAt: timestamp('used_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type EmailVerificationToken    = typeof emailVerificationTokens.$inferSelect
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  trainer: one(trainers, {
    fields:     [emailVerificationTokens.trainerId],
    references: [trainers.id],
  }),
}))
