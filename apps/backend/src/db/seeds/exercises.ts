// ------------------------------------------------------------
// seeds/exercises.ts — Public exercise library
//
// Source of truth: exercises-library.json (edited by trainer)
// Run with: pnpm db:seed
//
// All exercises are isPublic: true, isDraft: false.
// trainerId is null — shared foundation visible to all trainers.
//
// visualization and demonstration fields are null in seed.
// They will be populated in Phase 9 (post-SPA refactor) via
// admin tooling or direct DB updates.
// ------------------------------------------------------------

import { readFileSync } from 'fs'
import { join }         from 'path'
import { db, bodyParts, exercises, exerciseMuscles } from '../index'
import { eq }           from 'drizzle-orm'
import type { Muscle }  from '@trainer-app/shared'

// ── Load JSON library ─────────────────────────────────────────────────────────

const libraryPath = join(__dirname, 'exercises-library.json')
const library = JSON.parse(readFileSync(libraryPath, 'utf-8'))

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getBodyPartId(name: string): Promise<string> {
  const result = await db.query.bodyParts.findFirst({
    where: eq(bodyParts.name, name as any),
  })
  if (!result) throw new Error(`Body part not found: "${name}" — run db:seed first`)
  return result.id
}

function buildInsert(e: any, bodyPartId: string, workoutType: string) {
  return {
    name:          e.name,
    description:   e.description   ?? null,
    instructions:  e.instructions  ?? null,
    bodyPartId,
    workoutType:   workoutType as any,
    equipment:     (e.equipment    ?? 'none') as any,
    difficulty:    (e.difficulty   ?? 'beginner') as any,
    category:      (e.category     ?? null) as any,
    laterality:    (e.laterality   ?? 'bilateral') as any,
    visualization: e.visualization ?? null,
    demonstration: e.demonstration ?? null,
    isDraft:       false,
    isPublic:      true,
    trainerId:     null,
  }
}

// name → worked muscles, flattened across all categories. Muscles are
// seed-only fields (primaryMuscles/secondaryMuscles) on the JSON; validated
// against MuscleEnum at authoring time, so the cast is safe here.
function collectMuscleData(): Record<string, { primary: Muscle[]; secondary: Muscle[] }> {
  const out: Record<string, { primary: Muscle[]; secondary: Muscle[] }> = {}
  const add = (e: any) => {
    out[e.name] = {
      primary:   (e.primaryMuscles   ?? []) as Muscle[],
      secondary: (e.secondaryMuscles ?? []) as Muscle[],
    }
  }
  library.resistance.compound.forEach(add)
  library.resistance.isolation.forEach(add)
  for (const key of ['cardio', 'calisthenics', 'stretching', 'cooldown']) {
    (library[key] ?? []).forEach(add)
  }
  return out
}

// ── Seed ─────────────────────────────────────────────────────────────────────

export async function seedExercises(): Promise<void> {
  console.log('🌱 Seeding exercise library…')

  const existing = await db.query.exercises.findFirst({
    where: eq(exercises.isPublic, true),
  })
  if (existing) {
    console.log('✅ Exercise library already seeded — skipping')
    console.log('   To re-seed, delete public exercises from the DB first.')
    return
  }

  // Build body part ID lookup
  const bpNames = ['arms', 'back', 'chest', 'core', 'full_body', 'legs', 'shoulders']
  const bp: Record<string, string> = {}
  for (const name of bpNames) {
    bp[name] = await getBodyPartId(name)
  }

  const toInsert: ReturnType<typeof buildInsert>[] = []

  // Resistance — compound
  for (const e of library.resistance.compound) {
    const bpId = bp[e.bodyPart]
    if (!bpId) throw new Error(`Unknown bodyPart "${e.bodyPart}" on "${e.name}"`)
    toInsert.push(buildInsert(e, bpId, 'resistance'))
  }

  // Resistance — isolation
  for (const e of library.resistance.isolation) {
    const bpId = bp[e.bodyPart]
    if (!bpId) throw new Error(`Unknown bodyPart "${e.bodyPart}" on "${e.name}"`)
    toInsert.push(buildInsert(e, bpId, 'resistance'))
  }

  // All other categories (flat arrays)
  const flatCategories: Array<[string, string]> = [
    ['cardio',       'cardio'],
    ['calisthenics', 'calisthenics'],
    ['stretching',   'stretching'],
    ['cooldown',     'cooldown'],
  ]

  for (const [key, workoutType] of flatCategories) {
    for (const e of library[key] ?? []) {
      const bpId = bp[e.bodyPart]
      if (!bpId) throw new Error(`Unknown bodyPart "${e.bodyPart}" on "${e.name}"`)
      toInsert.push(buildInsert(e, bpId, workoutType))
    }
  }

  // Insert in batches of 50
  const batchSize = 50
  for (let i = 0; i < toInsert.length; i += batchSize) {
    await db.insert(exercises).values(toInsert.slice(i, i + batchSize))
  }

  // Seed muscle links (exercise_muscles). Muscles are seed-only fields on the
  // JSON, not columns on the exercise, so map them to the just-inserted rows by
  // name. Exercises with no muscle data (cardio, breathing) contribute nothing.
  const muscleByName = collectMuscleData()
  const seeded = await db.query.exercises.findMany({
    where: eq(exercises.isPublic, true),
    columns: { id: true, name: true },
  })
  const muscleRows: (typeof exerciseMuscles.$inferInsert)[] = []
  for (const ex of seeded) {
    const md = muscleByName[ex.name]
    if (!md) continue
    for (const m of md.primary)   muscleRows.push({ exerciseId: ex.id, muscle: m, role: 'primary' })
    for (const m of md.secondary) muscleRows.push({ exerciseId: ex.id, muscle: m, role: 'secondary' })
  }
  for (let i = 0; i < muscleRows.length; i += batchSize) {
    await db.insert(exerciseMuscles).values(muscleRows.slice(i, i + batchSize))
  }

  console.log(`✅ Seeded ${toInsert.length} exercises, ${muscleRows.length} muscle links`)
  console.log(`   Resistance compound:  ${library.resistance.compound.length}`)
  console.log(`   Resistance isolation: ${library.resistance.isolation.length}`)
  console.log(`   Cardio:               ${library.cardio.length}`)
  console.log(`   Calisthenics:         ${library.calisthenics.length}`)
  console.log(`   Stretching:           ${library.stretching.length}`)
  console.log(`   Cooldown:             ${library.cooldown.length}`)
}
