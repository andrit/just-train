-- TrainerApp — one-off prod cleanup: remove the redundant trainer-owned
-- "overhead face pulls" draft, superseded by the public "Overhead Face Pulls".
-- 2026-07-27
--
-- session_exercises.exercise_id and template_exercises.exercise_id are ON DELETE
-- RESTRICT, so any reference must be repointed before the draft can be deleted.
-- We repoint to the equivalent public row (same movement) so no history is lost.
--
-- Prod UUIDs (from the diagnostic on 2026-07-27):
--   draft  (delete): d32e4656-508b-4551-8790-dc7e85bf07a9  "overhead face pulls" (trainer-owned, body_part null)
--   public (keep)  : 595290c7-df73-4d42-890a-9618a3bd98c5  "Overhead Face Pulls" (trainer_id NULL, back)
--
-- Run:  psql "<DATABASE_PUBLIC_URL>" -f docs/sql/cleanup-overhead-face-pulls-draft.sql

BEGIN;

-- What references the draft? (echoed so the change is visible before it happens)
SELECT 'session_exercises' AS ref, count(*) FROM session_exercises  WHERE exercise_id = 'd32e4656-508b-4551-8790-dc7e85bf07a9'
UNION ALL
SELECT 'template_exercises', count(*) FROM template_exercises WHERE exercise_id = 'd32e4656-508b-4551-8790-dc7e85bf07a9'
UNION ALL
SELECT 'challenges',         count(*) FROM challenges         WHERE exercise_id = 'd32e4656-508b-4551-8790-dc7e85bf07a9';

-- Repoint references to the public equivalent (RESTRICT tables)
UPDATE session_exercises  SET exercise_id = '595290c7-df73-4d42-890a-9618a3bd98c5'
  WHERE exercise_id = 'd32e4656-508b-4551-8790-dc7e85bf07a9';
UPDATE template_exercises SET exercise_id = '595290c7-df73-4d42-890a-9618a3bd98c5'
  WHERE exercise_id = 'd32e4656-508b-4551-8790-dc7e85bf07a9';
-- challenges.exercise_id is ON DELETE SET NULL; repoint too so the challenge keeps its exercise link
UPDATE challenges         SET exercise_id = '595290c7-df73-4d42-890a-9618a3bd98c5'
  WHERE exercise_id = 'd32e4656-508b-4551-8790-dc7e85bf07a9';

-- Delete the draft (exercise_media rows for it, if any, cascade automatically)
DELETE FROM exercises WHERE id = 'd32e4656-508b-4551-8790-dc7e85bf07a9';

-- Verify it's gone and only the public row remains
SELECT id, name, is_public, trainer_id FROM exercises WHERE name ILIKE '%overhead face pull%' ORDER BY name;

COMMIT;
