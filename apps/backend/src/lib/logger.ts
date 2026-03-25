// ------------------------------------------------------------
// src/lib/logger.ts
//
// Typed wrapper around Fastify's pino logger.
//
// WHY THIS EXISTS:
//   Fastify's FastifyInstance.log type doesn't always expose
//   .error() with the right overloads for (error, message) calls.
//   Rather than cast `(app.log as any)` in every catch block
//   (which triggers @typescript-eslint/no-explicit-any), we
//   extract a typed logger reference once here.
//
// USAGE:
//   import { getLogger } from '../lib/logger'
//   const log = getLogger(app)
//   ...
//   } catch (error) {
//     log.error(error, 'Failed to fetch sessions')
//   }
// ------------------------------------------------------------

import type { FastifyInstance, FastifyBaseLogger } from 'fastify'

export function getLogger(app: FastifyInstance): FastifyBaseLogger {
  return app.log
}
