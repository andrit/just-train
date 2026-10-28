# Timed / Distance-Cardio Exercise Redesign — Task Plan (#21)

**Phase goal (adhoc #21, Phase 19):** Make distance-cardio (run / bike / row) logging fit the
*record-after* model — the machine does live capture, the app plans the target off-device and
records what resulted. Show all four metrics for every such exercise, intensity as a real number,
rounds as an accordion of per-round segments.
**Written:** 2026-10-27

## Settled direction (from the 2026-10-27 discussion)

- **Record-after, not live.** No in-app clock. The app = plan target + record result.
- **Show all four, always** for distance-cardio, ordered by importance: **Time → Distance →
  Intensity → Rounds.** Time is the always-present one.
- **Intensity becomes a real number** (spin bike "15", rower damper, treadmill level). The
  `low/moderate/high/max` enum is dropped from the cardio UI; subjective effort stays covered by
  **RPE (1–10)**, which every set already carries. The enum columns are *kept* (non-destructive,
  still valid for outdoor/feel efforts + back-compat) — just not shown in the cardio editor.
- **Round = segment = set.** "20 min @ 15 / 15 min @ 11 / 10 min @ 15" is three sets. Rounds reuse
  the existing per-exercise set spine (rounds = target sets). 1 round collapses to a single
  time/distance/intensity entry; >1 opens an **accordion**, one row per round.
- **Distance carries a per-exercise unit label** ("trips" / "mi" / "m") stored on the exercise;
  the hardcoded "(m)" goes away.
- **Rep-counted cardio** (jumping jacks etc. — existing `reps` cardio mode) is **left untouched**;
  the four-element layout is for distance-cardio only.

## Design constraints (honor, don't build)

- **Live-capture extensibility.** A future update may capture rounds live via an in-app timer if a
  machine exposes an interface (wifi etc.). Keep per-round time capture **source-agnostic** — the
  field is `durationSeconds` on a set whether typed-after or timer-fed; no code may assume
  typed-only input or an after-the-fact-only flow. No live-only assumptions either.
- **External API I/O (Strava / nutrition) — parking lot, no action.** Noted only so we keep the
  cardio metrics first-class and cleanly mappable (Strava moving-time/distance/avg-power →
  time/distance/intensity). Discuss separately.

## Tasks

1. **Schema + migration — the one schema touch** *(medium)*
   What: add nullable columns, run the 4-file column checklist for each (schema → serializer →
   response schema → test factory). Keep every existing enum column.
   - `sets.intensityLevel` (integer, nullable) — the recorded machine level.
   - `sessionExercises.targetIntensityLevel` (integer, nullable) — the planned level.
   - `templateExercises.targetIntensityLevel` (integer, nullable) — template parity.
   - `exercises.distanceUnit` (text, nullable) — display label for distance ("mi"/"m"/"trips").
   Files: `apps/backend/src/db/schema/{sessions,templates,exercises}.ts`; serializers in
   `apps/backend/src/routes/sessions.ts` (set + sessionExercise) and the exercises route;
   `packages/shared/src/schemas/response-schemas.ts` (`SetResponseSchema`,
   `SessionExerciseResponseSchema`, `TemplateExerciseResponseSchema`, `ExerciseSummaryResponseSchema`);
   `apps/backend/src/__tests__/helpers/factories.ts`.
   Then `npx drizzle-kit generate` + a one-time prod SQL (BEGIN…ROLLBACK dry-run first) committed
   with the schema. **USER runs drizzle-kit + prod SQL; container can't.**
   Depends on: none. Foundation for 3–6.

2. **Input / validation schemas** *(low–medium)*
   What: accept the new fields. Add `intensityLevel` to the log-set input; `targetIntensityLevel`
   to session-exercise + template-exercise create/update inputs; `distanceUnit` to exercise
   create/update input. All optional/nullable.
   Depends on: 1.

3. **Cardio logging redesign — `ActiveSetHero` in `ExerciseBlock.tsx`** *(high)* — the core surface
   What: for distance-cardio, render all four, ordered Time → Distance → Intensity → Rounds.
   - **Intensity** becomes a numeric `BigInput` (replaces `IntensityPicker` in this path).
   - **Distance** label = `exercise.distanceUnit ?? 'Distance'`.
   - **Rounds = sets.** 1 round → single time/distance/intensity entry (today's simple log).
     Rounds > 1 → accordion: one row per round, each with its own time + intensity (+ distance),
     writing one set per round. Per-round time stays `durationSeconds` (see live-capture constraint).
   - Drop `detectCardioModes` auto-hide for distance-cardio (always show the four). Preserve the
     reps-cardio / stretching / cooldown / calisthenics branches unchanged.
   Depends on: 1, 2.

4. **Target editor (planning) — `AddExerciseSheet.tsx`** *(medium–high)*
   What: same four elements on the plan side — set target time + target intensity level (+ rounds).
   **"Remember your usual":** on add, prefill target time + intensity from the last session for this
   exercise (lean on the existing exercise-history prefill path; confirm it returns per-set values —
   Unknown #2).
   Depends on: 1, 2.

5. **Display surfaces** *(medium)*
   What: show numeric intensity, distance-with-unit, and per-round breakdown wherever cardio sets
   render: `SetRow.tsx`, `SessionExerciseBreakdown.tsx`, `SortableWorkoutList.tsx`, session history /
   timeline, and the formatters in `lib/formatters.ts` (distance unit, intensity number).
   Depends on: 1.

6. **Template parity — `TemplateBuilderSheet`** *(low–medium)*
   What: the same four-element cardio target editor on templates (`targetIntensityLevel`, rounds).
   Depends on: 1, 2, 4.

7. **Backend tests** *(medium)*
   What: factory carries the new fields; log-set round-trips `intensityLevel`; session-exercise +
   template-exercise carry `targetIntensityLevel`; exercise carries `distanceUnit`. Characterization
   test for existing cardio logging first (boy-scout) before changing serializers.
   Depends on: 1–2. **USER runs vitest.**

8. **QA on mobile** *(low)*
   What: on a phone — log a bike at 10 min @ 15; set rounds to 3 and log a 3-segment interval;
   distance shows "trips"; "remember your usual" prefills next time; treadmill shows "mi"; a
   rep-cardio / stretch exercise is unchanged.
   Depends on: 1–7. **USER runs on device.**

## Execution order

1 first (foundation + the only prod-SQL trip). 2 immediately after. Then 3 and 4 in parallel
(logging + planning), 5 alongside. 6 after 4. 7 tracks 1–2 and the serializer edits. 8 last.
Non-cardio branches and rep-cardio are never touched — strictly additive.

## Unknowns (confirm during build)

1. **Where `distanceUnit` is authored.** Proposed: stored on the exercise library record; seed
   sensible defaults for the standard machines (treadmill → "mi", rower → "m", spin bike → "trips"),
   expose in exercise edit/enrichment, fall back to a neutral "Distance" label when null. Confirm the
   seed defaults and whether per-exercise edit UI is in-scope now or a follow-on.
2. **Per-set history for "remember your usual."** Does `GET /clients/:id/exercise-history/:exerciseId`
   (v2.8.0 prefill path) return per-set values, or only the single most-recent set? Verify at task 4;
   intervals want per-round-index prefill.
3. **Rounds UX default.** Does the accordion show collapsed with a "+ round" affordance, or a rounds
   number that expands rows? Decide at task 3 against the real control sizes on mobile.

## Verification rules (this project)

- Container runs `tsc --noEmit` + `eslint` + `node`/`postcss.parse` only. **USER** runs `pnpm verify`,
  vitest, vite, `drizzle-kit generate`, and prod SQL + env.
- Column adds need prod SQL **before** push + `drizzle-kit generate`, migration committed with the
  schema; prod-mutating SQL defaults to `BEGIN…ROLLBACK`.
- Stage specific files; user commits + pushes. No new `:param` routes here (serializer edits only),
  so the G3 ownership-matrix / in-handler-enum guards don't apply — but re-check if a new route appears.
- Update `CHANGELOG.md`, `PROJECT_STATE.md`, `DEFERRED_ITEMS.md`, `GESTURE_GUIDE.md` (accordion is a
  new interaction), and a `docs/release-notes/` entry at step close.
