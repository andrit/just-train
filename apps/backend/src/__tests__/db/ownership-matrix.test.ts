// ------------------------------------------------------------
// __tests__/db/ownership-matrix.test.ts — security gate G3
//
// Against a real Postgres: trainer B calls every route that takes an id,
// using trainer A's ids, and must get 404 every time. Not 403 (that confirms
// the thing exists), not 400 (that means validation stopped us before the
// ownership check ran — bodies here are the minimal VALID shape for exactly
// that reason).
//
// The source-scan guards in __tests__/security/ check that handlers *mention*
// the trainer id in a filter. This is the proof that the filter works. The
// coverage test at the bottom keeps it complete: a new parameterised route
// without a matrix entry fails this lane.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { buildAuditedFullTestApp, type RegisteredRoute } from '../helpers/buildApp'
import { resetDatabase, seedTenants, type Seed } from './harness'

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface Case {
  /** Exactly as Fastify registers it — the coverage guard matches on this. */
  route: `${Method} /${string}`
  /** The concrete URL B sends, aimed at A's ids. */
  url:   (s: Seed) => string
  body?: (s: Seed) => unknown
}

const DATE = '2026-09-02'

// ── URL-id routes: B → A's resource → 404 ─────────────────────────────────────
const MATRIX: Case[] = [
  // auth
  { route: 'DELETE /auth/devices/:deviceId', url: (s) => `/auth/devices/${s.a.deviceId}` },

  // clients
  { route: 'GET /clients/:id',                                url: (s) => `/clients/${s.a.client}` },
  { route: 'PATCH /clients/:id',                              url: (s) => `/clients/${s.a.client}`, body: () => ({ name: 'Renamed' }) },
  { route: 'DELETE /clients/:id',                             url: (s) => `/clients/${s.a.client}` },
  { route: 'GET /clients/:id/kpis',                           url: (s) => `/clients/${s.a.client}/kpis` },
  { route: 'GET /clients/:id/personal-bests',                 url: (s) => `/clients/${s.a.client}/personal-bests` },
  { route: 'GET /clients/:id/exercise-history/:exerciseId',   url: (s) => `/clients/${s.a.client}/exercise-history/${s.a.privateExercise}` },
  { route: 'GET /clients/:id/exercise-progress/:exerciseId',  url: (s) => `/clients/${s.a.client}/exercise-progress/${s.a.privateExercise}` },
  { route: 'GET /clients/:id/report-preview',                 url: (s) => `/clients/${s.a.client}/report-preview` },
  { route: 'POST /clients/:id/report',                        url: (s) => `/clients/${s.a.client}/report`, body: () => ({}) },

  // goals
  { route: 'GET /clients/:clientId/goals',                    url: (s) => `/clients/${s.a.client}/goals` },
  { route: 'POST /clients/:clientId/goals',                   url: (s) => `/clients/${s.a.client}/goals`, body: () => ({ goal: 'Deadlift 2x bodyweight' }) },
  { route: 'PATCH /clients/:clientId/goals/:id',              url: (s) => `/clients/${s.a.client}/goals/${s.a.goal}`, body: () => ({ goal: 'Changed' }) },
  { route: 'DELETE /clients/:clientId/goals/:id',             url: (s) => `/clients/${s.a.client}/goals/${s.a.goal}` },

  // snapshots
  { route: 'GET /clients/:clientId/snapshots',                url: (s) => `/clients/${s.a.client}/snapshots` },
  { route: 'GET /clients/:clientId/snapshots/latest',         url: (s) => `/clients/${s.a.client}/snapshots/latest` },
  { route: 'GET /clients/:clientId/snapshots/:id',            url: (s) => `/clients/${s.a.client}/snapshots/${s.a.snapshot}` },
  { route: 'POST /clients/:clientId/snapshots',               url: (s) => `/clients/${s.a.client}/snapshots`, body: () => ({}) },
  { route: 'PATCH /clients/:clientId/snapshots/:id',          url: (s) => `/clients/${s.a.client}/snapshots/${s.a.snapshot}`, body: () => ({}) },
  { route: 'DELETE /clients/:clientId/snapshots/:id',         url: (s) => `/clients/${s.a.client}/snapshots/${s.a.snapshot}` },
  { route: 'GET /clients/:clientId/progress-photos',          url: (s) => `/clients/${s.a.client}/progress-photos` },
  { route: 'POST /snapshots/:id/media',                       url: (s) => `/snapshots/${s.a.snapshot}/media?pose=front` },
  { route: 'PATCH /snapshot-media/:id',                       url: (s) => `/snapshot-media/${s.a.snapshotMedia}`, body: () => ({ caption: 'x' }) },
  { route: 'DELETE /snapshot-media/:id',                      url: (s) => `/snapshot-media/${s.a.snapshotMedia}` },

  // challenges
  { route: 'GET /clients/:clientId/challenges',               url: (s) => `/clients/${s.a.client}/challenges` },
  { route: 'POST /clients/:clientId/challenges',              url: (s) => `/clients/${s.a.client}/challenges`, body: () => ({ title: 't', metricType: 'sessions_completed', targetValue: 3, deadline: '2026-12-31' }) },
  { route: 'PATCH /challenges/:id',                           url: (s) => `/challenges/${s.a.challenge}`, body: () => ({ title: 'Changed' }) },
  { route: 'DELETE /challenges/:id',                          url: (s) => `/challenges/${s.a.challenge}` },

  // exercises — A's PRIVATE exercise; a public one legitimately returns 200 for B
  { route: 'GET /exercises/:id',                              url: (s) => `/exercises/${s.a.privateExercise}` },
  { route: 'PATCH /exercises/:id',                            url: (s) => `/exercises/${s.a.privateExercise}`, body: () => ({ name: 'Renamed' }) },
  { route: 'DELETE /exercises/:id',                           url: (s) => `/exercises/${s.a.privateExercise}` },
  { route: 'POST /exercises/:id/media',                       url: (s) => `/exercises/${s.a.privateExercise}/media` },
  { route: 'PATCH /exercises/:id/media/:mediaId/primary',     url: (s) => `/exercises/${s.a.privateExercise}/media/${s.a.exerciseMedia}/primary` },
  { route: 'DELETE /exercises/:id/media/:mediaId',            url: (s) => `/exercises/${s.a.privateExercise}/media/${s.a.exerciseMedia}` },

  // sessions
  { route: 'GET /sessions/:id',                               url: (s) => `/sessions/${s.a.session}` },
  { route: 'PATCH /sessions/:id',                             url: (s) => `/sessions/${s.a.session}`, body: () => ({ name: 'Renamed' }) },
  { route: 'DELETE /sessions/:id',                            url: (s) => `/sessions/${s.a.session}` },
  { route: 'POST /sessions/:id/exercises',                    url: (s) => `/sessions/${s.a.session}/exercises`, body: (s) => ({ exerciseId: s.publicExercise }) },
  { route: 'POST /sessions/:id/circuits',                     url: (s) => `/sessions/${s.a.session}/circuits`, body: (s) => ({ exerciseIds: [s.publicExercise, s.publicExercise], rounds: 2 }) },
  { route: 'PATCH /sessions/:id/exercises/reorder',           url: (s) => `/sessions/${s.a.session}/exercises/reorder`, body: (s) => ({ orderedIds: [s.a.sessionExercise] }) },
  { route: 'PATCH /session-exercises/:id',                    url: (s) => `/session-exercises/${s.a.sessionExercise}`, body: () => ({ targetSets: 3 }) },
  { route: 'DELETE /session-exercises/:id',                   url: (s) => `/session-exercises/${s.a.sessionExercise}` },
  { route: 'POST /session-exercises/:id/sets',                url: (s) => `/session-exercises/${s.a.sessionExercise}/sets`, body: (s) => ({ sessionExerciseId: s.a.sessionExercise, setNumber: 2, reps: 8 }) },
  { route: 'PATCH /sets/:id',                                 url: (s) => `/sets/${s.a.set}`, body: () => ({ reps: 12 }) },
  { route: 'DELETE /sets/:id',                                url: (s) => `/sets/${s.a.set}` },
  { route: 'GET /session-exercises/:id/media',                url: (s) => `/session-exercises/${s.a.sessionExercise}/media` },
  { route: 'POST /session-exercises/:id/media',               url: (s) => `/session-exercises/${s.a.sessionExercise}/media` },
  { route: 'DELETE /session-exercise-media/:id',              url: (s) => `/session-exercise-media/${s.a.sessionExerciseMedia}` },

  // templates
  { route: 'GET /templates/:id',                              url: (s) => `/templates/${s.a.template}` },
  { route: 'PATCH /templates/:id',                            url: (s) => `/templates/${s.a.template}`, body: () => ({ name: 'Renamed' }) },
  { route: 'DELETE /templates/:id',                           url: (s) => `/templates/${s.a.template}` },
  { route: 'POST /templates/:id/fork',                        url: (s) => `/templates/${s.a.template}/fork` },
  { route: 'POST /templates/:id/exercises',                   url: (s) => `/templates/${s.a.template}/exercises`, body: (s) => ({ exerciseId: s.publicExercise }) },
  { route: 'POST /templates/:id/circuits',                    url: (s) => `/templates/${s.a.template}/circuits`, body: (s) => ({ exerciseIds: [s.publicExercise, s.publicExercise], rounds: 2 }) },
  { route: 'PATCH /templates/:id/exercises/reorder',          url: (s) => `/templates/${s.a.template}/exercises/reorder`, body: (s) => ({ orderedIds: [s.a.templateExercise] }) },
  { route: 'DELETE /template-exercises/:id',                  url: (s) => `/template-exercises/${s.a.templateExercise}` },
]

