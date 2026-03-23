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

## Hotfix checklist

Before pushing a hotfix with schema changes:

```bash
cd apps/backend && pnpm db:push    # apply schema to local DB
pnpm typecheck                     # must pass before push
```

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
