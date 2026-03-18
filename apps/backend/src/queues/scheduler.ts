// ------------------------------------------------------------
// queues/scheduler.ts — Cron job definitions (v1.7.5)
//
// SCHEDULE STRATEGY:
//   Rather than one cron job per trainer (bloats Redis), we run
//   hourly fanouts and filter trainers whose local time is 08:00.
//   This works for any timezone without creating dynamic cron jobs.
//
//   Report fanout:    every hour on the 1st of the month
//   Alert fanout:     every hour, every day
//
// TIMEZONE CHECK:
//   Uses Intl.DateTimeFormat to get the trainer's local hour.
//   If localHour === 8, the trainer's jobs are enqueued.
// ------------------------------------------------------------

import { Queue, Worker }     from 'bullmq'
import { getRedisConnection } from './connection'
import {
  getReportsQueue,
  getAlertsQueue,
  type ScheduledReportJobData,
  type AtRiskAlertJobData,
} from './index'
import { db, clients, trainers } from '../db'
import { eq, and, isNotNull, lte } from 'drizzle-orm'

const SCHEDULER_QUEUE = 'scheduler'

// ── Timezone helper ────────────────────────────────────────────────────────────

function localHour(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    // Invalid timezone — fall back to UTC
    return new Date().getUTCHours()
  }
}

function isFirstOfMonth(timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      day: 'numeric',
    })
    return formatter.format(new Date()) === '1'
  } catch {
    return new Date().getUTCDate() === 1
  }
}

// ── Scheduler startup ──────────────────────────────────────────────────────────

export async function startScheduler(): Promise<void> {
  const schedulerQueue = new Queue(SCHEDULER_QUEUE, { connection: getRedisConnection() })

  // Reports: every hour on the 1st (filters by timezone inside the job)
  await schedulerQueue.upsertJobScheduler(
    'report-fanout-hourly',
    { pattern: '0 * 1 * *' },
    { name: 'report-fanout', data: {} },
  )

  // Alerts: every hour every day
  await schedulerQueue.upsertJobScheduler(
    'alert-fanout-hourly',
    { pattern: '0 * * * *' },
    { name: 'alert-fanout', data: {} },
  )

  new Worker(SCHEDULER_QUEUE, async (job) => {
    if (job.name === 'report-fanout') await fanOutScheduledReports()
    if (job.name === 'alert-fanout')  await fanOutAtRiskAlerts()
  }, { connection: getRedisConnection() })

  console.log('[Scheduler] Started — reports (hourly on 1st), alerts (hourly)')
}

// ── Fan-out: scheduled reports ─────────────────────────────────────────────────

async function fanOutScheduledReports(): Promise<void> {
  // Find all eligible trainers with autoReportEnabled
  const eligibleTrainers = await db.query.trainers.findMany({
    where:   eq(trainers.autoReportEnabled, true),
    columns: { id: true, timezone: true },
  })

  // Filter to trainers where it's currently 08:00 local and the 1st of their month
  const ready = eligibleTrainers.filter(t =>
    localHour(t.timezone) === 8 && isFirstOfMonth(t.timezone)
  )

  if (ready.length === 0) return

  const reportsQueue = getReportsQueue()
  let enqueued = 0

  for (const trainer of ready) {
    // Find their clients with autoReport=true and an email
    const eligibleClients = await db.query.clients.findMany({
      where: and(
        eq(clients.trainerId,  trainer.id),
        eq(clients.autoReport, true),
        eq(clients.active,     true),
        isNotNull(clients.email),
      ),
      columns: { id: true },
    })

    if (eligibleClients.length === 0) continue

    const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM

    await reportsQueue.addBulk(
      eligibleClients.map(c => ({
        name: 'scheduled-report',
        data: { clientId: c.id, trainerId: trainer.id } satisfies ScheduledReportJobData,
        opts: {
          // Deduplicate — same client only gets one report per month
          jobId: `scheduled-report-${c.id}-${monthKey}`,
        },
      }))
    )
    enqueued += eligibleClients.length
  }

  console.log(`[Scheduler] Enqueued ${enqueued} scheduled report jobs`)
}

// ── Fan-out: at-risk alerts ────────────────────────────────────────────────────

async function fanOutAtRiskAlerts(): Promise<void> {
  // Find trainers with alerts enabled whose local time is 08:00
  const alertTrainers = await db.query.trainers.findMany({
    where:   eq(trainers.alertsEnabled, true),
    columns: { id: true, timezone: true },
  })

  const ready = alertTrainers.filter(t => localHour(t.timezone) === 8)
  if (ready.length === 0) return

  const alertsQueue  = getAlertsQueue()
  const today        = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  await alertsQueue.addBulk(
    ready.map(t => ({
      name: 'at-risk-alert',
      data: { trainerId: t.id } satisfies AtRiskAlertJobData,
      opts: {
        // One alert per trainer per day
        jobId: `at-risk-alert-${t.id}-${today}`,
      },
    }))
  )

  console.log(`[Scheduler] Enqueued ${ready.length} at-risk alert jobs`)
}
