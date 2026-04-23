// ------------------------------------------------------------
// services/report.service.ts — Monthly report generation (v1.7.0)
//
// Builds the HTML email and sends it via Resend.
//
// TEMPLATE NOTES:
//   - Table-based layout with inline styles only
//   - No flexbox, no CSS classes, no external fonts
//   - Max width 600px — standard email safe width
//   - Dark background avoided — email clients vary wildly
//   - Tested visually against: Gmail web, Gmail iOS, Apple Mail
//
// DATE RANGE LOGIC:
//   - Default: previous calendar month
//   - Fallback: rolling last 30 days if no sessions in previous month
// ------------------------------------------------------------

import { Resend } from 'resend'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportSession {
  date:        string   // YYYY-MM-DD
  name:        string | null
  sets:        number
  volumeLbs:   number
  energyLevel: number | null
}

export interface ReportGoal {
  goal:       string
  achievedAt: string | null
}

export interface ReportChallenge {
  title:        string
  currentValue: number
  targetValue:  number
  targetUnit:   string | null
  status:       string
  deadline:     string
}

export interface ReportData {
  // Recipients
  clientName:    string
  clientEmail:   string
  trainerName:   string
  trainerEmail:  string

  // Period
  periodLabel:   string   // e.g. "March 2025" or "Last 30 days"
  periodStart:   string   // YYYY-MM-DD
  periodEnd:     string   // YYYY-MM-DD

  // Content
  sessions:      ReportSession[]
  goals:         ReportGoal[]
  challenges:    ReportChallenge[]
  weeklyTarget:  number

  // KPIs
  avgEnergyLevel: number | null
  avgStressLevel: number | null
  totalVolumeLbs: number | null
  focusKpiLabel:  string | null   // e.g. "Squat — est. 1RM 95kg" or "8.4 km avg"

  // Trainer note
  trainerNote:   string | null
}

// ── Date range helpers ─────────────────────────────────────────────────────────

export interface ReportPeriod {
  label: string
  start: Date
  end:   Date
}

export function resolveReportPeriod(
  sessions: { date: string }[],
): ReportPeriod {
  const now       = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0)  // last day of prev month

  const prevMonthLabel = prevMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Check if any sessions fall in previous calendar month
  const inPrevMonth = sessions.filter((s) => {
    const d = new Date(s.date + 'T00:00:00')
    return d >= prevMonth && d <= prevEnd
  })

  if (inPrevMonth.length > 0) {
    return { label: prevMonthLabel, start: prevMonth, end: prevEnd }
  }

  // Fallback: rolling last 30 days
  const rolling30Start = new Date(now)
  rolling30Start.setDate(rolling30Start.getDate() - 30)

  const inLast30 = sessions.filter((s) => {
    const d = new Date(s.date + 'T00:00:00')
    return d >= rolling30Start && d <= now
  })

  if (inLast30.length > 0) {
    return { label: 'Last 30 days', start: rolling30Start, end: now }
  }

  // No sessions either way — return previous month anyway (will show empty state)
  return { label: prevMonthLabel, start: prevMonth, end: prevEnd }
}

// ── HTML builder ───────────────────────────────────────────────────────────────

/** Escape user-controlled strings before interpolating into HTML */
function esc(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;')
}

/** Escape and preserve newlines as <br/> for multiline user content */
function escMultiline(str: string): string {
  return esc(str).replace(/\n/g, '<br/>')
}

