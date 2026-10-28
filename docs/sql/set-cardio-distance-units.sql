-- TrainerApp — label distance units on the standard public cardio machines (#21)
-- 2026-10-27
--
-- Data mutation → defaults to a BEGIN…ROLLBACK DRY RUN. Review the report the
-- SELECTs print, then change ROLLBACK to COMMIT at the bottom to apply.
-- Only sets distance_unit where it IS NULL, so a trainer's own edit is never
-- clobbered, and only on public library rows (trainer_id IS NULL). Idempotent.
--
-- Requires the column to exist first — run add-cardio-intensity-level-and-distance-unit.sql.
-- PROD (Railway): psql "<DATABASE_PUBLIC_URL>" -f docs/sql/set-cardio-distance-units.sql

BEGIN;

-- Names below match the PRODUCTION library (verified against a dry-run report
-- 2026-10-27) — which has drifted from exercises-library.json. Extra names that
-- only exist in the JSON are kept too so this is also correct after a fresh seed;
-- each UPDATE is guarded by distance_unit IS NULL so it never clobbers an edit.
UPDATE exercises SET distance_unit = 'mi'     WHERE distance_unit IS NULL AND trainer_id IS NULL AND name IN ('Treadmill Run', 'Treadmill Walk (Incline)', 'Outdoor Run', 'Cycling', 'Outdoor Cycling', 'Assault Bike', 'Elliptical');
UPDATE exercises SET distance_unit = 'trips'  WHERE distance_unit IS NULL AND trainer_id IS NULL AND name = 'Stationary Bike';
UPDATE exercises SET distance_unit = 'm'      WHERE distance_unit IS NULL AND trainer_id IS NULL AND name IN ('Rowing Machine', 'Ski Erg', 'Sprint Intervals', 'Sled Push', 'Sled Pull');
UPDATE exercises SET distance_unit = 'laps'   WHERE distance_unit IS NULL AND trainer_id IS NULL AND name IN ('Swimming', 'Swimming Laps');
UPDATE exercises SET distance_unit = 'floors' WHERE distance_unit IS NULL AND trainer_id IS NULL AND name = 'Stair Climber';

-- Report — what the public cardio library now looks like
SELECT name, equipment, distance_unit
FROM exercises
WHERE workout_type = 'cardio' AND trainer_id IS NULL
ORDER BY name;

-- Dry run by default. Change to COMMIT to apply.
ROLLBACK;
