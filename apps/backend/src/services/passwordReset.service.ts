// ------------------------------------------------------------
// services/passwordReset.service.ts — forgot / reset password (account plan B6)
//
// requestPasswordReset(email) never reveals whether the email exists: the
// route answers 202 either way, and the only observable difference is the
// email that does or does not arrive. Tokens: 48 random bytes, SHA-256 hash
// stored, 1-hour TTL, single use; requesting a new one invalidates the
// earlier ones. A successful reset revokes EVERY device — the person who
// reset the password is the person who should hold the sessions.
// ------------------------------------------------------------

import crypto from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, trainers, passwordResetTokens } from '../db'
import { hashPassword, revokeAllRefreshTokens } from './auth.service'
import { emailConfig, sendTransactionalEmail, escapeHtml } from './email.service'

export const RESET_TOKEN_TTL_MS  = 60 * 60 * 1000   // 1 hour
export const RESET_COOLDOWN_MS   = 60 * 1000        // one email per minute per account

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString('hex')
  return { raw, hash: sha256(raw) }
}

export type RequestResetOutcome = 'sent' | 'no_account' | 'cooldown' | 'send_failed'

/**
 * Issue a reset link for `email`. Returns what happened for logging; the
 * caller must not surface anything but a uniform 202.
 */
export async function requestPasswordReset(email: string, now: Date = new Date()): Promise<RequestResetOutcome> {
  const trainer = await db.query.trainers.findFirst({
    where:   eq(trainers.email, email.toLowerCase()),
    columns: { id: true, email: true, name: true },
  })
  if (!trainer) return 'no_account'

  const latest = await db.query.passwordResetTokens.findFirst({
    where:   eq(passwordResetTokens.trainerId, trainer.id),
    orderBy: [desc(passwordResetTokens.createdAt)],
    columns: { createdAt: true },
  })
  if (latest && now.getTime() - latest.createdAt.getTime() < RESET_COOLDOWN_MS) return 'cooldown'

  const { raw, hash } = generateResetToken()
  await db.transaction(async (tx) => {
    // Earlier unused tokens die — only the newest link works.
    await tx.update(passwordResetTokens).set({ usedAt: now })
      .where(and(eq(passwordResetTokens.trainerId, trainer.id), isNull(passwordResetTokens.usedAt)))
    await tx.insert(passwordResetTokens).values({ trainerId: trainer.id, tokenHash: hash, expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) })
  })

  try {
    const cfg  = emailConfig()
    const link = `${cfg.appUrl}/reset-password?token=${raw}`
    await sendTransactionalEmail({
      to:      trainer.email,
      subject: 'Reset your Just Train password',
      config:  cfg,
      html: [
        `<p>Hi ${escapeHtml(trainer.name)},</p>`,
        `<p>Someone asked to reset the password for this account. If that was you, use the link below within the next hour:</p>`,
        `<p><a href="${link}">${link}</a></p>`,
        `<p>If it wasn't you, ignore this email — your password stays as it is, and nothing changes until the link is used.</p>`,
      ].join(''),
    })
    return 'sent'
  } catch {
    return 'send_failed'
  }
}

export type ResetOutcome = 'ok' | 'not_found' | 'used' | 'expired'

/**
 * Redeem a token: set the new password, mark the token used, sign out every
 * device. Returns the trainer id on success for logging.
 */
export async function resetPasswordWithToken(rawToken: string, newPassword: string, now: Date = new Date()):
  Promise<{ outcome: ResetOutcome; trainerId?: string }> {
  const record = await db.query.passwordResetTokens.findFirst({ where: eq(passwordResetTokens.tokenHash, sha256(rawToken)) })
  if (!record)                return { outcome: 'not_found' }
  if (record.usedAt)          return { outcome: 'used' }
  if (record.expiresAt <= now) return { outcome: 'expired' }

  const passwordHash = await hashPassword(newPassword)
  await db.transaction(async (tx) => {
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, record.id))
    await tx.update(trainers).set({ passwordHash, updatedAt: now }).where(eq(trainers.id, record.trainerId))
  })
  await revokeAllRefreshTokens(record.trainerId)
  return { outcome: 'ok', trainerId: record.trainerId }
}