function scoreBar(value: number, max = 10): string {
  const pct  = Math.round((value / max) * 100)
  const fill = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0;">
      <tr>
        <td width="${pct}%" style="background:${fill};height:6px;border-radius:3px 0 0 3px;"></td>
        <td width="${100 - pct}%" style="background:#e5e7eb;height:6px;border-radius:0 3px 3px 0;"></td>
      </tr>
    </table>`
}

export function buildReportHtml(data: ReportData): string {
  const {
    clientName, trainerName, periodLabel,
    sessions, goals, challenges, weeklyTarget,
    avgEnergyLevel, avgStressLevel, totalVolumeLbs,
    focusKpiLabel, trainerNote,
  } = data

  const completedGoals = goals.filter(g => g.achievedAt !== null)
  const activeGoals    = goals.filter(g => g.achievedAt === null)

  // Consistency
  const weeksInPeriod = Math.max(1, Math.round(
    (new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime())
    / (7 * 24 * 60 * 60 * 1000)
  ))
  const targetSessions  = weeksInPeriod * weeklyTarget
  const consistency     = Math.min(100, Math.round((sessions.length / targetSessions) * 100))
  const consistencyColor = consistency >= 80 ? '#10b981' : consistency >= 50 ? '#f59e0b' : '#ef4444'

  const sessionRows = sessions.slice(0, 8).map(s => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">
        ${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        ${s.name ? `— ${esc(s.name)}` : ''}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;text-align:right;">
        ${s.sets} sets · ${s.volumeLbs > 0 ? `${s.volumeLbs.toLocaleString()} lbs` : '—'}
      </td>
      ${s.energyLevel != null ? `
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;text-align:right;">
        ⚡ ${s.energyLevel}/10
      </td>` : '<td></td>'}
    </tr>`).join('')

  const goalRows = activeGoals.slice(0, 4).map(g => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#374151;">
        <span style="color:#6b7280;margin-right:8px;">→</span>${esc(g.goal)}
      </td>
    </tr>`).join('')

  const achievedRows = completedGoals.map(g => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#10b981;">
        <span style="margin-right:8px;">✓</span>${esc(g.goal)}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Monthly Training Report — ${esc(clientName)}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr>
      <td style="background:#111827;padding:32px 32px 24px;border-radius:12px 12px 0 0;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">
          Monthly Training Report
        </p>
        <h1 style="margin:0 0 4px;font-size:28px;font-weight:700;color:#ffffff;">
          ${esc(clientName)}
        </h1>
        <p style="margin:0;font-size:14px;color:#9ca3af;">${esc(periodLabel)}</p>
      </td>
    </tr>

    <!-- Highlights row -->
    <tr>
      <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Sessions -->
            <td style="text-align:center;padding:0 8px;" width="33%">
              <p style="margin:0;font-size:32px;font-weight:700;color:#111827;">${sessions.length}</p>
              <p style="margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Sessions</p>
              <p style="margin:2px 0 0;font-size:12px;color:${consistencyColor};">
                ${consistency}% of target
              </p>
            </td>
            <!-- Volume -->
            <td style="text-align:center;padding:0 8px;border-left:1px solid #f3f4f6;border-right:1px solid #f3f4f6;" width="33%">
              <p style="margin:0;font-size:32px;font-weight:700;color:#111827;">
                ${totalVolumeLbs != null ? Math.round(totalVolumeLbs / 1000) + 'k' : '—'}
              </p>
              <p style="margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Volume (lbs)</p>
            </td>
            <!-- Goals achieved -->
            <td style="text-align:center;padding:0 8px;" width="33%">
              <p style="margin:0;font-size:32px;font-weight:700;color:${completedGoals.length > 0 ? '#10b981' : '#111827'};">
                ${completedGoals.length}
              </p>
              <p style="margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Goals Achieved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${focusKpiLabel ? `
    <!-- Performance -->
    <tr>
      <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">Performance</p>
        <p style="margin:0;font-size:15px;color:#374151;">${focusKpiLabel != null ? esc(focusKpiLabel) : ''}</p>
      </td>
    </tr>` : ''}

    <!-- Sessions table -->
    ${sessions.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 16px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">Sessions</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;">
          ${sessionRows}
          ${sessions.length > 8 ? `
          <tr><td colspan="3" style="padding:8px 12px;font-size:12px;color:#9ca3af;text-align:center;">
            + ${sessions.length - 8} more sessions
          </td></tr>` : ''}
        </table>
      </td>
    </tr>` : ''}

    <!-- How you felt -->
    ${(avgEnergyLevel != null || avgStressLevel != null) ? `
    <tr>
      <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 16px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">How You Felt</p>
        ${avgEnergyLevel != null ? `
        <p style="margin:0 0 4px;font-size:13px;color:#374151;">Energy <span style="color:#6b7280;">${avgEnergyLevel}/10</span></p>
        ${scoreBar(avgEnergyLevel)}` : ''}
        ${avgStressLevel != null ? `
        <p style="margin:12px 0 4px;font-size:13px;color:#374151;">Stress <span style="color:#6b7280;">${avgStressLevel}/10</span></p>
        ${scoreBar(10 - avgStressLevel)}` : ''}
      </td>
    </tr>` : ''}

    <!-- Goals achieved this month -->
    ${completedGoals.length > 0 ? `
    <tr>
      <td style="background:#f0fdf4;padding:24px 32px;border-bottom:1px solid #f3f4f6;border-left:4px solid #10b981;">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#059669;">Achieved This Month</p>
        <table width="100%" cellpadding="0" cellspacing="0">${achievedRows}</table>
      </td>
    </tr>` : ''}

    <!-- Looking ahead -->
    ${activeGoals.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">Looking Ahead</p>
        <table width="100%" cellpadding="0" cellspacing="0">${goalRows}</table>
      </td>
    </tr>` : ''}

    <!-- Challenges -->
    ${challenges.length > 0 ? `
    <tr>
      <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #f3f4f6;">
        <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;">Challenges</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${challenges.map(c => {
            const pct = c.targetValue > 0 ? Math.min(100, Math.round((c.currentValue / c.targetValue) * 100)) : 0
            const statusColor = c.status === 'completed' ? '#10b981' : c.status === 'expired' ? '#f59e0b' : '#3b82f6'
            const statusLabel = c.status === 'completed' ? '✓ Completed' : c.status === 'expired' ? 'Expired' : `${pct}%`
            return `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
              <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:600;">${esc(c.title)}</p>
              <div style="background:#e5e7eb;border-radius:4px;height:6px;margin-bottom:4px;">
                <div style="background:${statusColor};border-radius:4px;height:6px;width:${pct}%;"></div>
              </div>
              <p style="margin:0;font-size:11px;color:#6b7280;">
                ${c.currentValue}${c.targetUnit ? ' ' + esc(c.targetUnit) : ''} / ${c.targetValue}${c.targetUnit ? ' ' + esc(c.targetUnit) : ''}
                <span style="margin-left:8px;color:${statusColor};font-weight:600;">${statusLabel}</span>
              </p>
            </td>
          </tr>`
          }).join('')}
        </table>
      </td>
    </tr>` : ''}

    <!-- Trainer note -->
    ${trainerNote ? `
    <tr>
      <td style="background:#fffbeb;padding:24px 32px;border-bottom:1px solid #f3f4f6;border-left:4px solid #f59e0b;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#d97706;">A Note From ${esc(trainerName)}</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${escMultiline(trainerNote)}</p>
      </td>
    </tr>` : ''}

    <!-- Footer -->
    <tr>
      <td style="background:#111827;padding:24px 32px;border-radius:0 0 12px 12px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">Prepared by ${esc(trainerName)}</p>
        <p style="margin:0;font-size:12px;color:#6b7280;">Keep showing up. The work compounds.</p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`
}

