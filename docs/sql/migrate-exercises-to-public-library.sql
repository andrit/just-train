-- TrainerApp — collapse per-trainer exercise copies into a single public library
-- 2026-07-27
--
-- Background: registration used to seed a PRIVATE per-trainer copy of the whole
-- library (seed-exercises.ts -> trainer_id set, is_public false). Visibility is
-- `trainer_id = current OR trainer_id IS NULL`, so a public row (trainer_id NULL)
-- is visible to everyone. This migration makes the library one shared public set.
--
-- Strategy (decided 2026-07-27): FULL DEDUP, keep genuinely-custom exercises private.
--   "Standard" name  = already has a public row, OR is owned by >= 2 trainers.
--   "Custom"  name   = owned by exactly one trainer and no public row -> LEFT PRIVATE.
-- For each standard name: pick ONE canonical public row, repoint every
-- session/template/challenge/media reference to it, delete the duplicate copies.
--
-- FK note: session_exercises.exercise_id and template_exercises.exercise_id are
-- ON DELETE RESTRICT, so references MUST be repointed before deleting duplicates.
--
-- APPLIED TO PROD 2026-07-27. Defaults to ROLLBACK (dry run): running as-is prints the
-- before/after report and discards. Change the final ROLLBACK -> COMMIT to apply.
--
-- Run: psql "<DATABASE_PUBLIC_URL>" -f docs/sql/migrate-exercises-to-public-library.sql

BEGIN;

-- 0. Before snapshot
SELECT 'BEFORE' AS phase,
       count(*)                                       AS total,
       count(*) FILTER (WHERE trainer_id IS NULL)     AS public_rows,
       count(*) FILTER (WHERE trainer_id IS NOT NULL) AS owned_rows
FROM exercises;

-- 1. Standard names = already public, or duplicated across >= 2 trainers
CREATE TEMP TABLE standard_names ON COMMIT DROP AS
  SELECT name FROM exercises WHERE trainer_id IS NULL
  UNION
  SELECT name FROM exercises
   WHERE trainer_id IS NOT NULL
   GROUP BY name HAVING count(DISTINCT trainer_id) >= 2;

-- 2. Canonical row per standard name: prefer an existing public row, else the
--    lowest id among the owned copies (deterministic).
CREATE TEMP TABLE canonical ON COMMIT DROP AS
  SELECT name, id AS canonical_id FROM (
    SELECT e.id, e.name,
           row_number() OVER (
             PARTITION BY e.name
             ORDER BY (e.trainer_id IS NULL) DESC, e.id
           ) AS rn
    FROM exercises e
    WHERE e.name IN (SELECT name FROM standard_names)
  ) ranked
  WHERE rn = 1;

-- 3. Promote the canonical rows to public (no-op for ones already public)
UPDATE exercises SET trainer_id = NULL, is_public = true
WHERE id IN (SELECT canonical_id FROM canonical);

-- 4. Remap: every non-canonical row of a standard name -> its canonical id
CREATE TEMP TABLE remap ON COMMIT DROP AS
  SELECT e.id AS old_id, c.canonical_id
  FROM exercises e
  JOIN canonical c ON c.name = e.name
  WHERE e.id <> c.canonical_id;

-- Safety check: any media on rows we're about to delete would otherwise be
-- repointed to the public row (see below). Report it so it's a conscious choice.
SELECT 'media_on_duplicates' AS note, count(*) AS cnt
FROM exercise_media m JOIN remap r ON m.exercise_id = r.old_id;

-- 5. Repoint all references off the duplicates and onto the canonical public row
UPDATE session_exercises  s  SET exercise_id = r.canonical_id FROM remap r WHERE s.exercise_id  = r.old_id;
UPDATE template_exercises t  SET exercise_id = r.canonical_id FROM remap r WHERE t.exercise_id  = r.old_id;
UPDATE challenges         ch SET exercise_id = r.canonical_id FROM remap r WHERE ch.exercise_id = r.old_id;
UPDATE exercise_media     m  SET exercise_id = r.canonical_id FROM remap r WHERE m.exercise_id  = r.old_id;

-- 6. Delete the now-orphaned duplicate copies
DELETE FROM exercises WHERE id IN (SELECT old_id FROM remap);

-- 7. After snapshot + what remains private (should be only genuine custom exercises)
SELECT 'AFTER' AS phase,
       count(*)                                       AS total,
       count(*) FILTER (WHERE trainer_id IS NULL)     AS public_rows,
       count(*) FILTER (WHERE trainer_id IS NOT NULL) AS owned_rows
FROM exercises;

SELECT 'remaining private (custom)' AS note, trainer_id, name
FROM exercises WHERE trainer_id IS NOT NULL ORDER BY trainer_id, name;

-- Change ROLLBACK -> COMMIT to apply. (Already applied to prod 2026-07-27.)
ROLLBACK;
