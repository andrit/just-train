// ------------------------------------------------------------
// lib/errorHandler.ts — one error shape for the Zod pipeline
//
// fastify-type-provider-zod (5.x) raises typed errors for the two places Zod
// runs on every request: request validation and response serialisation.
// Without a handler Fastify's default 400 puts the raw issue list into
// `message`, and the frontend reads `error` (→ "Bad Request"). This maps
// both into ErrorResponseSchema so clients and tests see a stable shape:
//
//   400 { error: 'Validation failed',        code: 'VALIDATION',        details: issue[] }
//   500 { error: 'Response failed validation', code: 'RESPONSE_SCHEMA', details? }
//
// `details` on the 500 is withheld in production: it names our own response
// fields, which is exactly what the real-database lane needs to see and
// exactly what a stranger should not. Everything else falls through to
// Fastify's default handling (Sentry's handler is a separate hook and still
// sees the error first).
// ------------------------------------------------------------

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod'

export interface ValidationIssue {
  path:    string
  message: string
  code?:   string
}

/** Flatten the provider's validation entries to what a form can use. */
export function validationIssues(error: FastifyError): ValidationIssue[] {
  const entries = (error.validation ?? []) as Array<{
    instancePath?: string
    message?:      string
    params?:       { issue?: { path?: (string | number)[]; message?: string; code?: string } }
  }>
  return entries.map((v) => {
    const issue = v.params?.issue
    const path  = issue?.path?.length ? issue.path.join('.') : (v.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.')
    return { path, message: issue?.message ?? v.message ?? 'Invalid value', ...(issue?.code ? { code: issue.code } : {}) }
  })
}

export function attachErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error:   'Validation failed',
        code:    'VALIDATION',
        details: validationIssues(error),
      })
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, url: request.url }, 'Response failed its schema')
      return reply.status(500).send({
        error: 'Response failed validation',
        code:  'RESPONSE_SCHEMA',
        ...(process.env.NODE_ENV !== 'production'
          ? { details: (error as { cause?: { issues?: unknown } }).cause?.issues ?? error.message }
          : {}),
      })
    }

    // Not ours: keep Fastify's behaviour (status from the error, or 500).
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    if (status >= 500) request.log.error({ err: error, url: request.url }, 'Unhandled error')
    return reply.status(status).send({
      error: status >= 500 ? 'Internal Server Error' : error.message,
      ...(error.code ? { code: error.code } : {}),
    })
  })
}
