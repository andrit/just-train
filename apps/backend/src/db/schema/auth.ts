// ------------------------------------------------------------
// schema/auth.ts — Authentication tables (Phase 2)
//
// WHY A SEPARATE REFRESH TOKENS TABLE?
//   Rather than storing a refresh token hash on the trainers row,
//   a dedicated table supports multiple devices and makes revocation
//   clean — logout from one device invalidates only that token,
//   not all sessions.
//
// TOKEN STRATEGY:
//   Access token  — short-lived JWT (15 min), stored in Zustand memory on frontend.
//                   Lost on page close; silently refreshed via refresh token cookie.
//   Refresh token — long-lived opaque random string (7 days).
//                   Only the HASH is stored here (argon2, same as passwords).
//                   The raw token is set as an httpOnly cookie — JavaScript cannot read it.
//                   On use, the old token is deleted and a new one issued (rotation).
//
// ROTATION:
//   Every successful token refresh deletes the old refresh_token row and creates a new one.
//   This means a stolen refresh token can only be used once before the legitimate user
//   triggers a rotation that invalidates it.
// ------------------------------------------------------------

import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { trainers } from './trainers'

// ------------------------------------------------------------
// REFRESH TOKENS
// ------------------------------------------------------------
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),

  trainerId: uuid('trainer_id')
    .notNull()
    .references(() => trainers.id, { onDelete: 'cascade' }),

  // argon2 hash of the raw refresh token.
  // The raw token is ONLY ever sent to the client once (in the httpOnly cookie).
  // This hash is what we verify against on refresh requests.
  tokenHash: text('token_hash').notNull(),

  // Which device/browser this token belongs to.
  // Set by the client on login using a device UUID stored in localStorage.
  // Useful for showing "logged in devices" in a future settings page.
  deviceId: text('device_id').notNull(),

  // Human-readable device info for display (e.g. "Chrome on iPhone")
  // Populated from the User-Agent header on login.
  deviceName: text('device_name'),

  // When this token expires — checked on every refresh attempt
  expiresAt: timestamp('expires_at').notNull(),

  // Set to true on explicit logout. Allows the token to be audited
  // before the cleanup job removes expired/revoked rows.
  revokedAt: timestamp('revoked_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),

  // Set to the current time each time this token is used to issue a new access token.
  // Useful for detecting refresh token reuse — if a token is used after being rotated,
  // it means it was stolen and the trainer's session can be fully terminated.
  lastUsedAt: timestamp('last_used_at'),
})

export type RefreshToken    = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert

// ------------------------------------------------------------
// RELATIONS
// ------------------------------------------------------------
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  trainer: one(trainers, {
    fields:     [refreshTokens.trainerId],
    references: [trainers.id],
  }),
}))