// ── Body-id routes: B's own URL resource, A's id in the body → 404 ────────────
// (The second IDOR sweep, 2026-09-15: ids that travel in the body, not the URL.)
const BODY_MATRIX: Case[] = [
  { route: 'POST /sessions',                                  url: () => '/sessions', body: (s) => ({ clientId: s.a.client, date: DATE }) },
  { route: 'POST /sessions',                                  url: () => '/sessions', body: (s) => ({ clientId: s.b.selfClient, date: DATE, templateId: s.a.template }) },
  { route: 'POST /sessions/:id/exercises',                    url: (s) => `/sessions/${s.b.session}/exercises`, body: (s) => ({ exerciseId: s.a.privateExercise }) },
  { route: 'POST /sessions/:id/circuits',                     url: (s) => `/sessions/${s.b.session}/circuits`, body: (s) => ({ exerciseIds: [s.a.privateExercise, s.publicExercise], rounds: 2 }) },
  { route: 'POST /templates/:id/exercises',                   url: (s) => `/templates/${s.b.template}/exercises`, body: (s) => ({ exerciseId: s.a.privateExercise }) },
  { route: 'POST /templates/:id/circuits',                    url: (s) => `/templates/${s.b.template}/circuits`, body: (s) => ({ exerciseIds: [s.a.privateExercise, s.publicExercise], rounds: 2 }) },
  { route: 'POST /clients/:clientId/challenges',              url: (s) => `/clients/${s.b.selfClient}/challenges`, body: (s) => ({ title: 't', metricType: 'reps_achieved', exerciseId: s.a.privateExercise, targetValue: 3, deadline: '2026-12-31' }) },
  { route: 'POST /templates/from-session',                    url: () => '/templates/from-session', body: (s) => ({ sessionId: s.a.session, name: 'Stolen' }) },
  { route: 'PATCH /sessions/:id/exercises/reorder',           url: (s) => `/sessions/${s.b.session}/exercises/reorder`, body: (s) => ({ orderedIds: [s.a.sessionExercise] }) },
]

