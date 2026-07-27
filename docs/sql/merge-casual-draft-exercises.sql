-- TrainerApp — merge 7 casual-named private draft exercises into their public
-- equivalents (repoint references, then delete the drafts).
-- 2026-07-27
--
-- These are informal quick-add drafts that shadow standard library exercises,
-- left private by migrate-exercises-to-public-library.sql (owned by one trainer,
-- no exact-name public match). Mapping confirmed with the user; "shrugs" -> Machine Shrugs.
--
-- FK note: session_exercises.exercise_id and template_exercises.exercise_id are
-- ON DELETE RESTRICT, so references are repointed to the public row before delete.
-- Resolution is by NAME (no hardcoded UUIDs): a draft with no matching public row
-- simply won't be remapped or deleted — this fails safe.
--
-- APPLIED TO PROD 2026-07-27. Defaults to ROLLBACK (dry run): running as-is prints the
-- mapping preview (7 rows) and the "remaining private" check (0 rows) and discards.
-- Change the final ROLLBACK -> COMMIT to apply.
--
-- Run: psql "<DATABASE_PUBLIC_URL>" -f docs/sql/merge-casual-draft-exercises.sql

BEGIN;

CREATE TEMP TABLE draft_map (draft_name text, public_name text) ON COMMIT DROP;
INSERT INTO draft_map VALUES
  ('good morning',  'Good Mornings'),
  ('hip abductors', 'Hip Abductors'),
  ('hip adductors', 'Hip Adductors'),
  ('hip flexors',   'Hip Flexors (Rotary Machine)'),
  ('yates rows',    'Yates Row'),
  ('pullups',       'Pull-up'),
  ('shrugs',        'Machine Shrugs');

-- Resolve each private draft row to its public target id
CREATE TEMP TABLE draft_remap ON COMMIT DROP AS
SELECT d.id AS old_id, p.id AS public_id, d.name AS draft_name, dm.public_name
FROM draft_map dm
JOIN exercises d ON d.name = dm.draft_name AND d.trainer_id IS NOT NULL
JOIN exercises p ON p.name = dm.public_name AND p.trainer_id IS NULL;

-- Preview the exact mapping being applied (expect 7 rows)
SELECT draft_name, public_name, old_id, public_id FROM draft_remap ORDER BY draft_name;

-- Repoint every reference off the drafts and onto the public rows
UPDATE session_exercises  s  SET exercise_id = r.public_id FROM draft_remap r WHERE s.exercise_id  = r.old_id;
UPDATE template_exercises t  SET exercise_id = r.public_id FROM draft_remap r WHERE t.exercise_id  = r.old_id;
UPDATE challenges         ch SET exercise_id = r.public_id FROM draft_remap r WHERE ch.exercise_id = r.old_id;
UPDATE exercise_media     m  SET exercise_id = r.public_id FROM draft_remap r WHERE m.exercise_id  = r.old_id;

-- Delete the drafts
DELETE FROM exercises WHERE id IN (SELECT old_id FROM draft_remap);

-- Verify: nothing private should remain
SELECT trainer_id, name FROM exercises WHERE trainer_id IS NOT NULL ORDER BY name;

-- Change ROLLBACK -> COMMIT to apply. (Already applied to prod 2026-07-27.)
ROLLBACK;
