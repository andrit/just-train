// ------------------------------------------------------------
// queues/index.ts — Queue definitions (v1.7.5)
//
// All queues are defined here. Workers are started separately
// in workers.ts so they can be conditionally loaded.
//
// JOB TYPES:
//   SCHEDULED_REPORT  — sends monthly report to a single client
//   AT_RISK_ALERT     — sends at-risk digest to a trainer
// ------------------------------------------------------------

import { Queue } from 'bullmq'
import { getRedisConnection } from './connection'

// ── Queue names ───────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  REPORTS: 'reports',
  ALERTS:  'alerts',
} as const

// ── Job data types ─────────────────────────────────────────────────────────────

export interface ScheduledReportJobData {
  clientId:  string
  trainerId: string
}

export interface AtRiskAlertJobData {
  trainerId: string
}

// ── Queue instances ────────────────────────────────────────────────────────────

export function getReportsQueue(): Queue<ScheduledReportJobData> {
  return new Queue<ScheduledReportJobData>(QUEUE_NAMES.REPORTS, {
    connection:       getRedisConnection(),
    defaultJobOptions: {
      attempts:     3,
      backoff:      { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50 },
    },
  })
}

export function getAlertsQueue(): Queue<AtRiskAlertJobData> {
  return new Queue<AtRiskAlertJobData>(QUEUE_NAMES.ALERTS, {
    connection:       getRedisConnection(),
    defaultJobOptions: {
      attempts:     3,
      backoff:      { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 50 },
    },
  })
}
