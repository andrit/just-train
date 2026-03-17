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
import { db, clients, sessions, trainers, clientGoals } from '../db'
import { eq, and, desc, sql }   from 'drizzle-orm'
import {
  UuidParamSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'
import { z }                   from 'zod'
import {
  buildReportHtml,
  sendReport,
  resolveReportPeriod,
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

  // ── Shared: build ReportData from DB ──────────────────────────────────────

  async function buildReportData(
    clientId:    string,
    trainerId:   string,
    trainerNote: string | null,
  ): Promise<{ data: ReportData; periodLabel: string; periodStart: Date; periodEnd: Date } | null> {

    const client = await db.query.clients.findFirst({
      where: and(eq(clients.id, clientId), eq(clients.trainerId, trainerId)),
    })
    if (!client) return null

    const trainer = await db.query.trainers.findFirst({
      where: eq(trainers.id, trainerId),
      columns: { id: true, name: true, email: true },
    })
    if (!trainer) return null

    // Load all completed sessions with workout tree
    const allSessions = await db.query.sessions.findMany({
      where: and(eq(sessions.clientId, clientId), eq(sessions.status, 'completed')),
      with: {
        workouts: {
          with: {
            sessionExercises: {
              with: { sets: true },
            },
          },
        },
      },
      orderBy: desc(sessions.date),
    })

    // Resolve date period
    const period = resolveReportPeriod(allSessions)

    // Filter to period
    const periodSessions = allSessions.filter(s => {
      const d = new Date(s.date + 'T00:00:00')
      return d >= period.start && d <= period.end
    })

    // Build session summaries
    const reportSessions = periodSessions.map(s => {
      const sets = s.workouts.reduce(
        (a, w) => a + w.sessionExercises.reduce((b, se) => b + se.sets.length, 0), 0
      )
      const volumeLbs = s.workouts.reduce(
        (a, w) => a + w.sessionExercises.reduce(
          (b, se) => b + se.sets.reduce((c, set) => c + ((set.weight ?? 0) * (set.reps ?? 0)), 0), 0
        ), 0
      )
      return {
        date:        s.date,
        name:        s.name,
        sets,
        volumeLbs:   Math.round(volumeLbs),
        energyLevel: s.energyLevel,
      }
    })

    // Load goals
    const goals = await db.query.clientGoals.findMany({
      where: eq(clientGoals.clientId, clientId),
    }).catch(() => [])

    // Compute period averages
    const energyScores = periodSessions.map(s => s.energyLevel).filter((e): e is number => e != null)
    const stressScores = periodSessions.map(s => s.stressLevel).filter((e): e is number => e != null)
    const avg = (arr: number[]) => arr.length > 0
      ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
      : null

    const totalVol = reportSessions.reduce((a, s) => a + s.volumeLbs, 0)

    const data: ReportData = {
      clientName:    client.name,
      clientEmail:   client.email ?? '',
      trainerName:   trainer.name,
      trainerEmail:  trainer.email,
      periodLabel:   period.label,
      periodStart:   period.start.toISOString().split('T')[0]!,
      periodEnd:     period.end.toISOString().split('T')[0]!,
      sessions:      reportSessions,
      goals:         goals.map(g => ({ goal: g.goal, achievedAt: g.achievedAt?.toISOString() ?? null })),
      weeklyTarget:  client.weeklySessionTarget,
      avgEnergyLevel: avg(energyScores),
      avgStressLevel: avg(stressScores),
      totalVolumeLbs: totalVol > 0 ? totalVol : null,
      focusKpiLabel:  null,  // Future: wire to KPI service
      trainerNote:   trainerNote ?? null,
    }

    return { data, periodLabel: period.label, periodStart: period.start, periodEnd: period.end }
  }

  // ── GET /clients/:id/report-preview ──────────────────────────────────────

  app.get('/clients/:id/report-preview', {
    schema: {
      tags:     ['Reports'],
      security: [{ bearerAuth: [] }],
      summary:  'Preview the monthly report HTML',
      description: 'Builds and returns the report HTML without sending. Used by the preview modal.',
      params: UuidParamSchema,
      querystring: z.object({
        trainerNote: z.string().max(1000).optional(),
      }),
      response: {
        200: ReportPreviewResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: clientId } = request.params as z.infer<typeof UuidParamSchema>
    const { trainerNote }  = request.query as { trainerNote?: string }

    try {
      const result = await buildReportData(clientId, request.trainer.trainerId, trainerNote ?? null)
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

      // Increment reportsSentCount
      await db.update(trainers)
        .set({
          reportsSentCount: sql`${trainers.reportsSentCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(trainers.id, request.trainer.trainerId))

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
