// ------------------------------------------------------------
// schema/password-reset.ts — password reset tokens (account plan B6)
//
// Same design as email_verification_tokens, same reasons: single-use
// (used_at), short-lived (1 h), 48 random bytes, SHA-256 hash stored so the
// row can be looked up by hash. argon2 would be wrong here — nothing is
// guessed repeatedly against these.
// ------------------------------------------------------------

import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { trainers } from './trainers'

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id').notNull().references(() => trainers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt:    timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tokenHashIdx: index('password_reset_tokens_token_hash_idx').on(t.tokenHash),
  trainerIdx:   index('password_reset_tokens_trainer_id_idx').on(t.trainerId),
}))

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  trainer: one(trainers, { fields: [passwordResetTokens.trainerId], references: [trainers.id] }),
}))
