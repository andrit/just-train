// ------------------------------------------------------------
// db/seed-exercises.ts — Starter exercise library
//
// Seeded per-trainer on registration. Every trainer gets this
// full starter library. Existing trainers: pnpm seed:exercises
//
// Organised by workout type → body part → compound/isolation.
// Review and extend in the Exercise Library UI.
// ------------------------------------------------------------

import { db } from '.'
import { bodyParts, exercises } from './schema/exercises'
import { eq, and } from 'drizzle-orm'
import { seedDefaultTemplates } from './seeds/defaultTemplates'

// ── Body part seed (run once — no trainerId needed) ───────────────────────────

export async function seedBodyParts(): Promise<Record<string, string>> {
  const rows = [
    { name: 'chest',      displayOrder: 1 },
    { name: 'back',       displayOrder: 2 },
    { name: 'shoulders',  displayOrder: 3 },
    { name: 'arms',       displayOrder: 4 },
    { name: 'legs',       displayOrder: 5 },
    { name: 'core',       displayOrder: 6 },
    { name: 'full_body',  displayOrder: 7 },
  ] as const

  const idMap: Record<string, string> = {}

  for (const row of rows) {
    // Upsert — safe to run multiple times
    const existing = await db.query.bodyParts.findFirst({
      where: eq(bodyParts.name, row.name),
    })
    if (existing) {
      idMap[row.name] = existing.id
    } else {
      const [inserted] = await db.insert(bodyParts).values(row).returning()
      if (inserted) idMap[row.name] = inserted.id
    }
  }

  return idMap
}

// ── Exercise definitions ──────────────────────────────────────────────────────

type ExerciseSeed = {
  name:        string
  description: string
  workoutType: 'resistance' | 'cardio' | 'calisthenics' | 'stretching' | 'cooldown'
  bodyPart:    'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full_body'
  equipment:   'none' | 'bodyweight' | 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'kettlebell' | 'resistance_band' | 'cardio_machine' | 'other'
  difficulty:  'beginner' | 'intermediate' | 'advanced'
  category?:   'compound' | 'isolation'
}