// ── Send function ──────────────────────────────────────────────────────────────

export async function sendReport(data: ReportData): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')

  const fromEmail = process.env.REPORT_FROM_EMAIL ?? 'reports@trainerapp.io'
  const resend    = new Resend(apiKey)

  const subject = `Your ${data.periodLabel} Training Report`

  const { data: result, error } = await resend.emails.send({
    from:    `${data.trainerName} via TrainerApp <${fromEmail}>`,
    to:      data.clientEmail,
    reply_to: data.trainerEmail,
    subject,
    html:    buildReportHtml(data),
  })

  if (error || !result) {
    throw new Error(error?.message ?? 'Failed to send report via Resend')
  }

  return { id: result.id }
}

// ── buildReportData — exported for use by workers ─────────────────────────────

import { db, clients, sessions, trainers, clientGoals, challenges } from '../db'
import { eq, and, desc } from 'drizzle-orm'

export async function buildReportData(
  clientId:    string,
  trainerId:   string,
  trainerNote: string | null,
): Promise<{ data: ReportData; periodLabel: string; periodStart: Date; periodEnd: Date } | null> {

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.trainerId, trainerId)),
  })
  if (!client) return null

  const trainer = await db.query.trainers.findFirst({
    where: eq(trainers.id, trainerId),
    columns: { id: true, name: true, email: true },
  })
  if (!trainer) return null

  const allSessions = await db.query.sessions.findMany({
    where: and(eq(sessions.clientId, clientId), eq(sessions.status, 'completed')),
    with: {
      workouts: {
        with: {
          sessionExercises: {
            with: { sets: true },
          },
        },
      },
    },
    orderBy: desc(sessions.date),
  })

  const period = resolveReportPeriod(allSessions)

  const periodSessions = allSessions.filter(s => {
    const d = new Date(s.date + 'T00:00:00')
    return d >= period.start && d <= period.end
  })

  const reportSessions = periodSessions.map(s => {
    const sets = s.workouts.reduce(
      (a, w) => a + w.sessionExercises.reduce((b, se) => b + se.sets.length, 0), 0
    )
    const volumeLbs = s.workouts.reduce(
      (a, w) => a + w.sessionExercises.reduce(
        (b, se) => b + se.sets.reduce((c, set) => c + ((set.weight ?? 0) * (set.reps ?? 0)), 0), 0
      ), 0
    )
    return {
      date:        s.date,
      name:        s.name,
      sets,
      volumeLbs:   Math.round(volumeLbs),
      energyLevel: s.energyLevel,
    }
  })

  const goals = await db.query.clientGoals.findMany({
    where: eq(clientGoals.clientId, clientId),
  }).catch(() => [])

  // v2.12.0: fetch challenges for report
  const clientChallenges = await db.query.challenges.findMany({
    where: eq(challenges.clientId, clientId),
  }).catch(() => [])

  const reportChallenges: ReportChallenge[] = clientChallenges
    .filter(c => c.status === 'active' || c.status === 'completed')
    .map(c => ({
      title:        c.title,
      currentValue: c.currentValue,
      targetValue:  c.targetValue,
      targetUnit:   c.targetUnit,
      status:       c.status,
      deadline:     c.deadline,
    }))

  const energyScores = periodSessions.map(s => s.energyLevel).filter((e): e is number => e != null)
  const stressScores = periodSessions.map(s => s.stressLevel).filter((e): e is number => e != null)
  const avg = (arr: number[]) => arr.length > 0
    ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
    : null

  const totalVol = reportSessions.reduce((a, s) => a + s.volumeLbs, 0)

  const data: ReportData = {
    clientName:     client.name,
    clientEmail:    client.email ?? '',
    trainerName:    trainer.name,
    trainerEmail:   trainer.email,
    periodLabel:    period.label,
    periodStart:    period.start.toISOString().split('T')[0] ?? '',
    periodEnd:      period.end.toISOString().split('T')[0] ?? '',
    sessions:       reportSessions,
    goals:          goals.map(g => ({ goal: g.goal, achievedAt: g.achievedAt?.toISOString() ?? null })),
    challenges:     reportChallenges,
    weeklyTarget:   client.weeklySessionTarget,
    avgEnergyLevel: avg(energyScores),
    avgStressLevel: avg(stressScores),
    totalVolumeLbs: totalVol > 0 ? totalVol : null,
    focusKpiLabel:  null,
    trainerNote:    trainerNote ?? null,
  }

  return { data, periodLabel: period.label, periodStart: period.start, periodEnd: period.end }
}
