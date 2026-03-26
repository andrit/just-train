// ------------------------------------------------------------
// seeds/defaultTemplates.ts
//
// Seeds 20 default workout templates for a new trainer.
// Called from seedExerciseLibrary() after exercises are seeded.
//
// Templates are looked up by exercise name — must run after
// the exercise seed. Idempotent: skips if trainer already has
// templates.
// ------------------------------------------------------------

import { db, templates, templateWorkouts, templateExercises } from '../index'
import { exercises } from '../schema/exercises'
import { eq, inArray } from 'drizzle-orm'

// ── Template definitions ──────────────────────────────────────────────────────

type ExerciseTarget = {
  name:             string
  sets?:            number
  reps?:            number
  weight?:          number
  durationSeconds?: number
  distance?:        number
}

type BlockDef = {
  type:      'resistance' | 'cardio' | 'calisthenics' | 'stretching' | 'cooldown'
  exercises: ExerciseTarget[]
}

type TemplateDef = {
  name:        string
  description: string
  blocks:      BlockDef[]
}

const DEFAULT_TEMPLATES: TemplateDef[] = [
  // ── Resistance: Push ──────────────────────────────────────────────────────
  {
    name: 'Push Day A',
    description: 'Horizontal and vertical pressing. Chest, shoulders, triceps.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Bench Press',        sets: 4, reps: 8,  weight: 80 },
        { name: 'Incline Barbell Bench Press', sets: 3, reps: 10, weight: 60 },
        { name: 'Overhead Press',              sets: 3, reps: 8,  weight: 50 },
        { name: 'Lateral Raise',               sets: 3, reps: 15, weight: 10 },
        { name: 'Tricep Pushdown',             sets: 3, reps: 12, weight: 25 },
      ],
    }],
  },
  {
    name: 'Push Day B',
    description: 'Dumbbell-focused push. Upper chest emphasis.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Dumbbell Bench Press',        sets: 4, reps: 10, weight: 30 },
        { name: 'Incline Dumbbell Fly',        sets: 3, reps: 12, weight: 15 },
        { name: 'Dumbbell Shoulder Press',     sets: 3, reps: 10, weight: 20 },
        { name: 'Front Raise',                 sets: 3, reps: 12, weight: 10 },
        { name: 'Overhead Tricep Extension',   sets: 3, reps: 12, weight: 20 },
      ],
    }],
  },

  // ── Resistance: Pull ─────────────────────────────────────────────────────
  {
    name: 'Pull Day A',
    description: 'Barbell and cable pulling. Back and biceps.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Deadlift',     sets: 4, reps: 5,  weight: 100 },
        { name: 'Barbell Row',          sets: 3, reps: 8,  weight: 70  },
        { name: 'Pull-Up',              sets: 3, reps: 8             },
        { name: 'Cable Row',            sets: 3, reps: 12, weight: 50 },
        { name: 'Barbell Curl',         sets: 3, reps: 10, weight: 30 },
      ],
    }],
  },
  {
    name: 'Pull Day B',
    description: 'Dumbbell-focused pull. Lat and rear delt emphasis.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Dumbbell Row',         sets: 4, reps: 10, weight: 30 },
        { name: 'Lat Pulldown',         sets: 3, reps: 12, weight: 60 },
        { name: 'Face Pull',            sets: 3, reps: 15, weight: 20 },
        { name: 'Rear Delt Fly',        sets: 3, reps: 15, weight: 10 },
        { name: 'Dumbbell Curl',        sets: 3, reps: 12, weight: 15 },
      ],
    }],
  },

  // ── Resistance: Legs ─────────────────────────────────────────────────────
  {
    name: 'Leg Day A',
    description: 'Squat-focused lower body. Quad dominant.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Back Squat',     sets: 4, reps: 6,  weight: 100 },
        { name: 'Romanian Deadlift',      sets: 3, reps: 10, weight: 70  },
        { name: 'Leg Press',              sets: 3, reps: 12, weight: 120 },
        { name: 'Leg Extension',          sets: 3, reps: 15, weight: 50  },
        { name: 'Standing Calf Raise',    sets: 4, reps: 20, weight: 40  },
      ],
    }],
  },
  {
    name: 'Leg Day B',
    description: 'Hip hinge and unilateral work. Hamstring and glute emphasis.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Romanian Deadlift',         sets: 4, reps: 8,  weight: 80 },
        { name: 'Bulgarian Split Squat',     sets: 3, reps: 10, weight: 20 },
        { name: 'Lying Leg Curl',            sets: 3, reps: 12, weight: 40 },
        { name: 'Hip Thrust',                sets: 3, reps: 12, weight: 80 },
        { name: 'Seated Calf Raise',         sets: 4, reps: 20, weight: 30 },
      ],
    }],
  },

  // ── Resistance: Upper / Lower ─────────────────────────────────────────────
  {
    name: 'Upper Body',
    description: 'Full upper body session. Push and pull balanced.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Bench Press',    sets: 4, reps: 8,  weight: 80 },
        { name: 'Barbell Row',            sets: 4, reps: 8,  weight: 70 },
        { name: 'Overhead Press',         sets: 3, reps: 10, weight: 50 },
        { name: 'Pull-Up',                sets: 3, reps: 8             },
        { name: 'Lateral Raise',          sets: 3, reps: 15, weight: 10 },
        { name: 'Barbell Curl',           sets: 2, reps: 12, weight: 30 },
        { name: 'Tricep Pushdown',        sets: 2, reps: 12, weight: 25 },
      ],
    }],
  },
  {
    name: 'Lower Body',
    description: 'Full lower body session. Squat and hinge balanced.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Back Squat',     sets: 4, reps: 8,  weight: 90 },
        { name: 'Romanian Deadlift',      sets: 3, reps: 10, weight: 70 },
        { name: 'Leg Press',              sets: 3, reps: 12, weight: 110 },
        { name: 'Lying Leg Curl',         sets: 3, reps: 12, weight: 40 },
        { name: 'Standing Calf Raise',    sets: 3, reps: 20, weight: 40 },
      ],
    }],
  },

  // ── Resistance: Full Body ─────────────────────────────────────────────────
  {
    name: 'Full Body A',
    description: 'Compound-focused full body. 3 days/week foundation program.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Back Squat',     sets: 3, reps: 8,  weight: 80 },
        { name: 'Barbell Bench Press',    sets: 3, reps: 8,  weight: 70 },
        { name: 'Barbell Row',            sets: 3, reps: 8,  weight: 60 },
        { name: 'Overhead Press',         sets: 2, reps: 10, weight: 40 },
        { name: 'Romanian Deadlift',      sets: 2, reps: 10, weight: 60 },
      ],
    }],
  },
  {
    name: 'Full Body B',
    description: 'Alternates with Full Body A. Different movement patterns.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Deadlift',       sets: 3, reps: 5,  weight: 100 },
        { name: 'Dumbbell Bench Press',   sets: 3, reps: 10, weight: 30  },
        { name: 'Pull-Up',                sets: 3, reps: 8              },
        { name: 'Bulgarian Split Squat',  sets: 2, reps: 10, weight: 20  },
        { name: 'Lateral Raise',          sets: 2, reps: 15, weight: 10  },
      ],
    }],
  },

  // ── Cardio ────────────────────────────────────────────────────────────────
  {
    name: 'HIIT Circuit',
    description: '20-minute high intensity interval training. Bodyweight and cardio machines.',
    blocks: [
      {
        type: 'calisthenics',
        exercises: [
          { name: 'Burpee',         sets: 4, reps: 10 },
          { name: 'Jump Squat',     sets: 4, reps: 15 },
          { name: 'Mountain Climber', sets: 4, durationSeconds: 30 },
          { name: 'Push-Up',        sets: 4, reps: 15 },
        ],
      },
    ],
  },
  {
    name: 'Steady State Cardio',
    description: '30-40 minutes moderate cardio. Zone 2 aerobic training.',
    blocks: [{
      type: 'cardio',
      exercises: [
        { name: 'Treadmill Run',    sets: 1, durationSeconds: 2400, distance: 5 },
      ],
    }],
  },
  {
    name: 'Cardio + Core',
    description: 'Cardio warm-up followed by core conditioning.',
    blocks: [
      {
        type: 'cardio',
        exercises: [
          { name: 'Treadmill Run',   sets: 1, durationSeconds: 1200, distance: 2.5 },
        ],
      },
      {
        type: 'calisthenics',
        exercises: [
          { name: 'Plank',          sets: 3, durationSeconds: 60 },
          { name: 'Crunch',         sets: 3, reps: 20 },
          { name: 'Leg Raise',      sets: 3, reps: 15 },
          { name: 'Russian Twist',  sets: 3, reps: 20 },
        ],
      },
    ],
  },

  // ── Programs: Push/Pull/Legs ───────────────────────────────────────────────
  {
    name: 'PPL — Push',
    description: 'Push/Pull/Legs program — push day. 6-day split.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Bench Press',        sets: 4, reps: 8,  weight: 80 },
        { name: 'Overhead Press',             sets: 3, reps: 8,  weight: 50 },
        { name: 'Incline Dumbbell Fly',       sets: 3, reps: 12, weight: 20 },
        { name: 'Lateral Raise',              sets: 4, reps: 15, weight: 10 },
        { name: 'Tricep Pushdown',            sets: 3, reps: 12, weight: 30 },
        { name: 'Overhead Tricep Extension',  sets: 3, reps: 12, weight: 20 },
      ],
    }],
  },
  {
    name: 'PPL — Pull',
    description: 'Push/Pull/Legs program — pull day. 6-day split.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Deadlift',   sets: 4, reps: 5,  weight: 120 },
        { name: 'Pull-Up',            sets: 3, reps: 8              },
        { name: 'Barbell Row',        sets: 3, reps: 8,  weight: 80  },
        { name: 'Face Pull',          sets: 3, reps: 15, weight: 20  },
        { name: 'Barbell Curl',       sets: 3, reps: 10, weight: 35  },
        { name: 'Hammer Curl',        sets: 3, reps: 12, weight: 15  },
      ],
    }],
  },
  {
    name: 'PPL — Legs',
    description: 'Push/Pull/Legs program — leg day. 6-day split.',
    blocks: [{
      type: 'resistance',
      exercises: [
        { name: 'Barbell Back Squat',   sets: 4, reps: 8,  weight: 100 },
        { name: 'Romanian Deadlift',    sets: 3, reps: 10, weight: 80  },
        { name: 'Leg Press',            sets: 3, reps: 12, weight: 130 },
        { name: 'Leg Extension',        sets: 3, reps: 15, weight: 55  },
        { name: 'Lying Leg Curl',       sets: 3, reps: 12, weight: 45  },
        { name: 'Standing Calf Raise',  sets: 4, reps: 20, weight: 50  },
      ],
    }],
  },

  // ── Stretching / Recovery ─────────────────────────────────────────────────
  {
    name: 'Full Body Stretch',
    description: 'Head-to-toe flexibility routine. 30-40 minutes.',
    blocks: [{
      type: 'stretching',
      exercises: [
        { name: 'Chest Stretch',            sets: 2, durationSeconds: 30 },
        { name: 'Shoulder Cross-Body Stretch', sets: 2, durationSeconds: 30 },
        { name: 'Tricep Stretch',           sets: 2, durationSeconds: 30 },
        { name: 'Hip Flexor Stretch',       sets: 2, durationSeconds: 45 },
        { name: 'Hamstring Stretch',        sets: 2, durationSeconds: 45 },
        { name: 'Quad Stretch',             sets: 2, durationSeconds: 30 },
        { name: 'Calf Stretch',             sets: 2, durationSeconds: 30 },
        { name: 'Child\'s Pose',            sets: 2, durationSeconds: 60 },
      ],
    }],
  },
  {
    name: 'Post-Leg Recovery',
    description: 'Lower body recovery stretching. Best after leg day.',
    blocks: [{
      type: 'stretching',
      exercises: [
        { name: 'Hip Flexor Stretch',   sets: 3, durationSeconds: 45 },
        { name: 'Hamstring Stretch',    sets: 3, durationSeconds: 45 },
        { name: 'Quad Stretch',         sets: 3, durationSeconds: 30 },
        { name: 'Calf Stretch',         sets: 3, durationSeconds: 30 },
        { name: 'Glute Stretch',        sets: 2, durationSeconds: 45 },
        { name: 'Pigeon Pose',          sets: 2, durationSeconds: 60 },
      ],
    }],
  },
  {
    name: 'Upper Body Mobility',
    description: 'Shoulder and thoracic mobility work. Great pre or post upper session.',
    blocks: [{
      type: 'stretching',
      exercises: [
        { name: 'Chest Stretch',                sets: 3, durationSeconds: 30 },
        { name: 'Shoulder Cross-Body Stretch',  sets: 3, durationSeconds: 30 },
        { name: 'Tricep Stretch',               sets: 2, durationSeconds: 30 },
        { name: 'Doorway Stretch',              sets: 2, durationSeconds: 45 },
        { name: 'Cat-Cow',                      sets: 3, durationSeconds: 30 },
        { name: 'Thread the Needle',            sets: 2, durationSeconds: 45 },
      ],
    }],
  },
]

