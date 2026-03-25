// ------------------------------------------------------------
// src/lib/logger.ts
//
// Typed error logging helper for Fastify routes.
//
// WHY THIS EXISTS:
//   FastifyBaseLogger doesn't expose .error() in a way TypeScript
//   accepts when passing an Error object directly. This helper
//   casts once here so every catch block stays clean.
//
// USAGE:
//   import { logError } from '../lib/logger'
//   } catch (error) {
//     logError(app, error)
//   }
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'

export function logError(app: FastifyInstance, error: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(app.log as any).error(error)
}
