# Contributing

Development rules, patterns, and gotchas for TrainerApp.
Keep this file updated as new patterns emerge.

---

## Adding a new column to an existing table

Any time you add a column to a Drizzle schema, there are **four places that must all be updated in the same commit**. Missing any one of them will cause either a runtime error or a CI typecheck failure.

**Checklist:**

- [ ] **Schema file** — add the column with a `.default()` value  
  e.g. `apps/backend/src/db/schema/trainers.ts`

- [ ] **Serializer function** — add the field to the relevant `serialize*` function in the route file  
  e.g. `serializeTrainer()` in `apps/backend/src/routes/auth.ts`  
  Use `?? defaultValue` to guard against null on existing rows.

- [ ] **Shared response schema** — add the field to the Zod schema in `packages/shared/src/schemas/response-schemas.ts`  
  Use `.default(value)` not `.optional()` for fields with a DB default — this coerces null from existing rows rather than throwing a validation error.

- [ ] **Test factory** — add the field to the relevant `make*` function in `apps/backend/src/__tests__/helpers/factories.ts`  
  Use `as const` for union types to satisfy TypeScript narrowing.

**Also required but not always in the same commit:**

- `pnpm db:push` — applies the column to the local database
- Backfill SQL for existing rows if the column is `NOT NULL` without a DB-level default on existing data:
  ```sql
  UPDATE table_name SET column_name = 'default_value' WHERE column_name IS NULL;
  ```
  Note: if the Zod schema uses `.default()`, the app won't crash without the backfill — but the DB should be kept clean.

---

## Adding a new preference field

Preferences live in the `trainers` table and flow through several layers.
When adding a new preference, update all of these:

- [ ] `apps/backend/src/db/schema/trainers.ts` — add column with `.default()`
- [ ] `apps/backend/src/routes/auth.ts` — `serializeTrainer()` return object
- [ ] `packages/shared/src/schemas/response-schemas.ts` — `TrainerResponseSchema`
- [ ] `apps/frontend/src/hooks/usePreferences.ts` — `Preferences` interface, defaults object, `UpdateablePrefs` interface
- [ ] `apps/frontend/src/pages/PreferencesPage.tsx` — UI control
- [ ] `apps/backend/src/__tests__/helpers/factories.ts` — `makeTrainer()`

---

## Adding a new field to a response schema

When adding a field to any `*ResponseSchema` in `packages/shared`:

- Check whether the field is already being returned by the backend route's serializer
- If not, add it to the serializer
- Check whether any test factory creates objects of that type — update those too
- Use `.default()` for fields that may be null on existing rows

---

## Joining exercises in Drizzle queries

**Always include `media: true` when joining exercises.** The `ExerciseSummaryResponseSchema` requires a `media` array — omitting it causes a `ResponseValidationError` at runtime even though the DB query succeeds.

```ts
// ✅ Correct
with: { exercise: { with: { bodyPart: true, media: true } } }

// ❌ Will cause ResponseValidationError — media field missing
with: { exercise: { with: { bodyPart: true } } }
with: { exercise: true }
```

This applies everywhere an exercise is joined: session detail, template detail, fork endpoint, any future route that returns exercise data nested inside another resource.

---

Before pushing a hotfix with schema changes:

```bash
cd apps/backend && pnpm db:push    # apply schema to local DB
pnpm typecheck                     # must pass before push
```

---

## Test-driven development (backend routes)

New backend routes use TDD. Write the test file before the implementation.

**The rule:** if you're adding a new route file, create `__tests__/routes/<name>.test.ts` first.
If you're adding an endpoint to an existing route file, add its test cases first.

**What to cover per endpoint (minimum):**

- [ ] 401 with no auth token
- [ ] Happy path — correct input → expected response shape
- [ ] 404 when resource doesn't exist or belongs to another trainer
- [ ] 400 / 422 for invalid input (missing required fields, wrong types)
- [ ] Any business rule the route enforces (ownership check, status transition, etc.)

**How to start a new route test file:**

```ts
// __tests__/routes/things.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { build<Thing>TestApp } from '../helpers/buildApp'  // or add to buildApp.ts
import { makeTrainer, makeThing } from '../helpers/factories'

vi.mock('../../db', async (importOriginal) => { /* see auth.test.ts for pattern */ })
vi.mock('../../services/auth.service', async (importOriginal) => { /* ... */ })

describe('GET /things', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without auth', async () => { /* ... */ })
  it('returns the thing list for the authenticated trainer', async () => { /* ... */ })
})
```

See `TESTING.md` for the full mock setup and `buildApp.ts` for the app builder pattern.

**When touching an existing untested route:** write characterization tests first (tests
that assert the current correct behaviour), then make your change. This is the boy-scout
rule — don't leave an area less tested than you found it.

**Frontend:** no component unit tests for now. E2E via Playwright is deferred to a
dedicated phase. Don't invest in React Testing Library infrastructure yet.

---

## Release checklist

Before tagging a release:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes  
- [ ] `README.md` version table updated
- [ ] `PROJECT_STATE.md` current version + roadmap updated
- [ ] `DEFERRED_ITEMS.md` reviewed — completed items marked, new deferred items added
- [ ] `CHANGELOG.md` entry written
- [ ] `pnpm db:push` run if schema changed
