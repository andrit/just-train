// ------------------------------------------------------------
// services/lockout.service.ts — the process-wide login lockout + the notice
// that goes to the account owner when their address gets locked.
// Logic lives in lib/loginLockout.ts (pure, unit-tested); this file owns the
// singleton and the I/O around it.
// ------------------------------------------------------------

import { createLoginLockout, LOCKOUT_THRESHOLD, LOCKOUT_WINDOW_MS } from '../lib/loginLockout'
import { emailConfig, sendTransactionalEmail, escapeHtml } from './email.service'

export const loginLockout = createLoginLockout()

/**
 * Best-effort, never awaited by the login path's response. Only sent when
 * the locked address belongs to a real account — an unknown address has
 * nobody to warn.
 */
export async function sendLockoutNotice(email: string, name: string): Promise<void> {
  const cfg     = emailConfig()   // throws when mail is not configured — caller catches
  const minutes = Math.round(LOCKOUT_WINDOW_MS / 60_000)
  await sendTransactionalEmail({
    to:      email,
    subject: 'Sign-in to your Just Train account was locked',
    config:  cfg,
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      `<p>There were ${LOCKOUT_THRESHOLD} failed sign-in attempts on your account, so password sign-in is paused for ${minutes} minutes. ` +
      `Devices already signed in are not affected.</p>`,
      `<p>If this was you, wait it out and try again. If it wasn't, change your password once the lock lifts: ` +
      `<a href="${cfg.appUrl}/forgot-password">${cfg.appUrl}/forgot-password</a></p>`,
    ].join(''),
  })
}
