# Timed / Distance-Cardio Exercise Redesign (#21)

**Date:** 2026-10-27
**Status:** code complete + typecheck/lint green; awaiting user migration + vitest + on-device QA.
**Plan:** `.workbench/designer/current/task-plan-timed-exercise.md`

## Why

Logging a stationary bike / treadmill / rower felt wrong: the UI auto-hid metrics and treated a
continuous timed effort as "fill in independent number boxes." Direction from the 2026-10-27
discussion: the machine already captures live, so the app's job is to **plan the target off-device
and record the result** — showing all four metrics (Time → Distance → Intensity → Rounds), with
intensity as a real machine number and rounds as intervals.

## What changed

### Data model (one migration, four nullable columns — all additive)
- `sets.intensity_level` — recorded numeric machine level.
- `session_exercises.target_intensity_level` / `template_exercises.target_intensity_level` — planned level.
- `exercises.distance_unit` — per-exercise distance label ("mi"/"m"/"trips").
- The low/moderate/high `intensity` enum columns are **kept** (outdoor/feel efforts + back-compat),
  just removed from the cardio UI. Subjective effort stays on `rpe`.

### Backend
- 4-file checklist run for each column: schema → serializer (spread-based, auto-carried) → shared
  response schema → test factory.
- Input schemas accept `intensityLevel` (log set), `targetIntensityLevel` (add/update session-exercise,
  add template-exercise), `distanceUnit` (create/update exercise).
- `lib/exerciseCopy.ts` — the single plan copier — carries `targetIntensityLevel`, so **apply a
  template / fork / save-as-template** all preserve it. Its enumerating unit test (the "forgot a
  column" check) updated.
- Seed: `exercises.ts` `buildInsert` maps `distanceUnit`; `exercises-library.json` cardio machines
  labelled (treadmill → mi, spin bike → trips, rower/ski-erg/swim/sprint/sled → m, stair → floors,
  cycling/assault/elliptical → mi).

### Frontend
- `ExerciseBlock.tsx` (live logging): distance-cardio shows Time (primary) → Distance (with unit) →
  Intensity (numeric), always. Each round logs as a set ("Round N"). Time + intensity prefill from
  target/last; distance recorded fresh (last as a hint). `detectCardioModes` / enum `IntensityPicker`
  removed. Rep-only cardio detected (`isRepOnlyCardio`) and left on its simple reps path.
- `AddExerciseSheet.tsx` (planning): `CardioTargets` is now Rounds + Time-per-round + numeric
  Intensity level. Distance is not planned (result-only). Metric-picker + enum picker removed.
- Display: `SessionExerciseBreakdown.tsx`, `SessionHistoryPage.tsx`, and `ExerciseBlock` past rows use
  `formatDistance(value, unit)` (new in `lib/formatters.ts`) and show "Lv N" for intensity level.

## Extensibility honored (not built)
- **Live round capture via an in-app timer** later: a round is a set and its time is `durationSeconds`
  — a timer just fills that field live. No typed-only / after-the-fact-only assumptions anywhere.
- **Strava / nutrition API I/O**: parked. Metrics kept first-class and cleanly mappable
  (moving-time/distance/avg-power → time/distance/intensity).

## Deferred
- **Per-round target planning accordion** — setting distinct targets per round upfront
  (e.g. 20 min high / 15 mid / 10 high). Intervals are entered live today (one round per set);
  pre-planning distinct per-round targets needs per-round target storage (comma-list columns).

## User steps to ship
1. `cd apps/backend && npx drizzle-kit generate` (commit the migration), then apply to prod:
   `psql "<DATABASE_PUBLIC_URL>" -f docs/sql/add-cardio-intensity-level-and-distance-unit.sql`.
2. Label prod cardio machines: review `docs/sql/set-cardio-distance-units.sql` (dry-run), flip
   `ROLLBACK` → `COMMIT`, run it.
3. `pnpm verify` (shared build → typecheck → vitest → lint).
4. `pnpm dev` / on device: log a bike at 10 min @ 15 (trips recorded), set rounds = 3 and log a
   3-segment interval, confirm "remember your usual" prefills next time, treadmill shows "mi", a
   rep-cardio / stretch exercise is unchanged.
