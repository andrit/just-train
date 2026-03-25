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
//   const log = routeLog(app)
//   log.error('something went wrong')
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'

interface RouteLogger {
  error(msg: unknown): void
  warn(msg: unknown):  void
  info(msg: unknown):  void
}

export function routeLog(app: FastifyInstance): RouteLogger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const log = app.log as any
  return {
    error: (msg) => log.error(msg instanceof Error ? msg.message : msg),
    warn:  (msg) => log.warn(msg  instanceof Error ? msg.message : msg),
    info:  (msg) => log.info(msg  instanceof Error ? msg.message : msg),
  }
}