// ── Seed function ─────────────────────────────────────────────────────────────

export async function seedDefaultTemplates(trainerId: string): Promise<void> {
  // Check if trainer already has templates
  const existing = await db.query.templates.findFirst({
    where: eq(templates.trainerId, trainerId),
    columns: { id: true },
  })
  if (existing) return  // already seeded — skip

  console.log(`  📋 Seeding ${DEFAULT_TEMPLATES.length} default templates…`)

  // Collect all exercise names we need
  const allNames = new Set<string>()
  for (const t of DEFAULT_TEMPLATES) {
    for (const block of t.blocks) {
      for (const ex of block.exercises) {
        allNames.add(ex.name)
      }
    }
  }

  // Look up IDs in one query
  const exerciseRows = await db.query.exercises.findMany({
    where: inArray(exercises.name, [...allNames]),
    columns: { id: true, name: true },
  })
  const exerciseByName = new Map(exerciseRows.map(e => [e.name, e.id]))

  let seeded = 0
  let skipped = 0

  for (const def of DEFAULT_TEMPLATES) {
    const [template] = await db.insert(templates).values({
      trainerId,
      name:        def.name,
      description: def.description,
    }).returning()

    if (!template) continue

    for (let bi = 0; bi < def.blocks.length; bi++) {
      const block = def.blocks[bi]
      if (!block) continue
      const [tw] = await db.insert(templateWorkouts).values({
        templateId:  template.id,
        workoutType: block.type,
        orderIndex:  bi,
      }).returning()

      if (!tw) continue

      for (let ei = 0; ei < block.exercises.length; ei++) {
        const ex = block.exercises[ei]
        if (!ex) continue
        const exerciseId = exerciseByName.get(ex.name)
        if (!exerciseId) {
          console.log(`    ⚠️  Exercise not found: "${ex.name}" — skipping`)
          skipped++
          continue
        }

        await db.insert(templateExercises).values({
          templateWorkoutId:     tw.id,
          exerciseId,
          orderIndex:            ei,
          targetSets:            ex.sets            ?? null,
          targetReps:            ex.reps            ?? null,
          targetWeight:          ex.weight          ?? null,
          targetWeightUnit:      'lbs',
          targetDurationSeconds: ex.durationSeconds ?? null,
          targetDistance:        ex.distance        ?? null,
        })
        seeded++
      }
    }
  }

  console.log(`  ✅ Templates seeded: ${DEFAULT_TEMPLATES.length} templates, ${seeded} exercises (${skipped} skipped — exercise name not found)`)
}
