// ------------------------------------------------------------
// lib/sentry.ts — the one place the backend touches @sentry/node
//
// Every helper is a no-op until initSentry() ran with a DSN, so callers never
// branch on whether monitoring is configured. Two things reach Sentry:
//
//   1. Errors — routeLog(app).error(err) forwards Error instances here, which
//      covers every route's `catch (error) { routeLog(app).error(error); 500 }`
//      block without touching a single route. Uncaught errors (validation,
//      plugin failures) go through Sentry's Fastify error handler.
//   2. Cron check-ins — the hourly scheduler tick is wrapped in a monitor so a
//      dead BullMQ worker becomes an alert instead of silence.
// ------------------------------------------------------------

import * as Sentry from '@sentry/node'
import type { FastifyInstance } from 'fastify'

let enabled = false

export function isSentryEnabled(): boolean {
  return enabled
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment:      process.env.NODE_ENV ?? 'development',
    // Railway injects the deployed commit; ties an event to the code that produced it.
    release:          process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0.05,
    // Matches the privacy policy: no IP addresses, no request bodies, no cookies.
    // sendDefaultPii=false is the SDK default; pinned so an upgrade can't flip it.
    // beforeSend drops the request body/cookies/query outright — a body is training
    // data or credentials, never something an error report needs.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        delete event.request.query_string
        if (event.request.url) event.request.url = event.request.url.split('?')[0]
      }
      return event
    },
  })
  enabled = true
}

/** Uncaught route errors (5xx only — Sentry's handler ignores 4xx). */
export function attachSentryErrorHandler(app: FastifyInstance): void {
  if (!enabled) return
  Sentry.setupFastifyErrorHandler(app)
}

/**
 * Forward a caught error. `context` is the free-text second argument routes
 * already pass to routeLog — kept as an extra, not a message, so grouping
 * stays by stack trace.
 */
export function captureError(error: unknown, context?: string): void {
  if (!enabled || !(error instanceof Error)) return
  Sentry.captureException(error, context ? { extra: { context } } : undefined)
}

/** Tag the request's isolation scope with the authenticated trainer. */
export function setSentryUser(trainerId: string): void {
  if (!enabled) return
  Sentry.setUser({ id: trainerId })
}

/**
 * Run a scheduled job under a cron monitor. Sentry alerts if the check-in is
 * missed (worker dead), late, or the job throws. `schedule` is the crontab
 * the job is registered with — keep the two in sync.
 */
export async function withCronMonitor<T>(
  slug: string,
  schedule: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled) return fn()
  return Sentry.withMonitor(slug, fn, {
    schedule:      { type: 'crontab', value: schedule },
    checkinMargin: 10,   // minutes late before it counts as missed
    maxRuntime:    15,   // minutes before an in-progress run counts as failed
    timezone:      'UTC',
  })
}
