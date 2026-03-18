// ------------------------------------------------------------
// services/alert.service.ts — At-risk alert digest email (v1.7.5)
//
// Sends a single digest email to the trainer listing all clients
// who haven't trained in 14+ days.
//
// TONE: always neutral/clinical regardless of trainer.alertTone.
// TEMPLATE: table-based, inline styles — same rules as report.service.ts.
// ------------------------------------------------------------

import { Resend } from 'resend'

export interface AtRiskClient {
  name:          string
  daysSinceLast: number | null   // null = never trained
}

export interface AtRiskDigestData {
  trainerName:   string
  trainerEmail:  string
  atRiskClients: AtRiskClient[]
}

// ── HTML builder ───────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildAtRiskHtml(data: AtRiskDigestData): string {
  const { trainerName, atRiskClients } = data

  const rows = atRiskClients.map(c => {
    const label = c.daysSinceLast === null
      ? 'No sessions yet'
      : `${c.daysSinceLast} days ago`
    const urgent = (c.daysSinceLast ?? 99) >= 21

    return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#111827;">
        ${esc(c.name)}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;
                 color:${urgent ? '#ef4444' : '#f59e0b'};text-align:right;font-weight:600;">
        ${label}
      </td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>At-Risk Client Alert</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

    <!-- Header -->
    <tr>
      <td style="background:#111827;padding:28px 28px 20px;border-radius:12px 12px 0 0;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">
          Client Check-In Alert
        </p>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">
          ${atRiskClients.length} client${atRiskClients.length !== 1 ? 's' : ''} need${atRiskClients.length === 1 ? 's' : ''} attention
        </h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="background:#ffffff;padding:24px 28px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">
          Hi ${esc(trainerName)}, the following clients haven't logged a session in 14 or more days.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;">
          <tr style="background:#f9fafb;">
            <th style="padding:10px 16px;font-size:11px;text-transform:uppercase;
                       letter-spacing:1px;color:#6b7280;text-align:left;font-weight:600;">
              Client
            </th>
            <th style="padding:10px 16px;font-size:11px;text-transform:uppercase;
                       letter-spacing:1px;color:#6b7280;text-align:right;font-weight:600;">
              Last Session
            </th>
          </tr>
          ${rows}
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#111827;padding:20px 28px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#6b7280;">
          You're receiving this because client alerts are enabled in your TrainerApp preferences.
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`
}

// ── Send function ──────────────────────────────────────────────────────────────

export async function sendAtRiskDigest(data: AtRiskDigestData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')

  const fromEmail = process.env.REPORT_FROM_EMAIL ?? 'reports@trainerapp.io'
  const resend    = new Resend(apiKey)

  const count   = data.atRiskClients.length
  const subject = `${count} client${count !== 1 ? 's' : ''} need${count === 1 ? 's' : ''} a check-in`

  const { error } = await resend.emails.send({
    from:    `TrainerApp Alerts <${fromEmail}>`,
    to:      data.trainerEmail,
    subject,
    html:    buildAtRiskHtml(data),
  })

  if (error) throw new Error(error.message)
}
