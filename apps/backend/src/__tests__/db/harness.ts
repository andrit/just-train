// ------------------------------------------------------------
// __tests__/db/harness.ts — real-database fixtures (security gate G3)
//
// resetDatabase(): TRUNCATE every table Drizzle knows about, so a new table
// is covered automatically. seedTenants(): two trainers; A owns one row in
// every table a parameterised route can address, B owns only what
// registration would give. Ids come back so the matrix can aim B at A.
//
// Rows are inserted directly (not through the API) — the matrix is about
// what the routes let B reach, not about how A created things.
// ------------------------------------------------------------

import { sql, getTableName } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { db } from '../../db'
import * as schema from '../../db/schema'
import { generateAccessToken, hashPassword } from '../../services/auth.service'

export interface Tenant {
  trainerId:  string
  token:      string
  email:      string
  selfClient: string
}

export interface Seed {
  a: Tenant & {
    client:            string   // external client owned by A
    goal:              string
    snapshot:          string
    snapshotMedia:     string
    privateExercise:   string
    exerciseMedia:     string   // on the private exercise
    session:           string
    sessionExercise:   string
    set:               string
    sessionExerciseMedia: string
    template:          string
    templateExercise:  string
    challenge:         string
    deviceId:          string   // a refresh-token row = "a device"
  }
  b: Tenant & {
    session:         string     // B's own, for body-id cases
    sessionExercise: string
    template:        string
  }
  publicExercise: string
}

export const PASSWORD = 'correct-horse-battery-staple'

let cachedHash: string | null = null
async function passwordHash(): Promise<string> {
  cachedHash ??= await hashPassword(PASSWORD)
  return cachedHash
}

const one = <T>(rows: T[]): T => {
  const r = rows[0]
  if (!r) throw new Error('insert returned no row')
  return r
}

export async function resetDatabase(): Promise<void> {
  const names = (Object.values(schema) as unknown[])
    .filter((v): v is PgTable => v instanceof PgTable)
    .map((t) => `"${getTableName(t)}"`)
  await db.execute(sql.raw(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`))
}

async function insertTrainer(email: string, name: string): Promise<Tenant> {
  const t = one(await db.insert(schema.trainers).values({ email, name, passwordHash: await passwordHash() }).returning({ id: schema.trainers.id }))
  const self = one(await db.insert(schema.clients).values({ trainerId: t.id, name, isSelf: true }).returning({ id: schema.clients.id }))
  return { trainerId: t.id, email, selfClient: self.id, token: generateAccessToken(t.id, 'trainer') }
}

export async function seedTenants(): Promise<Seed> {
  const a = await insertTrainer('a@example.test', 'Trainer A')
  const b = await insertTrainer('b@example.test', 'Trainer B')

  const publicExercise = one(await db.insert(schema.exercises).values({ name: 'Public Squat', workoutType: 'resistance' }).returning({ id: schema.exercises.id })).id

  // ── A's world ──────────────────────────────────────────────────────────────
  const client   = one(await db.insert(schema.clients).values({ trainerId: a.trainerId, name: 'A Client' }).returning({ id: schema.clients.id })).id
  const goal     = one(await db.insert(schema.clientGoals).values({ clientId: client, goal: 'Run 5k' }).returning({ id: schema.clientGoals.id })).id
  const snapshot = one(await db.insert(schema.clientSnapshots).values({ clientId: client, capturedBy: a.trainerId }).returning({ id: schema.clientSnapshots.id })).id   // captured_by → trainers is the RESTRICT edge
  const snapshotMedia = one(await db.insert(schema.snapshotMedia).values({
    snapshotId: snapshot, pose: 'front', cloudinaryUrl: 'https://res.cloudinary.com/x/a-snap', cloudinaryPublicId: 'trainer-app/clients/a/snapshots/s/a-snap',
  }).returning({ id: schema.snapshotMedia.id })).id
  const privateExercise = one(await db.insert(schema.exercises).values({ trainerId: a.trainerId, name: 'A Private Curl', workoutType: 'resistance' }).returning({ id: schema.exercises.id })).id
  const exerciseMedia = one(await db.insert(schema.exerciseMedia).values({
    exerciseId: privateExercise, mediaType: 'image', cloudinaryUrl: 'https://res.cloudinary.com/x/a-ex', cloudinaryPublicId: 'trainer-app/exercises/a/a-ex',
  }).returning({ id: schema.exerciseMedia.id })).id
  const session = one(await db.insert(schema.sessions).values({ trainerId: a.trainerId, clientId: client, date: '2026-09-01' }).returning({ id: schema.sessions.id })).id
  const sessionExercise = one(await db.insert(schema.sessionExercises).values({ sessionId: session, exerciseId: privateExercise, workoutType: 'resistance' }).returning({ id: schema.sessionExercises.id })).id
  const set = one(await db.insert(schema.sets).values({ sessionExerciseId: sessionExercise, setNumber: 1, reps: 10, weight: 100 }).returning({ id: schema.sets.id })).id
  const sessionExerciseMedia = one(await db.insert(schema.sessionExerciseMedia).values({
    sessionExerciseId: sessionExercise, mediaType: 'video', cloudinaryUrl: 'https://res.cloudinary.com/x/a-clip', cloudinaryPublicId: 'trainer-app/clients/a/sessions/s/se/a-clip',
  }).returning({ id: schema.sessionExerciseMedia.id })).id
  const template = one(await db.insert(schema.templates).values({ trainerId: a.trainerId, name: 'A Template' }).returning({ id: schema.templates.id })).id
  const templateExercise = one(await db.insert(schema.templateExercises).values({ templateId: template, exerciseId: privateExercise, workoutType: 'resistance' }).returning({ id: schema.templateExercises.id })).id
  const challenge = one(await db.insert(schema.challenges).values({
    clientId: client, trainerId: a.trainerId, title: '10 pull-ups', metricType: 'reps_achieved', exerciseId: privateExercise, targetValue: 10, deadline: '2026-12-31',
  }).returning({ id: schema.challenges.id })).id
  const deviceId = 'device-a-1'
  await db.insert(schema.refreshTokens).values({
    trainerId: a.trainerId, tokenHash: 'not-a-real-hash-a', deviceId, expiresAt: new Date(Date.now() + 86_400_000),
  })

  // ── B's own resources, for body-id cases ───────────────────────────────────
  const bSession = one(await db.insert(schema.sessions).values({ trainerId: b.trainerId, clientId: b.selfClient, date: '2026-09-01' }).returning({ id: schema.sessions.id })).id
  const bSessionExercise = one(await db.insert(schema.sessionExercises).values({ sessionId: bSession, exerciseId: publicExercise, workoutType: 'resistance' }).returning({ id: schema.sessionExercises.id })).id
  const bTemplate = one(await db.insert(schema.templates).values({ trainerId: b.trainerId, name: 'B Template' }).returning({ id: schema.templates.id })).id

  return {
    a: { ...a, client, goal, snapshot, snapshotMedia, privateExercise, exerciseMedia, session, sessionExercise, set, sessionExerciseMedia, template, templateExercise, challenge, deviceId },
    b: { ...b, session: bSession, sessionExercise: bSessionExercise, template: bTemplate },
    publicExercise,
  }
}
