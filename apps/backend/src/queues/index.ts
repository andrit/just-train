// ------------------------------------------------------------
// queues/index.ts — Queue definitions (v1.7.5)
// ------------------------------------------------------------

import { Queue } from 'bullmq'
import { getRedisConnection } from './connection'

export const QUEUE_NAMES = {
  REPORTS: 'reports',
  ALERTS:  'alerts',
} as const

export interface ScheduledReportJobData {
  clientId:  string
  trainerId: string
}

export interface AtRiskAlertJobData {
  trainerId: string
}

const defaultJobOptions = {
  attempts:         3,
  backoff:          { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail:     { count: 50  },
}

export function getReportsQueue(): Queue {
  return new Queue(QUEUE_NAMES.REPORTS, {
    connection:        getRedisConnection(),
    defaultJobOptions,
  })
}

export function getAlertsQueue(): Queue {
  return new Queue(QUEUE_NAMES.ALERTS, {
    connection:        getRedisConnection(),
    defaultJobOptions,
  })
}