let app: FastifyInstance
let routes: RegisteredRoute[]
let seed: Seed

beforeAll(async () => {
  await resetDatabase()
  seed = await seedTenants()
  ;({ app, routes } = await buildAuditedFullTestApp())
})
afterAll(async () => { await app.close() })

const send = (c: Case) => {
  const [method] = c.route.split(' ') as [Method]
  const opts: InjectOptions = {
    method,
    url:     `/api/v1${c.url(seed)}`,
    headers: { authorization: `Bearer ${seed.b.token}`, 'x-device-id': 'device-b-1' },
  }
  if (c.body) opts.payload = c.body(seed) as Record<string, unknown>
  return app.inject(opts)
}

describe('ownership matrix — trainer B against trainer A\'s ids', () => {
  for (const c of MATRIX) {
    it(`${c.route} → 404`, async () => {
      const res = await send(c)
      expect(res.statusCode, `${c.route} answered ${res.statusCode}: ${res.body}`).toBe(404)
    })
  }
})

describe('ownership matrix — A\'s ids smuggled in a request body', () => {
  BODY_MATRIX.forEach((c, i) => {
    it(`${c.route} [body case ${i + 1}] → 404`, async () => {
      const res = await send(c)
      expect(res.statusCode, `${c.route} answered ${res.statusCode}: ${res.body}`).toBe(404)
    })
  })
})

describe('sanity — the same calls succeed for the owner', () => {
  // If A cannot read their own rows either, every 404 above is meaningless.
  it('A reads their client, session, template and exercise', async () => {
    for (const path of [`/clients/${seed.a.client}`, `/sessions/${seed.a.session}`, `/templates/${seed.a.template}`, `/exercises/${seed.a.privateExercise}`]) {
      const res = await app.inject({ method: 'GET', url: `/api/v1${path}`, headers: { authorization: `Bearer ${seed.a.token}` } })
      expect(res.statusCode, `${path}: ${res.body}`).toBe(200)
    }
  })
})

describe('coverage — every parameterised route has a matrix entry', () => {
  it('registered routes with a :param all appear in MATRIX', () => {
    const registered = new Set(
      routes
        .filter((r) => r.url.includes(':'))
        .map((r) => `${r.method} ${r.url.replace(/^\/api\/v1/, '')}`),
    )
    const covered = new Set(MATRIX.map((c) => c.route as string))
    const missing = [...registered].filter((r) => !covered.has(r)).sort()
    const stale   = [...covered].filter((r) => !registered.has(r)).sort()
    expect(missing, 'routes registered but not in the matrix — add a case').toEqual([])
    expect(stale,   'matrix cases for routes that no longer exist — remove them').toEqual([])
  })
})
