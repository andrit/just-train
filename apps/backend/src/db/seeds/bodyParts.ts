// ------------------------------------------------------------
// seeds/bodyParts.ts
//
// Seeds the body_parts lookup table.
// Must run before exercises.ts since exercises reference body part IDs.
// The `name` column uses the bodyPartEnum values.
// ------------------------------------------------------------

import { db, bodyParts } from '../index'
import { eq } from 'drizzle-orm'

const BODY_PARTS = [
  { name: 'arms'      as const, displayOrder: 1 },
  { name: 'back'      as const, displayOrder: 2 },
  { name: 'chest'     as const, displayOrder: 3 },
  { name: 'core'      as const, displayOrder: 4 },
  { name: 'full_body' as const, displayOrder: 5 },
  { name: 'legs'      as const, displayOrder: 6 },
  { name: 'shoulders' as const, displayOrder: 7 },
]

export async function seedBodyParts(): Promise<void> {
  console.log('🌱 Seeding body parts…')

  const existing = await db.query.bodyParts.findMany()
  if (existing.length >= BODY_PARTS.length) {
    console.log('✅ Body parts already seeded — skipping')
    return
  }

  for (const bp of BODY_PARTS) {
    const exists = await db.query.bodyParts.findFirst({
      where: eq(bodyParts.name, bp.name),
    })
    if (!exists) {
      await db.insert(bodyParts).values(bp)
    }
  }

  console.log(`✅ Seeded ${BODY_PARTS.length} body parts`)
}