const LIBRARY: ExerciseSeed[] = [

  // ── RESISTANCE — CHEST ─────────────────────────────────────────────────────

  {
    name: 'Barbell Bench Press',
    description: 'Compound chest press. Lie on a flat bench, lower the bar to mid-chest, press to lockout.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'barbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Incline Barbell Bench Press',
    description: 'Compound upper-chest press on an incline bench (30–45°). Targets upper pecs and front delts.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Decline Barbell Bench Press',
    description: 'Compound lower-chest press on a decline bench. Reduces shoulder involvement.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Dumbbell Bench Press',
    description: 'Compound chest press with dumbbells. Greater range of motion than barbell. Each side works independently.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'dumbbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Incline Dumbbell Press',
    description: 'Compound upper-chest press with dumbbells on an incline bench. Good for upper pec development.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'dumbbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Dumbbell Flye',
    description: 'Isolation chest movement. Arms arc wide and low, squeezing pecs at the top. Keep a slight bend in elbows.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Incline Dumbbell Flye',
    description: 'Isolation upper-chest flye on an incline bench. Stretches the upper pec under load.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'dumbbell', difficulty: 'intermediate', category: 'isolation',
  },
  {
    name: 'Cable Crossover',
    description: 'Isolation cable chest fly. Cables from high pulleys, arms sweep down and together. Constant tension throughout.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Pec Deck',
    description: 'Isolation chest machine. Arms on pads sweep inward. Safe for beginners, good for pump sets.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'machine', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Chest Dip',
    description: 'Compound chest and tricep movement. Lean forward to emphasise chest. Lower until elbows reach 90°.',
    workoutType: 'resistance', bodyPart: 'chest', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },

  // ── RESISTANCE — BACK ──────────────────────────────────────────────────────

  {
    name: 'Conventional Deadlift',
    description: 'Compound full-posterior-chain movement. Hip-width stance, bar over mid-foot, hinge and pull. King of back exercises.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Barbell Row',
    description: 'Compound horizontal pull. Hip-hinged, overhand grip, bar pulled to lower sternum. Builds thickness in mid-back.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Pendlay Row',
    description: 'Strict barbell row where the bar returns to the floor between reps. More explosive than standard barbell row.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Dumbbell Row',
    description: 'Compound single-arm horizontal pull. Brace on a bench, row to hip. Allows heavy loading with minimal lower-back stress.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'dumbbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Lat Pulldown',
    description: 'Compound vertical pull on a cable machine. Wide overhand grip, pull bar to upper chest, controlled return.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'cable', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Seated Cable Row',
    description: 'Compound horizontal cable pull. Neutral grip, pull to abdomen, squeeze shoulder blades together at peak.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'cable', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'T-Bar Row',
    description: 'Compound mid-back builder. Straddle the barbell, neutral grip on handle, row to chest.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Face Pull',
    description: 'Isolation rear-delt and upper-back movement on a cable machine. Pull rope to face level, elbows high.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Straight-Arm Pulldown',
    description: 'Isolation lat movement on a cable. Arms straight, sweep bar from overhead to hips. Great lat activation.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Hyperextension',
    description: 'Isolation lower-back and glute movement on a GHD or back extension bench.',
    workoutType: 'resistance', bodyPart: 'back', equipment: 'machine', difficulty: 'beginner', category: 'isolation',
  },

  // ── RESISTANCE — SHOULDERS ─────────────────────────────────────────────────

  {
    name: 'Barbell Overhead Press',
    description: 'Compound shoulder press. Bar racked at shoulder height, press overhead to full lockout. Also called the strict press.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Dumbbell Shoulder Press',
    description: 'Compound shoulder press with dumbbells. Can be seated or standing. Each side works independently.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'dumbbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Arnold Press',
    description: 'Compound dumbbell press with a rotation — start with palms facing you, rotate outward as you press up.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'dumbbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Push Press',
    description: 'Compound overhead press using a leg drive to initiate. Heavier than strict press, good for power development.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Dumbbell Lateral Raise',
    description: 'Isolation side-delt movement. Arms sweep out to shoulder height. Slight forward lean optional. High reps work well.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Cable Lateral Raise',
    description: 'Isolation side-delt movement using a low cable. Constant tension throughout the range. Good for unilateral work.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Dumbbell Front Raise',
    description: 'Isolation front-delt movement. Raise one or both arms to shoulder height, palms down.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Rear Delt Flye',
    description: 'Isolation rear-delt movement. Hinge forward, arms sweep wide. Targets often-neglected posterior delts.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Upright Row',
    description: 'Compound shoulder and trap movement. Bar or cable pulled up close to the body to chin height.',
    workoutType: 'resistance', bodyPart: 'shoulders', equipment: 'barbell', difficulty: 'beginner', category: 'compound',
  },

  // ── RESISTANCE — ARMS ──────────────────────────────────────────────────────

  {
    name: 'Barbell Curl',
    description: 'Compound bicep curl with a barbell. Both arms curl simultaneously. Allows heavier loading than dumbbells.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'barbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Dumbbell Curl',
    description: 'Isolation bicep curl with dumbbells. Can be done seated or standing, alternating or simultaneous.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Hammer Curl',
    description: 'Isolation bicep curl with a neutral (hammer) grip. Works the brachialis and brachioradialis more than standard curls.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Incline Dumbbell Curl',
    description: 'Isolation curl on an incline bench. Extended range of motion at the bottom for a deeper bicep stretch.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'dumbbell', difficulty: 'intermediate', category: 'isolation',
  },
  {
    name: 'Preacher Curl',
    description: 'Isolation bicep curl on a preacher bench. Eliminates momentum, isolates the bicep fully.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'barbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Cable Curl',
    description: 'Isolation bicep curl on a cable machine. Constant tension throughout. Good for finisher sets.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Close-Grip Bench Press',
    description: 'Compound tricep and chest movement. Hands shoulder-width on a barbell, elbows track close to the body.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Tricep Pushdown',
    description: 'Isolation tricep movement on a cable. Push bar or rope down to full extension, elbows fixed at sides.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Overhead Tricep Extension',
    description: 'Isolation tricep movement. Arms extend from behind the head. Maximises stretch on the long head of the tricep.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Skull Crusher',
    description: 'Isolation tricep movement lying on a bench. EZ bar or dumbbells lower toward the forehead, extend back up.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'barbell', difficulty: 'intermediate', category: 'isolation',
  },
  {
    name: 'Tricep Kickback',
    description: 'Isolation tricep movement. Hinge forward, upper arm parallel to floor, extend forearm back to lockout.',
    workoutType: 'resistance', bodyPart: 'arms', equipment: 'dumbbell', difficulty: 'beginner', category: 'isolation',
  },

  // ── RESISTANCE — LEGS ──────────────────────────────────────────────────────

  {
    name: 'Barbell Back Squat',
    description: 'Compound lower-body movement. Bar on upper traps, squat to parallel or below. Primary quad and glute builder.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Front Squat',
    description: 'Compound squat with bar held on front delts. More upright torso, higher quad demand than back squat.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'barbell', difficulty: 'advanced', category: 'compound',
  },
  {
    name: 'Romanian Deadlift',
    description: 'Compound hip hinge targeting hamstrings and glutes. Bar or dumbbells, slight knee bend, hinge to mid-shin.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Sumo Deadlift',
    description: 'Compound deadlift variation with a wide stance and toes turned out. Emphasises inner thighs and glutes.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Leg Press',
    description: 'Compound quad-dominant machine movement. Feet shoulder-width on the platform, press to full extension.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'machine', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Hack Squat',
    description: 'Compound quad-focused machine squat. More upright than a back squat, high quad activation.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'machine', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Barbell Lunge',
    description: 'Compound unilateral leg movement with a barbell. Step forward, lower back knee toward floor, drive up.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'barbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Dumbbell Lunge',
    description: 'Compound unilateral leg movement with dumbbells. Easier to balance than barbell, good for beginners.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'dumbbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Bulgarian Split Squat',
    description: 'Compound unilateral squat. Rear foot elevated on a bench, drop the back knee toward the floor. Brutal quad and glute builder.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'dumbbell', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Hip Thrust',
    description: 'Compound glute-dominant movement. Back on a bench, barbell across hips, drive hips to full extension.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'barbell', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Leg Extension',
    description: 'Isolation quad movement on a machine. Feet under the pad, extend to full lockout. Good for quad isolation.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'machine', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Leg Curl',
    description: 'Isolation hamstring movement on a machine (lying or seated). Curl to full flexion, controlled return.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'machine', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Standing Calf Raise',
    description: 'Isolation calf movement. Rise onto toes at full height, controlled descent. Can be done with barbell or machine.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'machine', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Seated Calf Raise',
    description: 'Isolation calf movement targeting the soleus. Knees bent at 90°, weight on thighs, raise onto toes.',
    workoutType: 'resistance', bodyPart: 'legs', equipment: 'machine', difficulty: 'beginner', category: 'isolation',
  },

  // ── RESISTANCE — CORE ──────────────────────────────────────────────────────

  {
    name: 'Cable Crunch',
    description: 'Isolation core movement. Kneel at a cable, rope overhead, crunch elbows toward knees.',
    workoutType: 'resistance', bodyPart: 'core', equipment: 'cable', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Ab Wheel Rollout',
    description: 'Compound core movement. From kneeling, roll the wheel forward to full extension, pull back. Demanding on the entire anterior core.',
    workoutType: 'resistance', bodyPart: 'core', equipment: 'other', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Hanging Leg Raise',
    description: 'Compound core movement. Hang from a bar, raise legs to parallel or above. Targets lower abs and hip flexors.',
    workoutType: 'resistance', bodyPart: 'core', equipment: 'other', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Weighted Sit-up',
    description: 'Isolation core movement with a plate held at chest. Full range of motion sit-up.',
    workoutType: 'resistance', bodyPart: 'core', equipment: 'other', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Pallof Press',
    description: 'Anti-rotation core movement using a cable. Press and hold, resist the rotational pull of the cable.',
    workoutType: 'resistance', bodyPart: 'core', equipment: 'cable', difficulty: 'beginner', category: 'compound',
  },

  // ── CARDIO — LOWER BODY ────────────────────────────────────────────────────

  {
    name: 'Treadmill Run',
    description: 'Steady-state or interval running on a treadmill. Set speed and incline to target intensity.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Outdoor Run',
    description: 'Running outdoors. Track distance, pace, and elevation via GPS. Most natural running form.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Stationary Bike',
    description: 'Cycling on a stationary bike. Low-impact alternative to running. Adjust resistance for intensity.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Outdoor Cycling',
    description: 'Cycling outdoors on a road or trail. Track distance and elevation. Full lower-body cardio.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'other', difficulty: 'beginner',
  },
  {
    name: 'Jump Rope',
    description: 'High-intensity lower-body cardio. Can be done at steady pace or intervals. Great calorie burn.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'other', difficulty: 'beginner',
  },
  {
    name: 'Stair Climber',
    description: 'Continuous stair-stepping machine. High glute and quad demand. Set duration or floors.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Elliptical',
    description: 'Low-impact full-body cardio machine. Mimics running without the impact. Good for recovery days.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Treadmill Walk (Incline)',
    description: 'Incline walking at 10–15° and 3–4mph. Surprisingly high calorie burn, easy on joints.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Box Jump',
    description: 'Explosive lower-body cardio. Jump onto a box, step down, repeat. Develops power and aerobic capacity.',
    workoutType: 'cardio', bodyPart: 'legs', equipment: 'other', difficulty: 'intermediate',
  },

  // ── CARDIO — UPPER BODY ────────────────────────────────────────────────────

  {
    name: 'Battle Ropes',
    description: 'High-intensity upper-body cardio. Alternating or simultaneous waves, slams, or circles. 20–40s intervals.',
    workoutType: 'cardio', bodyPart: 'arms', equipment: 'other', difficulty: 'intermediate',
  },
  {
    name: 'Rowing Machine',
    description: 'Full-body cardio with a strong upper-body component. Drive with legs, pull handle to chest. 500m splits as intensity guide.',
    workoutType: 'cardio', bodyPart: 'back', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Ski Erg',
    description: 'Upper-body cardio on a SkiErg machine. Pull handles down from overhead, mimics cross-country skiing.',
    workoutType: 'cardio', bodyPart: 'arms', equipment: 'cardio_machine', difficulty: 'intermediate',
  },
  {
    name: 'Assault Bike',
    description: 'Full-body cardio machine with moving handlebars. Extremely demanding. Use for sprint intervals.',
    workoutType: 'cardio', bodyPart: 'full_body', equipment: 'cardio_machine', difficulty: 'intermediate',
  },
  {
    name: 'Swimming Laps',
    description: 'Full-body low-impact cardio. Track laps or distance. Excellent for recovery or cross-training.',
    workoutType: 'cardio', bodyPart: 'full_body', equipment: 'other', difficulty: 'beginner',
  },

  // ── CALISTHENICS ───────────────────────────────────────────────────────────

  // Upper body
  {
    name: 'Push-up',
    description: 'Compound chest, tricep, and shoulder movement. Keep core tight, chest touches floor, full lockout at top.',
    workoutType: 'calisthenics', bodyPart: 'chest', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Wide Push-up',
    description: 'Push-up with hands wider than shoulder-width. Increased chest activation, reduced tricep involvement.',
    workoutType: 'calisthenics', bodyPart: 'chest', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Diamond Push-up',
    description: 'Push-up with hands forming a diamond under the chest. Heavy tricep emphasis.',
    workoutType: 'calisthenics', bodyPart: 'arms', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Pike Push-up',
    description: 'Push-up in a pike position (hips high). Mimics an overhead press. Builds into handstand push-ups.',
    workoutType: 'calisthenics', bodyPart: 'shoulders', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Tricep Dip',
    description: 'Compound tricep and chest movement. Hands on a bench behind you, lower until elbows reach 90°.',
    workoutType: 'calisthenics', bodyPart: 'arms', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Pull-up',
    description: 'Compound vertical pull. Overhand grip, pull chest to bar. One of the most effective back exercises.',
    workoutType: 'calisthenics', bodyPart: 'back', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Chin-up',
    description: 'Compound vertical pull with an underhand grip. More bicep involvement than a pull-up.',
    workoutType: 'calisthenics', bodyPart: 'back', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Inverted Row',
    description: 'Compound horizontal pull. Bar set low, body angled, pull chest to bar. Scales for all levels.',
    workoutType: 'calisthenics', bodyPart: 'back', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Handstand Push-up',
    description: 'Compound overhead press against a wall. Kick up into a handstand, lower head toward floor, press up.',
    workoutType: 'calisthenics', bodyPart: 'shoulders', equipment: 'bodyweight', difficulty: 'advanced', category: 'compound',
  },

  // Lower body
  {
    name: 'Bodyweight Squat',
    description: 'Compound lower-body movement. Feet shoulder-width, squat to parallel, drive through heels to stand.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Jump Squat',
    description: 'Explosive squat with a jump at the top. Land softly and immediately drop into the next rep.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Reverse Lunge',
    description: 'Compound unilateral leg movement. Step backward, lower knee to floor, drive front foot to stand.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Pistol Squat',
    description: 'Single-leg squat to full depth. The non-working leg extends forward. High strength and mobility demand.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'advanced', category: 'compound',
  },
  {
    name: 'Wall Sit',
    description: 'Isometric quad hold. Thighs parallel to floor, back flat against wall. Hold for time.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Glute Bridge',
    description: 'Compound glute and hamstring movement. Lie on back, feet flat, drive hips to full extension. Hold 1s at top.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },

  // Core / HIIT
  {
    name: 'Plank',
    description: 'Isometric full anterior core hold. Forearms on floor, body straight from head to heels. Hold for time.',
    workoutType: 'calisthenics', bodyPart: 'core', equipment: 'bodyweight', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Side Plank',
    description: 'Isometric lateral core hold. Forearm on floor, body straight, hips off ground. Hold each side.',
    workoutType: 'calisthenics', bodyPart: 'core', equipment: 'bodyweight', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Mountain Climber',
    description: 'Dynamic core and cardio movement. Plank position, alternate driving knees to chest at speed.',
    workoutType: 'calisthenics', bodyPart: 'core', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Bicycle Crunch',
    description: 'Dynamic core movement with rotation. Alternate elbow to opposite knee, extend the other leg.',
    workoutType: 'calisthenics', bodyPart: 'core', equipment: 'bodyweight', difficulty: 'beginner', category: 'isolation',
  },
  {
    name: 'Hollow Body Hold',
    description: 'Isometric core compression. Arms overhead, lower back pressed to floor, legs raised and held.',
    workoutType: 'calisthenics', bodyPart: 'core', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Burpee',
    description: 'Full-body HIIT movement. Squat, kick back to push-up, jump feet forward, jump up with arms overhead.',
    workoutType: 'calisthenics', bodyPart: 'full_body', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Jumping Jack',
    description: 'Full-body warm-up or cardio movement. Jump feet wide as arms sweep overhead, return simultaneously.',
    workoutType: 'calisthenics', bodyPart: 'full_body', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'High Knees',
    description: 'Running in place with exaggerated knee drive. Hands at hip height as targets. Use for warm-up or intervals.',
    workoutType: 'calisthenics', bodyPart: 'legs', equipment: 'bodyweight', difficulty: 'beginner', category: 'compound',
  },
  {
    name: 'Bear Crawl',
    description: 'Quadrupedal movement. Hands and feet on floor, knees 2 inches off ground, crawl forward and back.',
    workoutType: 'calisthenics', bodyPart: 'full_body', equipment: 'bodyweight', difficulty: 'intermediate', category: 'compound',
  },
  {
    name: 'Turkish Get-up',
    description: 'Full-body movement from lying to standing with a weight held overhead. Exceptional shoulder stability demand.',
    workoutType: 'calisthenics', bodyPart: 'full_body', equipment: 'kettlebell', difficulty: 'advanced', category: 'compound',
  },
  {
    name: 'Kettlebell Swing',
    description: 'Explosive hip-hinge movement. Drive hips forward to swing the bell to shoulder height. Builds power and conditioning.',
    workoutType: 'calisthenics', bodyPart: 'full_body', equipment: 'kettlebell', difficulty: 'intermediate', category: 'compound',
  },

  // ── STRETCHING — LOWER BODY ────────────────────────────────────────────────

  {
    name: 'Hip Flexor Stretch',
    description: 'Kneeling lunge position, back knee on floor, shift hips forward. Hold each side. Essential after sitting or squatting.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Standing Quad Stretch',
    description: 'Stand on one foot, pull the other foot to glute. Hold 20–30s each side. Good post-run.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Supine Hamstring Stretch',
    description: 'Lying on back, raise one leg and gently pull it toward you. Keep the knee soft. Hold each side.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Standing Calf Stretch',
    description: 'Hands on wall, one foot back with heel down. Straight-leg and bent-knee variations target gastroc vs soleus.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Pigeon Pose',
    description: 'Yoga hip opener. Front shin angled across the mat, rear leg extended. Deep glute and hip stretch.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'intermediate',
  },
  {
    name: 'Figure Four Stretch',
    description: 'Lying on back, cross one ankle over opposite knee, pull both legs toward chest. Accessible glute stretch.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: '90-90 Hip Stretch',
    description: 'Seated with both knees bent at 90°, one in front, one to the side. Deeply stretches hip rotators and hip flexors.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'intermediate',
  },
  {
    name: 'Lizard Pose',
    description: 'Yoga low lunge with the front foot outside the hand. Intense hip flexor and groin stretch.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'intermediate',
  },
  {
    name: 'IT Band Stretch',
    description: 'Stand and cross one leg behind the other, lean sideways. Stretches the iliotibial band and outer hip.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Seated Forward Fold',
    description: 'Legs extended, hinge forward from hips reaching toward feet. Stretches hamstrings and lower back.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },

  // ── STRETCHING — UPPER BODY ────────────────────────────────────────────────

  {
    name: 'Chest Opener Stretch',
    description: 'Clasp hands behind back, squeeze shoulder blades together, lift arms. Opens the chest and front delts.',
    workoutType: 'stretching', bodyPart: 'chest', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Doorframe Chest Stretch',
    description: 'Place forearms on a doorframe, step forward. Stretches pecs and front delts. Hold 30s.',
    workoutType: 'stretching', bodyPart: 'chest', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Cross-body Shoulder Stretch',
    description: 'Pull one arm across the chest, hold above or below the elbow. Hold each side. Good post-pressing.',
    workoutType: 'stretching', bodyPart: 'shoulders', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Overhead Tricep Stretch',
    description: 'Raise one arm, bend at elbow behind head, use the other hand to push the elbow back.',
    workoutType: 'stretching', bodyPart: 'arms', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Lat Stretch',
    description: 'Grab a rack or door with one hand, drop hips away. Lengthens the lat. Hold each side.',
    workoutType: 'stretching', bodyPart: 'back', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Child\'s Pose',
    description: 'Yoga resting pose. Kneel and extend arms forward, forehead to floor. Stretches lats, lower back, and hips.',
    workoutType: 'stretching', bodyPart: 'back', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Cat-Cow',
    description: 'Yoga spinal mobility movement. On hands and knees, alternate arching and rounding the spine. 10 slow reps.',
    workoutType: 'stretching', bodyPart: 'back', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Supine Spinal Twist',
    description: 'Lying on back, bring one knee across the body while the arm extends the other way. Deep thoracic and hip stretch.',
    workoutType: 'stretching', bodyPart: 'back', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Thoracic Rotation Stretch',
    description: 'Seated or kneeling, hands behind head, rotate the upper back left and right. Improves pressing performance.',
    workoutType: 'stretching', bodyPart: 'back', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Neck Side Stretch',
    description: 'Drop one ear toward the shoulder, hold or apply gentle hand pressure. Hold each side 20–30s.',
    workoutType: 'stretching', bodyPart: 'shoulders', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Downward Dog',
    description: 'Yoga pose. Inverted V shape — hands and feet on floor, hips high. Stretches hamstrings, calves, and shoulders.',
    workoutType: 'stretching', bodyPart: 'full_body', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Cobra Pose',
    description: 'Yoga backbend. Lying face down, press up onto hands, chest lifts. Stretches abs and hip flexors.',
    workoutType: 'stretching', bodyPart: 'core', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Warrior I',
    description: 'Yoga standing pose. Front knee at 90°, rear leg straight, arms overhead. Hip flexor and calf stretch.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Warrior II',
    description: 'Yoga standing pose. Wide stance, front knee over ankle, arms extended in a T shape. Groin and hip opener.',
    workoutType: 'stretching', bodyPart: 'legs', equipment: 'none', difficulty: 'beginner',
  },

  // ── COOLDOWN ───────────────────────────────────────────────────────────────

  {
    name: 'Slow Treadmill Walk',
    description: '3–5 minutes at 2mph, no incline. Brings heart rate down gradually post-session.',
    workoutType: 'cooldown', bodyPart: 'legs', equipment: 'cardio_machine', difficulty: 'beginner',
  },
  {
    name: 'Box Breathing',
    description: 'Inhale for 4 counts, hold 4, exhale 4, hold 4. Activates parasympathetic recovery. 5–10 cycles.',
    workoutType: 'cooldown', bodyPart: 'full_body', equipment: 'none', difficulty: 'beginner',
  },
  {
    name: 'Foam Roll Quads',
    description: 'Lie prone, foam roller under thighs. Roll from hip to knee. Pause on tender spots 30–60s.',
    workoutType: 'cooldown', bodyPart: 'legs', equipment: 'other', difficulty: 'beginner',
  },
  {
    name: 'Foam Roll IT Band',
    description: 'Side-lying, roller under outer thigh from hip to knee. Often tender — move slowly.',
    workoutType: 'cooldown', bodyPart: 'legs', equipment: 'other', difficulty: 'beginner',
  },
  {
    name: 'Foam Roll Upper Back',
    description: 'Roller across upper back, arms crossed over chest. Roll between shoulder blades and mid-back.',
    workoutType: 'cooldown', bodyPart: 'back', equipment: 'other', difficulty: 'beginner',
  },
  {
    name: 'Foam Roll Calves',
    description: 'Seated, roller under calves, cross one leg over the other for added pressure. Roll slowly from ankle to knee.',
    workoutType: 'cooldown', bodyPart: 'legs', equipment: 'other', difficulty: 'beginner',
  },
]

// ── Seed function ─────────────────────────────────────────────────────────────

export async function seedExerciseLibrary(trainerId: string): Promise<{ seeded: number; skipped: number }> {
  // Get or create body parts
  const bodyPartMap = await seedBodyParts()

  let seeded  = 0
  let skipped = 0

  for (const ex of LIBRARY) {
    const bodyPartId = bodyPartMap[ex.bodyPart]
    if (!bodyPartId) continue

    // Idempotent — skip if trainer already has an exercise with this name
    const existing = await db.query.exercises.findFirst({
      where: and(
        eq(exercises.trainerId, trainerId),
        eq(exercises.name, ex.name),
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    await db.insert(exercises).values({
      trainerId,
      name:        ex.name,
      description: ex.description,
      workoutType: ex.workoutType,
      bodyPartId,
      equipment:   ex.equipment,
      difficulty:  ex.difficulty,
      category:    ex.category ?? null,
      isDraft:     false,
      isPublic:    false,
    })

    seeded++
  }

  // Seed default templates after exercises are available
  await seedDefaultTemplates(trainerId)

  return { seeded, skipped }
}
