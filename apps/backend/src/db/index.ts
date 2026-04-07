// ------------------------------------------------------------
// db/index.ts — Drizzle database client
//
// Exports the db instance and all table references used by routes.
// Import from this file — never from schema files directly.
//
//   import { db, clients, exercises } from '../db'
//
// The db instance uses Drizzle's relational query API:
//   db.query.clients.findMany({ with: { ... } })
// AND the standard query builder:
//   db.select().from(clients).where(...)
// Both are available — use whichever fits the query shape.
// ------------------------------------------------------------

import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool }    from 'pg'
import * as schema from './schema'

// pg connection pool — Railway injects DATABASE_URL in production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,              // Maximum simultaneous connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

// Drizzle client — schema passed in for the relational query API
export const db = drizzle(pool, { schema, logger: true })

// ── Table exports ─────────────────────────────────────────────────────────────
// Re-export all tables so routes can do: import { db, clients } from '../db'

export const {
  // Auth (Phase 2)
  refreshTokens,

  // Trainers + Clients
  trainers,
  clients,

  // Phase 3C: client sub-resources
  clientGoals,
  clientSnapshots,

  // Phase 3D: usage billing meter
  trainerUsageMonthly,

  // Exercise library
  bodyParts,
  exercises,
  exerciseMedia,

  // Templates
  templates,
  templateWorkouts,
  templateExercises,

  // Sessions
  sessions,
  workouts,
  sessionExercises,
  sets,
  syncLog,
} = schema
