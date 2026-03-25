import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/kpis.ts — GET /clients/:id/kpis (v1.6.0)
//
// Computes all 8 KPI cards for a client.
// Called when the client profile opens — data is cached on the
// frontend via TanStack Query (5 min stale time).
//
// COMPUTATION STRATEGY:
//   - Loads all completed sessions for the client with full set data
//   - Computes metrics in memory (datasets are small per client)
//   - Single source of truth — same data used by reports (Phase 7.5)
//
// FOCUS-SPECIFIC KPI:
//   Uses client.primaryFocus to determine which metric to surface.
//   Falls back to 'insufficient_data' if fewer than 2 sessions exist.
//
// 1RM ESTIMATION:
//   Epley formula: weight × (1 + reps/30)
//   Only computed if client.show1rmEstimate = true.
//
// WEEK BOUNDARIES:
//   Weeks run Monday–Sunday (ISO week).
// ------------------------------------------------------------

import type { FastifyInstance }  from 'fastify'
import { authenticate }          from '../middleware/authenticate'
import { db, clients, sessions, workouts, sessionExercises, sets } from '../db'
import { eq, and, desc }         from 'drizzle-orm'
import {
  ClientKpiResponseSchema,
  UuidParamSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'
import { z } from 'zod'
import type { FocusKpi } from '@trainer-app/shared'

// ── Week helpers ──────────────────────────────────────────────────────────────

function isoWeek(date: Date): string {
  const d   = new Date(date)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function startOfCurrentMonth(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

// ── 1RM estimation (Epley) ────────────────────────────────────────────────────

function epley1rmKg(weightLbs: number, reps: number): number {
  const weightKg = weightLbs * 0.453592
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

type Trend = 'up' | 'down' | 'flat' | 'insufficient_data'

// ── Route ─────────────────────────────────────────────────────────────────────

export async function kpiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  app.get('/clients/:id/kpis', {
    schema: {
      tags:     ['KPIs'],
      security: [{ bearerAuth: [] }],
      summary:  'Get KPI cards for a client',
      params:   UuidParamSchema,
      response: {
        200: ClientKpiResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: clientId } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const client = await db.query.clients.findFirst({
        where: and(
          eq(clients.id, clientId),
          eq(clients.trainerId, request.trainer.trainerId),
        ),
      })
      if (!client) return reply.status(404).send({ error: 'Client not found' })

      // Load all completed sessions with full workout/set tree
      const allSessions = await db.query.sessions.findMany({
        where: and(
          eq(sessions.clientId, clientId),
          eq(sessions.status, 'completed'),
        ),
        with: {
          workouts: {
            with: {
              sessionExercises: {
                with: {
                  exercise: { columns: { name: true, workoutType: true } },
                  sets: true,
                },
              },
            },
          },
        },
        orderBy: desc(sessions.date),
      })

      const now        = new Date()
      const thisWeek   = isoWeek(now)
      const monthStart = startOfCurrentMonth()

      // ── Streak ───────────────────────────────────────────────────────────────
      const weekSet = new Set(
        allSessions.map(s => isoWeek(new Date(s.date + 'T00:00:00')))
      )

      let currentStreakWeeks = 0
      let bestStreakWeeks    = 0
      let run = 0
      const check = new Date(now)

      for (let w = 0; w < 520; w++) {
        const wk = isoWeek(check)
        if (weekSet.has(wk)) {
          run++
          bestStreakWeeks = Math.max(bestStreakWeeks, run)
          if (w === 0 || currentStreakWeeks > 0) currentStreakWeeks = run
        } else if (w > 0) {
          run = 0
          if (currentStreakWeeks === 0) break
        }
        check.setUTCDate(check.getUTCDate() - 7)
      }

      // ── This week ────────────────────────────────────────────────────────────
      const sessionsThisWeek = allSessions.filter(
        s => isoWeek(new Date(s.date + 'T00:00:00')) === thisWeek
      ).length

      // ── Last session ─────────────────────────────────────────────────────────
      const lastSession          = allSessions[0] ?? null
      const lastSessionDate      = lastSession?.date ?? null
      const daysSinceLastSession = lastSessionDate
        ? Math.floor((now.getTime() - new Date(lastSessionDate + 'T00:00:00').getTime()) / 86400000)
        : null

      // ── Focus KPI ─────────────────────────────────────────────────────────────
      type SetRow = {
        exerciseName: string
        workoutType:  string
        weight:       number | null
        reps:         number | null
        durationSeconds: number | null
        distance:     number | null
      }

      const recentSessions = allSessions.slice(0, 10)
      const recentSets: SetRow[] = recentSessions.flatMap(s =>
        s.workouts.flatMap(w =>
          w.sessionExercises.flatMap(se =>
            se.sets.map(set => ({
              exerciseName:    se.exercise?.name ?? 'Unknown',
              workoutType:     se.exercise?.workoutType ?? 'resistance',
              weight:          set.weight,
              reps:            set.reps,
              durationSeconds: set.durationSeconds,
              distance:        set.distance,
            }))
          )
        )
      )

      const calcVolumeTrend = (): Trend => {
        if (allSessions.length < 4) return 'insufficient_data'
        const vol = (ss: typeof allSessions) => ss.reduce(
          (acc, s) => acc + s.workouts.reduce(
            (a, w) => a + w.sessionExercises.reduce(
              (b, se) => b + se.sets.reduce(
                (c, set) => c + ((set.weight ?? 0) * (set.reps ?? 0)), 0
              ), 0
            ), 0
          ), 0
        )
        const recent = vol(allSessions.slice(0, 3))
        const older  = vol(allSessions.slice(3, 6))
        if (older === 0) return 'insufficient_data'
        if (recent > older * 1.05) return 'up'
        if (recent < older * 0.95) return 'down'
        return 'flat'
      }

      let focusKpi: FocusKpi

      if (recentSessions.length < 2) {
        focusKpi = { type: 'insufficient_data' }
      } else {
        const focus = client.primaryFocus ?? 'mixed'

        if (focus === 'resistance') {
          const rSets = recentSets.filter(s =>
            s.workoutType === 'resistance' && s.weight && s.reps
          )
          const byEx: Record<string, number> = {}
          for (const s of rSets) {
            if (s.weight && s.reps) {
              const est = epley1rmKg(s.weight, s.reps)
              if (!byEx[s.exerciseName] || est > (byEx[s.exerciseName] ?? 0)) {
                byEx[s.exerciseName] = est
              }
            }
          }
          const top = Object.entries(byEx).sort((a, b) => b[1] - a[1])[0]
          focusKpi = {
            type:        'resistance',
            topExercise: top?.[0] ?? null,
            estOnermKg:  client.show1rmEstimate && top
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              ? Math.round(top[1]! * 10) / 10
              : null,
            volumeTrend: calcVolumeTrend(),
          }
        } else if (focus === 'calisthenics') {
          const cSets = recentSets.filter(s => s.reps != null)
          const byEx: Record<string, number> = {}
          for (const s of cSets) {
            if (s.reps) byEx[s.exerciseName] = Math.max(byEx[s.exerciseName] ?? 0, s.reps)
          }
          const top = Object.entries(byEx).sort((a, b) => b[1] - a[1])[0]
          const half = Math.floor(cSets.length / 2)
          const m1   = Math.max(...cSets.slice(0, half).map(s => s.reps ?? 0), 0)
          const m2   = Math.max(...cSets.slice(half).map(s => s.reps ?? 0), 0)
          const repsTrend: Trend = m2 === 0 ? 'insufficient_data'
            : m1 > m2 * 1.05 ? 'up'
            : m1 < m2 * 0.95 ? 'down'
            : 'flat'
          focusKpi = {
            type:        'calisthenics',
            topExercise: top?.[0] ?? null,
            maxReps:     top?.[1] ?? null,
            repsTrend,
          }
        } else if (focus === 'cardio') {
          const cSets  = recentSets.filter(s => s.workoutType === 'cardio')
          const dist   = cSets.reduce((a, s) => a + (s.distance ?? 0), 0)
          const secs   = cSets.reduce((a, s) => a + (s.durationSeconds ?? 0), 0)
          const pace   = dist > 0 && secs > 0
            ? Math.round(((secs / 60) / (dist / 1000)) * 10) / 10
            : null
          focusKpi = {
            type:            'cardio',
            totalDistanceKm: dist > 0 ? Math.round(dist * 10) / 10 : null,
            avgPaceMinPerKm: pace,
            paceTrend:       'insufficient_data',
          }
        } else {
          const totalVol = recentSets.reduce(
            (a, s) => a + ((s.weight ?? 0) * (s.reps ?? 0)), 0
          )
          focusKpi = {
            type:           'mixed',
            totalVolumeLbs: totalVol > 0 ? Math.round(totalVol) : null,
            volumeTrend:    calcVolumeTrend(),
          }
        }
      }

      // ── Month stats ───────────────────────────────────────────────────────────
      const monthSessions = allSessions.filter(
        s => new Date(s.date + 'T00:00:00') >= monthStart
      )

      const volumeThisMonthLbs = monthSessions.reduce(
        (acc, s) => acc + s.workouts.reduce(
          (a, w) => a + w.sessionExercises.reduce(
            (b, se) => b + se.sets.reduce(
              (c, set) => c + ((set.weight ?? 0) * (set.reps ?? 0)), 0
            ), 0
          ), 0
        ), 0
      )

      const energyScores = monthSessions.map(s => s.energyLevel).filter((e): e is number => e != null)
      const stressScores = monthSessions.map(s => s.stressLevel).filter((e): e is number => e != null)

      const avg = (arr: number[]) =>
        arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null

      // ── Consistency score ────────────────────────────────────────────────────
      // Rolling 4-week score: sessions completed ÷ sessions targeted × 100
      // Capped at 100. A trainer targeting 3/week who did 3,3,4,2 = 12/12 = 100
      const target4Weeks = client.weeklySessionTarget * 4
      const fourWeeksAgo = new Date(now)
      fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28)
      const sessions4Weeks = allSessions.filter(
        s => new Date(s.date + 'T00:00:00') >= fourWeeksAgo
      ).length
      const consistencyScore = target4Weeks > 0
        ? Math.min(100, Math.round((sessions4Weeks / target4Weeks) * 100))
        : 0

      return reply.send({
        clientId,
        computedAt:            now.toISOString(),
        currentStreakWeeks,
        bestStreakWeeks,
        sessionsThisWeek,
        weeklySessionTarget:   client.weeklySessionTarget,
        daysSinceLastSession,
        lastSessionDate,
        focusKpi,
        volumeThisMonthLbs:    volumeThisMonthLbs > 0 ? Math.round(volumeThisMonthLbs) : null,
        totalSessionsAllTime:  allSessions.length,
        sessionsThisMonth:     monthSessions.length,
        consistencyScore,
        avgEnergyThisMonth:    avg(energyScores),
        avgStressThisMonth:    avg(stressScores),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to compute KPIs' })
    }
  })

  // ----------------------------------------------------------
  // GET /clients/:id/personal-bests
  // Returns best 1RM estimate and best volume per exercise for a client.
  // Only resistance exercises with weight+reps are included.
  // ----------------------------------------------------------

  const PersonalBestSchema = z.object({
    exerciseId:   z.string().uuid(),
    exerciseName: z.string(),
    best1rm:      z.number().describe('Epley 1RM estimate: weight × (1 + reps/30)'),
    best1rmWeight:z.number(),
    best1rmReps:  z.number().int(),
    best1rmDate:  z.string().describe('YYYY-MM-DD'),
    bestVolume:   z.number().describe('weight × reps in a single set'),
    bestVolumeWeight: z.number(),
    bestVolumeReps:   z.number().int(),
    bestVolumeDate:   z.string(),
  })

  app.get('/clients/:id/personal-bests', {
    schema: {
      tags:     ['Clients'],
      security: [{ bearerAuth: [] }],
      summary:  'Get personal bests for a client',
      params:   UuidParamSchema,
      response: {
        200: z.array(PersonalBestSchema),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: clientId } = request.params as z.infer<typeof UuidParamSchema>

    try {
      // Verify client belongs to this trainer
      const client = await db.query.clients.findFirst({
        where: and(eq(clients.id, clientId), eq(clients.trainerId, request.trainer.trainerId)),
        columns: { id: true },
      })
      if (!client) return reply.status(404).send({ error: 'Client not found' })

      // Fetch all resistance sets with weight+reps for this client
      const rows = await db
        .select({
          exerciseId:   sessionExercises.exerciseId,
          weight:       sets.weight,
          reps:         sets.reps,
          sessionDate:  sessions.date,
        })
        .from(sets)
        .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
        .innerJoin(workouts, eq(sessionExercises.workoutId, workouts.id))
        .innerJoin(sessions, eq(workouts.sessionId, sessions.id))
        .where(
          and(
            eq(sessions.clientId, clientId),
            eq(sessions.trainerId, request.trainer.trainerId),
          )
        )

      // Fetch exercise names in one query
      const exerciseIds = [...new Set(rows.map(r => r.exerciseId))]
      const exerciseMap = new Map<string, string>()
      if (exerciseIds.length > 0) {
        const exRows = await db.query.exercises.findMany({
          where: (ex, { inArray }) => inArray(ex.id, exerciseIds),
          columns: { id: true, name: true },
        })
        exRows.forEach(e => exerciseMap.set(e.id, e.name))
      }

      // Compute bests per exercise
      const epley = (w: number, r: number) => w * (1 + r / 30)
      const bests = new Map<string, {
        best1rm: number; best1rmWeight: number; best1rmReps: number; best1rmDate: string
        bestVolume: number; bestVolumeWeight: number; bestVolumeReps: number; bestVolumeDate: string
      }>()

      for (const row of rows) {
        if (!row.weight || !row.reps || row.reps <= 0) continue
        const e1rm   = epley(row.weight, row.reps)
        const volume = row.weight * row.reps
        const cur    = bests.get(row.exerciseId)

        bests.set(row.exerciseId, {
          best1rm:           cur && cur.best1rm >= e1rm ? cur.best1rm : e1rm,
          best1rmWeight:     cur && cur.best1rm >= e1rm ? cur.best1rmWeight : row.weight,
          best1rmReps:       cur && cur.best1rm >= e1rm ? cur.best1rmReps   : row.reps,
          best1rmDate:       cur && cur.best1rm >= e1rm ? cur.best1rmDate   : row.sessionDate,
          bestVolume:        cur && cur.bestVolume >= volume ? cur.bestVolume       : volume,
          bestVolumeWeight:  cur && cur.bestVolume >= volume ? cur.bestVolumeWeight : row.weight,
          bestVolumeReps:    cur && cur.bestVolume >= volume ? cur.bestVolumeReps   : row.reps,
          bestVolumeDate:    cur && cur.bestVolume >= volume ? cur.bestVolumeDate   : row.sessionDate,
        })
      }

      const result = [...bests.entries()]
        .map(([exerciseId, b]) => ({
          exerciseId,
          exerciseName:     exerciseMap.get(exerciseId) ?? 'Unknown',
          best1rm:          Math.round(b.best1rm * 10) / 10,
          best1rmWeight:    b.best1rmWeight,
          best1rmReps:      b.best1rmReps,
          best1rmDate:      b.best1rmDate,
          bestVolume:       Math.round(b.bestVolume),
          bestVolumeWeight: b.bestVolumeWeight,
          bestVolumeReps:   b.bestVolumeReps,
          bestVolumeDate:   b.bestVolumeDate,
        }))
        .sort((a, b) => b.best1rm - a.best1rm)  // highest 1RM first

      return reply.send(result)
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to compute personal bests' })
    }
  })
}
