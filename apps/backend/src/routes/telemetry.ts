import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/telemetry.ts — first-party product events
//
//   POST /api/v1/telemetry → accept a batch of client events (≤ 50)
//
// Fire-and-forget from the client's point of view: the app batches and sends
// aggregates; a failure here must never affect a user action, which is why
// the client sends after the fact and ignores the result. Ownership is the
// JWT — a trainer can only ever write events for themselves.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { createTelemetrySink, type TelemetrySink } from '../lib/telemetry/sink'
import {
  ClientEventBatchSchema,
  TelemetryAcceptedResponseSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'
import type { z } from 'zod'

export interface TelemetryRouteOptions {
  /** Injected for tests; defaults to the configured sink. */
  sink?: TelemetrySink
}

export async function telemetryRoutes(app: FastifyInstance, opts: TelemetryRouteOptions = {}): Promise<void> {
  app.addHook('preHandler', authenticate)
  const sink = opts.sink ?? createTelemetrySink()

  app.post('/telemetry', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: {
      tags: ['Telemetry'],
      security: [{ bearerAuth: [] }],
      summary: 'Record a batch of product events',
      description: 'First-party usage counters (offline cache hits, queue flushes, sessions completed). Aggregates, not a firehose. Stored in the product database — no third-party analytics.',
      body: ClientEventBatchSchema,
      response: {
        202: TelemetryAcceptedResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof ClientEventBatchSchema>
    try {
      const accepted = await sink.record(request.trainer.trainerId, body.events)
      return reply.status(202).send({ accepted })
    } catch (error) {
      ;routeLog(app).error(error, 'telemetry:record')
      return reply.status(500).send({ error: 'Failed to record events' })
    }
  })
}
