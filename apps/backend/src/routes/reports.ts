// ------------------------------------------------------------
// routes/reports.ts — Monthly report generation (v1.7.0)
//
// Routes:
//   GET  /clients/:id/report-preview  → build + return HTML (no send)
//   POST /clients/:id/report          → build + send via Resend
//
// The preview endpoint is called by the frontend modal.
// The send endpoint is called when trainer confirms.
//
// Both endpoints accept an optional trainerNote in the body.
// The POST also increments trainer.reportsSentCount.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { authenticate }        from '../middleware/authenticate'
import { db, clients, trainers } from '../db'
import { eq, and, sql }          from 'drizzle-orm'
import {
  UuidParamSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'
import { z }                   from 'zod'
import {
  buildReportHtml,
  sendReport,
  resolveReportPeriod,
  buildReportData,
  type ReportData,
} from '../services/report.service'

const ReportBodySchema = z.object({
  trainerNote: z.string().max(1000).optional()
    .describe('Optional personal note from the trainer'),
})

const ReportPreviewResponseSchema = z.object({
  html:        z.string(),
  periodLabel: z.string(),
  periodStart: z.string(),
  periodEnd:   z.string(),
  sessionCount: z.number().int(),
  clientEmail: z.string().nullable(),
})

const ReportSentResponseSchema = z.object({
  message:     z.string(),
  emailId:     z.string(),
  periodLabel: z.string(),
})

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)


  // ── GET /clients/:id/report-preview ──────────────────────────────────────

  app.get('/clients/:id/report-preview', {
    schema: {
      tags:     ['Reports'],
      security: [{ bearerAuth: [] }],
      summary:  'Preview the monthly report HTML',
      description: 'Builds and returns the report HTML without sending. Trainer note is rendered client-side.',
      params: UuidParamSchema,
      response: {
        200: ReportPreviewResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: clientId } = request.params as z.infer<typeof UuidParamSchema>
    try {
      const result = await buildReportData(clientId, request.trainer.trainerId, null)
      if (!result) return reply.status(404).send({ error: 'Client not found' })

      const html = buildReportHtml(result.data)

      return reply.send({
        html,
        periodLabel:  result.periodLabel,
        periodStart:  result.data.periodStart,
        periodEnd:    result.data.periodEnd,
        sessionCount: result.data.sessions.length,
        clientEmail:  result.data.clientEmail || null,
      })
    } catch (error) {
      ;(app.log as any).error(error)
      return reply.status(500).send({ error: 'Failed to generate report preview' })
    }
  })

  // ── POST /clients/:id/report ──────────────────────────────────────────────

  app.post('/clients/:id/report', {
    schema: {
      tags:     ['Reports'],
      security: [{ bearerAuth: [] }],
      summary:  'Send the monthly report to the client',
      params:   UuidParamSchema,
      body:     ReportBodySchema,
      response: {
        200: ReportSentResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: clientId } = request.params as z.infer<typeof UuidParamSchema>
    const { trainerNote }  = request.body as z.infer<typeof ReportBodySchema>

    try {
      const result = await buildReportData(clientId, request.trainer.trainerId, trainerNote ?? null)
      if (!result) return reply.status(404).send({ error: 'Client not found' })

      // Block send if client has no email
      if (!result.data.clientEmail) {
        return reply.status(400).send({ error: 'CLIENT_NO_EMAIL' })
      }

      // Block send if no sessions in period
      if (result.data.sessions.length === 0) {
        return reply.status(400).send({ error: 'NO_SESSIONS_IN_PERIOD' })
      }

      // Send via Resend
      const { id: emailId } = await sendReport(result.data)

      // Update client lastReportSentAt + trainer reportsSentCount in parallel
      await Promise.all([
        db.update(clients)
          .set({ lastReportSentAt: new Date(), updatedAt: new Date() })
          .where(eq(clients.id, clientId)),
        db.update(trainers)
          .set({ reportsSentCount: sql`${trainers.reportsSentCount} + 1`, updatedAt: new Date() })
          .where(eq(trainers.id, request.trainer.trainerId)),
      ])

      return reply.send({
        message:     `Report sent to ${result.data.clientEmail}`,
        emailId,
        periodLabel: result.periodLabel,
      })
    } catch (error) {
      ;(app.log as any).error(error)
      return reply.status(500).send({ error: 'Failed to send report' })
    }
  })
}
