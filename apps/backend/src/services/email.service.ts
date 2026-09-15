// ------------------------------------------------------------
// services/email.service.ts — the one place transactional email is sent
//
// Verification and password-reset links both go through here. Two rules
// that closed a real hazard (audit 2026-08-28): there is NO default sender
// and NO default APP_URL. The old verification code fell back to
// `reports@trainerapp.io` / `https://trainerapp.io` — a domain this project
// does not own — so a missing APP_URL would have mailed live tokens to a
// link pointing somewhere else. Now a missing variable throws, the caller
// logs it, and nothing is sent.
//
// Required env: RESEND_API_KEY, REPORT_FROM_EMAIL (a verified Resend
// domain), APP_URL (the frontend origin, no trailing slash).
// ------------------------------------------------------------

import { Resend } from 'resend'

export interface EmailConfig {
  apiKey:    string
  fromEmail: string
  appUrl:    string
}

/** Throws with the missing variable's name — the log line says exactly what to set. */
export function emailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const apiKey    = env.RESEND_API_KEY
  const fromEmail = env.REPORT_FROM_EMAIL
  const appUrl    = env.APP_URL?.replace(/\/+$/, '')
  if (!apiKey)    throw new Error('RESEND_API_KEY is not set')
  if (!fromEmail) throw new Error('REPORT_FROM_EMAIL is not set')
  if (!appUrl)    throw new Error('APP_URL is not set — refusing to build email links to an unknown origin')
  return { apiKey, fromEmail, appUrl }
}

export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try { emailConfig(env); return true } catch { return false }
}

export async function sendTransactionalEmail(params: {
  to:      string
  subject: string
  html:    string
  config?: EmailConfig
}): Promise<void> {
  const cfg    = params.config ?? emailConfig()
  const resend = new Resend(cfg.apiKey)
  const { error } = await resend.emails.send({ from: cfg.fromEmail, to: params.to, subject: params.subject, html: params.html })
  if (error) throw new Error(error.message ?? 'Failed to send email')
}

/** Minimal escaping for the few user-supplied strings that reach an email body. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}
