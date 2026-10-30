# Exercise provenance — Yours vs the shared Library (#2)

**Date:** 2026-10-30 · **Phase:** 19 (Go Live) · **Status:** built, awaiting on-device QA

Second of the 3 → 2 → 1 exercise-library sequence (after #25, the type visual system). Surfaces the
distinction between a trainer's **own custom exercises** and the **shared public library**.

## The provenance signal: `trainer_id`

Settled on `trainer_id`, not `is_public`:

- The visibility filter already keys on it — `GET /exercises` returns `trainerId = me OR trainerId IS
  NULL`. So **every row in your list is either yours (`trainer_id` set) or public (`null`)**, and
  `trainerId != null ⇒ yours` needs no "current user" comparison.
- The detail panel already derives provenance this way (`!exercise.trainerId`).
- `is_public` is a documented *future multi-trainer* flag (set only by the seed + account-rehome); it is
  **not** used here. `trainer_id` also extends cleanly to a future third state (another trainer's
  shared exercise) that `is_public` can't express.

## The one data change

`ExerciseSummaryResponseSchema` did not carry `trainerId` (only the *detail* schema did), and the list
endpoint sends raw Drizzle rows — so `trainerId` was present in the row but **stripped by the response
schema**. Added it as `.nullable().optional()` (mirroring the existing `muscleRole` field):

```ts
trainerId: z.string().uuid().nullable().optional()
  .describe('Provenance: a trainer id = this trainer\'s custom exercise ("Yours"); null = shared public library.')
```

`.optional()` keeps the change non-cross-cutting: the summary is embedded in session/template
responses, and optional means any producer that omits it (partial-column joins) does not trip response
validation. Full-row producers (the library list, session/template joins) include it for free. No
serializer edits, no migration.

## UI

- **Filter** (`ExercisesPage`): an `All · Yours · Library` pill group beside the workout-type tabs.
- **Grouping:** when the result set contains both custom and library exercises (and no provenance
  filter is applied), the grid splits into labelled **"Your exercises"** and **"Library"** sections. A
  single-group result renders flat (no redundant header).
- **Badge** (`ExerciseCard`): a quiet neutral **"Yours"** pill on custom cards; library defaults are
  left unmarked (less visual noise). Stacks with the existing Draft badge top-left.

## Files

- `packages/shared/src/schemas/response-schemas.ts` — `trainerId` on the summary schema (shared
  rebuilt).
- `apps/frontend/src/pages/ExercisesPage.tsx` — provenance state, filter chips, grouped render.
- `apps/frontend/src/components/exercises/ExerciseCard.tsx` — "Yours" badge.

## Verification

frontend + backend tsc clean, eslint clean. Shared rebuilt (`tsc -p tsconfig.build.json`). Not yet
rendered — grouping, chips, and the badge need an on-device look in both themes; `pnpm verify` (vitest)
is the user's gate, and will exercise the session/template response tests that embed the summary schema.

## Not a blocker (data hygiene)

The earlier-noted prod dry-run (`SELECT trainer_id IS NULL, is_public, count(*) …`) is no longer a
prerequisite — the code keys off `trainer_id` only and never reads `is_public`. Worth running once as
hygiene to confirm the two agree, but nothing here depends on it.
