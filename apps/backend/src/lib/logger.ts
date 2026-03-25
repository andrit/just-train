// ------------------------------------------------------------
// src/lib/logger.ts
//
// Route-level logging helpers for Fastify.
//
// WHY THIS EXISTS:
//   FastifyBaseLogger's TypeScript definition doesn't expose
//   .error() / .warn() / .info() directly — the methods live
//   on the underlying pino instance. Rather than scatter
//   `(app.log as any)` casts across every route file, we
//   centralise the cast here and export typed helpers.
//
// USAGE:
//   import { routeLog } from '../lib/logger'
//   routeLog(app).error(error)
//   routeLog(app).warn({ err }, 'seed failed')
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'

interface RouteLogger {
  error(msg: unknown, context?: string): void
  warn(msg: unknown, context?: string):  void
  info(msg: unknown, context?: string):  void
}

export function routeLog(app: FastifyInstance): RouteLogger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = app.log as any
  return {
    error: (msg, context) => context ? log.error(msg, context) : log.error(msg instanceof Error ? msg.message : msg),
    warn:  (msg, context) => context ? log.warn(msg, context)  : log.warn(msg  instanceof Error ? msg.message : msg),
    info:  (msg, context) => context ? log.info(msg, context)  : log.info(msg  instanceof Error ? msg.message : msg),
  }
}
