// ------------------------------------------------------------
// helpers/buildApp.ts — Test Fastify instance builder
//
// Creates a minimal Fastify app configured for testing.
// Intentionally omits: Swagger, rate-limiting, pino logging.
// Includes: Zod type provider, cookie plugin, and the routes under test.
//
// PHASE 3C ADDITIONS:
//   - buildClientGoalTestApp / buildClientSnapshotTestApp builders
//   - dbMockFactory extended with clientGoals, clientSnapshots query entries
// ------------------------------------------------------------

import { vi } from 'vitest'
import Fastify                                   from 'fastify'
import cookie                                    from '@fastify/cookie'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { authRoutes }            from '../../routes/auth'
import { clientRoutes }          from '../../routes/clients'
import { clientGoalRoutes }      from '../../routes/client-goals'
import { clientSnapshotRoutes }  from '../../routes/client-snapshots'
import { exerciseRoutes }        from '../../routes/exercises'
import { sessionRoutes }         from '../../routes/sessions'
import { templateRoutes }        from '../../routes/templates'

function createBaseApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  return app
}

export async function buildAuthTestApp() {
  const app = createBaseApp()
  await app.register(cookie, { secret: 'test-cookie-secret-for-testing-only' })
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.ready()
  return app
}

export async function buildClientTestApp() {
  const app = createBaseApp()
  await app.register(clientRoutes, { prefix: '/api/v1' })
  await app.ready()
  return app
}

export async function buildClientGoalTestApp() {
  const app = createBaseApp()
  await app.register(clientRoutes,     { prefix: '/api/v1' })
  await app.register(clientGoalRoutes, { prefix: '/api/v1' })
  await app.ready()
  return app
}

export async function buildClientSnapshotTestApp() {
  const app = createBaseApp()
  await app.register(clientRoutes,         { prefix: '/api/v1' })
  await app.register(clientSnapshotRoutes, { prefix: '/api/v1' })
  await app.ready()
  return app
}

export async function buildFullTestApp() {
  const app = createBaseApp()
  await app.register(cookie, { secret: 'test-cookie-secret-for-testing-only' })
  await app.register(authRoutes,           { prefix: '/api/v1' })
  await app.register(clientRoutes,         { prefix: '/api/v1' })
  await app.register(clientGoalRoutes,     { prefix: '/api/v1' })
  await app.register(clientSnapshotRoutes, { prefix: '/api/v1' })
  await app.register(exerciseRoutes,       { prefix: '/api/v1' })
  await app.register(sessionRoutes,        { prefix: '/api/v1' })
  await app.register(templateRoutes,       { prefix: '/api/v1' })
  await app.ready()
  return app
}

// ── DB mock factory ───────────────────────────────────────────────────────────

export function dbMockFactory() {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }

  return {
    db: {
      query: {
        trainers:        { findFirst: vi.fn().mockResolvedValue(undefined) },
        clients:         { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        refreshTokens:   { findFirst: vi.fn().mockResolvedValue(undefined) },
        exercises:       { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        sessions:        { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        templates:       { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        bodyParts:       { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        // Phase 3C
        clientGoals:         { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        clientSnapshots:     { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        // Phase 3D
        trainerUsageMonthly: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      },
      insert:      vi.fn().mockReturnValue(chain),
      update:      vi.fn().mockReturnValue(chain),
      delete:      vi.fn().mockReturnValue(chain),
      select:      vi.fn().mockReturnValue(chain),
      transaction: vi.fn().mockImplementation(async (fn: (tx: typeof chain) => Promise<unknown>) => fn(chain)),
    },
    trainers:         {},
    clients:          {},
    refreshTokens:    {},
    exercises:        {},
    exerciseMedia:    {},
    bodyParts:        {},
    templates:        {},
    templateWorkouts: {},
    templateExercises:{},
    sessions:         {},
    workouts:         {},
    sessionExercises: {},
    sets:             {},
    syncLog:          {},
    // Phase 3C
    clientGoals:      {},
    clientSnapshots:  {},
    // Phase 3D
    trainerUsageMonthly: {},
    chain,
  }
}
