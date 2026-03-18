// ------------------------------------------------------------
// queues/workers.ts — BullMQ job workers (v1.7.5)
//
// REPORT WORKER:
//   Receives a { clientId, trainerId } job.
//   Builds and sends the monthly report using the same
//   buildReportData + sendReport pipeline as the manual send.
//   Updates client.lastReportSentAt and trainer.reportsSentCount.
//
// AT-RISK ALERT WORKER:
//   Receives a { trainerId } job.
//   Finds all active clients for the trainer who haven't trained
//   in 14+ days. Sends a single digest email if any are found.
//   Skips if the trainer has no at-risk clients.
//
// TONE: alerts always use neutral/clinical copy regardless of
//   trainer.alertTone preference (decision locked in v1.7.5).
// ------------------------------------------------------------

import { Worker }            from 'bullmq'
import { getRedisConnection } from './connection'
import {
  QUEUE_NAMES,
  type ScheduledReportJobData,
  type AtRiskAlertJobData,
} from './index'
import { db, clients, sessions, trainers } from '../db'
import { eq, and, desc }     from 'drizzle-orm'
import { sql }               from 'drizzle-orm'
import { buildReportData, sendReport } from '../services/report.service'
import { sendAtRiskDigest }  from '../services/alert.service'

// ── Report worker ──────────────────────────────────────────────────────────────

export function startReportWorker(): Worker {
  const worker = new Worker<ScheduledReportJobData>(
    QUEUE_NAMES.REPORTS,
    async (job) => {
      const { clientId, trainerId } = job.data
      console.log(`[ReportWorker] Processing report for client ${clientId}`)

      const result = await buildReportData(clientId, trainerId, null)
      if (!result) {
        console.warn(`[ReportWorker] Client ${clientId} not found — skipping`)
        return
      }

      if (!result.data.clientEmail) {
        console.warn(`[ReportWorker] Client ${clientId} has no email — skipping`)
        return
      }

      if (result.data.sessions.length === 0) {
        console.warn(`[ReportWorker] No sessions for client ${clientId} in period — skipping`)
        return
      }

      await sendReport(result.data)

      // Update lastReportSentAt + reportsSentCount
      await Promise.all([
        db.update(clients)
          .set({ lastReportSentAt: new Date(), updatedAt: new Date() })
          .where(eq(clients.id, clientId)),
        db.update(trainers)
          .set({ reportsSentCount: sql`${trainers.reportsSentCount} + 1`, updatedAt: new Date() })
          .where(eq(trainers.id, trainerId)),
      ])

      console.log(`[ReportWorker] Report sent for client ${clientId}`)
    },
    { connection: getRedisConnection(), concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[ReportWorker] Job ${job?.id} failed:`, err.message)
  })

  return worker
}

// ── At-risk alert worker ───────────────────────────────────────────────────────

const AT_RISK_DAYS = 14

export function startAlertWorker(): Worker {
  const worker = new Worker<AtRiskAlertJobData>(
    QUEUE_NAMES.ALERTS,
    async (job) => {
      const { trainerId } = job.data

      // Load trainer
      const trainer = await db.query.trainers.findFirst({
        where: eq(trainers.id, trainerId),
        columns: { id: true, name: true, email: true, alertColorScheme: true },
      })
      if (!trainer) return

      // Load all active clients for this trainer
      const activeClients = await db.query.clients.findMany({
        where: and(
          eq(clients.trainerId, trainerId),
          eq(clients.active,    true),
          eq(clients.isSelf,    false),
        ),
        columns: { id: true, name: true, lastActiveAt: true },
      })

      if (activeClients.length === 0) return

      // Filter to at-risk: 14+ days since last session
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - AT_RISK_DAYS)

      const atRisk = activeClients.filter(c => {
        if (!c.lastActiveAt) return true                              // Never trained
        return new Date(c.lastActiveAt) < cutoff
      })

      if (atRisk.length === 0) {
        console.log(`[AlertWorker] No at-risk clients for trainer ${trainerId}`)
        return
      }

      // Send digest
      await sendAtRiskDigest({
        trainerName:  trainer.name,
        trainerEmail: trainer.email,
        atRiskClients: atRisk.map(c => ({
          name:         c.name,
          daysSinceLast: c.lastActiveAt
            ? Math.floor((Date.now() - new Date(c.lastActiveAt).getTime()) / 86400000)
            : null,
        })),
      })

      console.log(`[AlertWorker] At-risk digest sent to ${trainer.email} — ${atRisk.length} clients`)
    },
    { connection: getRedisConnection(), concurrency: 5 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[AlertWorker] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
