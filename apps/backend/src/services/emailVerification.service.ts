// ------------------------------------------------------------
// services/emailVerification.service.ts — proving a mailbox
//
// Two flows share one token table (`email_verification_tokens`, SHA-256 of
// a 48-byte token, 24 h TTL, single use):
//
//   • plain verification — the token has no `newEmail`; redeeming it marks
//     the CURRENT address verified.
//   • change email (account plan B7) — `requestEmailChange` re-proves the
//     password, records `trainers.pendingEmail`, and mails a token whose
//     `newEmail` is the target address. Redeeming THAT token swaps the
//     sign-in email. The old address keeps working until then, so a typo
//     cannot lock anyone out, and a plain-verification token sent to the
//     old mailbox can never perform the swap — only a token that carries
//     the target can.
//
// On a successful swap the OLD address gets a notice. An intruder holding a
// live session who re-points the email is the lock-out scenario; the notice
// to the address the owner still controls is their only signal.
// ------------------------------------------------------------

import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, trainers, emailVerificationTokens } from '../db'
import {
  verifyPassword,
  generateVerificationToken,
  sha256,
  EMAIL_VERIFICATION_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from './auth.service'
import { emailConfig, sendTransactionalEmail, escapeHtml } from './email.service'

export type RequestEmailChangeOutcome =
  | 'sent' | 'not_found' | 'wrong_password' | 'same_email' | 'taken' | 'cooldown' | 'send_failed'

export interface RequestEmailChangeResult {
  outcome:       RequestEmailChangeOutcome
  pendingEmail?: string
}

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Start an email change. Records the pending address and mails a change
 * token to it. Earlier unused tokens for this trainer (either flow) are
 * consumed so only the newest link works.
 */
export async function requestEmailChange(
  trainerId: string,
  newEmailRaw: string,
  password: string,
  now: Date = new Date(),
): Promise<RequestEmailChangeResult> {
  const trainer = await db.query.trainers.findFirst({
    where:   eq(trainers.id, trainerId),
    columns: { id: true, name: true, email: true, passwordHash: true },
  })
  if (!trainer) return { outcome: 'not_found' }

  const ok = await verifyPassword(password, trainer.passwordHash)
  if (!ok) return { outcome: 'wrong_password' }

  const newEmail = normalize(newEmailRaw)
  if (newEmail === trainer.email) return { outcome: 'same_email' }

  const holder = await db.query.trainers.findFirst({
    where:   eq(trainers.email, newEmail),
    columns: { id: true },
  })
  if (holder) return { outcome: 'taken' }

  const latest = await db.query.emailVerificationTokens.findFirst({
    where:   eq(emailVerificationTokens.trainerId, trainerId),
    orderBy: [desc(emailVerificationTokens.createdAt)],
    columns: { createdAt: true },
  })
  if (latest && now.getTime() - latest.createdAt.getTime() < VERIFICATION_RESEND_COOLDOWN_MS) {
    return { outcome: 'cooldown' }
  }

  const { raw, hash } = generateVerificationToken()
  await db.transaction(async (tx) => {
    await tx.update(emailVerificationTokens).set({ usedAt: now })
      .where(and(eq(emailVerificationTokens.trainerId, trainerId), isNull(emailVerificationTokens.usedAt)))
    await tx.insert(emailVerificationTokens).values({
      trainerId, tokenHash: hash, newEmail, expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
    })
    await tx.update(trainers).set({ pendingEmail: newEmail, updatedAt: now }).where(eq(trainers.id, trainerId))
  })

  try {
    const cfg  = emailConfig()
    const link = `${cfg.appUrl}/verify-email?token=${raw}`
    await sendTransactionalEmail({
      to:      newEmail,
      subject: 'Confirm your new Just Train email',
      config:  cfg,
      html: [
        `<p>Hi ${escapeHtml(trainer.name)},</p>`,
        `<p>Confirm this address to make it your Just Train sign-in email. The link works for 24 hours.</p>`,
        `<p><a href="${link}">${link}</a></p>`,
        `<p>If you didn't ask for this, ignore it — your current sign-in email stays as it is.</p>`,
      ].join(''),
    })
  } catch {
    return { outcome: 'send_failed', pendingEmail: newEmail }
  }
  return { outcome: 'sent', pendingEmail: newEmail }
}

/** Drop a pending change: clears the address and consumes its tokens. Idempotent. */
export async function cancelEmailChange(trainerId: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(emailVerificationTokens).set({ usedAt: now })
      .where(and(eq(emailVerificationTokens.trainerId, trainerId), isNull(emailVerificationTokens.usedAt)))
    await tx.update(trainers).set({ pendingEmail: null, updatedAt: now }).where(eq(trainers.id, trainerId))
  })
}

export type RedeemOutcome = 'ok' | 'expired' | 'used' | 'not_found' | 'taken'

export interface RedeemResult {
  outcome:    RedeemOutcome
  /** Set when the token changed the sign-in email. */
  changedTo?: string
}

/**
 * Redeem a verification link. A plain token verifies the current address; a
 * change token swaps the sign-in email to the address it carries (and marks
 * it verified). `taken` = someone registered that address in the meantime —
 * the pending change stays so the user can see and cancel it.
 */
export async function redeemVerificationToken(rawToken: string, now: Date = new Date()): Promise<RedeemResult> {
  const hash = sha256(rawToken)

  const record = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, hash),
  })
  if (!record)                 return { outcome: 'not_found' }
  if (record.usedAt)           return { outcome: 'used' }
  if (record.expiresAt <= now) return { outcome: 'expired' }

  if (!record.newEmail) {
    await db.transaction(async (tx) => {
      await tx.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.id, record.id))
      await tx.update(trainers).set({ emailVerified: true, updatedAt: now }).where(eq(trainers.id, record.trainerId))
    })
    return { outcome: 'ok' }
  }

  const newEmail = record.newEmail
  const holder = await db.query.trainers.findFirst({ where: eq(trainers.email, newEmail), columns: { id: true } })
  if (holder && holder.id !== record.trainerId) {
    await db.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.id, record.id))
    return { outcome: 'taken' }
  }

  const trainer = await db.query.trainers.findFirst({
    where:   eq(trainers.id, record.trainerId),
    columns: { name: true, email: true },
  })
  if (!trainer) return { outcome: 'not_found' }
  const oldEmail = trainer.email

  await db.transaction(async (tx) => {
    await tx.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.id, record.id))
    await tx.update(trainers)
      .set({ email: newEmail, pendingEmail: null, emailVerified: true, updatedAt: now })
      .where(eq(trainers.id, record.trainerId))
  })

  await notifyOldAddress(oldEmail, trainer.name, newEmail)
  return { outcome: 'ok', changedTo: newEmail }
}

/** Best-effort: the swap is already committed; a failed notice must not undo it. */
async function notifyOldAddress(oldEmail: string, name: string, newEmail: string): Promise<void> {
  try {
    const cfg = emailConfig()
    await sendTransactionalEmail({
      to:      oldEmail,
      subject: 'Your Just Train sign-in email was changed',
      config:  cfg,
      html: [
        `<p>Hi ${escapeHtml(name)},</p>`,
        `<p>The sign-in email for your Just Train account is now <strong>${escapeHtml(newEmail)}</strong>.</p>`,
        `<p>If this was you, there's nothing to do. If it wasn't, reset your password right away from ` +
        `<a href="${cfg.appUrl}/forgot-password">${cfg.appUrl}/forgot-password</a> using the new address.</p>`,
      ].join(''),
    })
  } catch {
    // logged by the caller's route on the request path; nothing to roll back here
  }
}
