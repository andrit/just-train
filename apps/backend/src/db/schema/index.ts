// ------------------------------------------------------------
// schema/index.ts — Schema barrel export
//
// Drizzle Kit (migration CLI) and the Drizzle client both
// require a single entry point that exports ALL table definitions.
// This file is referenced in drizzle.config.ts.
//
// Import order matters for circular reference avoidance:
//   trainers (no deps) → client-goals / client-snapshots (need trainers)
//   → exercises (needs trainers)
//   → templates (needs trainers + exercises)
//   → sessions (needs all above)
//   → auth (needs trainers)
// ------------------------------------------------------------

export * from './trainers'
export * from './client-goals'
export * from './client-snapshots'
export * from './trainer-usage-monthly'
export * from './exercises'
export * from './templates'
export * from './sessions'
export * from './auth'       // Phase 2: refresh tokens
