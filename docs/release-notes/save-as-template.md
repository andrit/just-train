# Save as template — copies the plan, atomic, lossless

**Date:** 2026-09-14 · **Scope:** backend + frontend + migration (additive)

## The bug

`SessionPlanPanel.handleSaveAsTemplateConfirm` called `POST /templates { name }` and nothing else. A template row was created with no exercises, and the UI toasted "Template saved!". Every user who pressed it lost the plan they thought they had kept.

## What shipped

### `POST /templates/from-session` — `apps/backend/src/routes/templates.ts`
```ts
// body: { sessionId, name, description? }  (CreateTemplateFromSessionSchema, packages/shared)
const source = await db.query.sessions.findFirst({
  where: and(eq(sessions.id, body.sessionId), eq(sessions.trainerId, request.trainer.trainerId)),
  with:  { sessionExercises: { orderBy: sessionExercises.orderIndex } },
})
if (!source) return reply.status(404)…                 // not yours → not found
if (!source.sessionExercises.length) return reply.status(400)…   // never an empty template

const templateId = await db.transaction(async (tx) => {
  const [created] = await tx.insert(templates).values({ trainerId, name, type: 'session', description }).returning()
  const remap = createCircuitRemapper()
  await tx.insert(templateExercises).values(
    source.sessionExercises.map((se) => toTemplateExerciseRow(se, created.id, remap)),
  )
  return created.id
})
return reply.status(201).send(serializeDates(await loadTemplateDetail(templateId)))
```

### One field list — `apps/backend/src/lib/exerciseCopy.ts` (pure, unit-tested)
- `createCircuitRemapper()` — memoised source→fresh circuit id. Was duplicated verbatim in fork and apply.
- `toTemplateExerciseRow(src, templateId, remap)` / `toSessionExerciseRow(src, sessionId, remap, unilateralIds)` — the planning-field mapping. `toSessionExerciseRow` resolves a template's `trackPerSide: null` from laterality.

Used by all three copiers: from-session, `POST /templates/:id/fork`, and template application in `POST /sessions` (`loadTemplatePlan()` reads; the session + rows write in one `db.transaction`). Fork and apply were also loop-inserting without a transaction — both are now atomic.

### Migration — `template_exercises` gains the two session-only fields
```sql
ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "target_weight_step" real;
ALTER TABLE "template_exercises" ADD COLUMN IF NOT EXISTS "track_per_side" boolean;   -- NULL = inherit from laterality
```
`docs/sql/add-template-exercise-step-and-per-side.sql` (prod, idempotent). Generate the Drizzle migration locally: `cd apps/backend && npx drizzle-kit generate`. Schema: `db/schema/templates.ts`. Response: `TemplateExerciseResponseSchema` (+`targetWeightStep`, +`trackPerSide`, both `.nullable().default(null)`). Factory: `makeTemplateExercise`. Input: `AddTemplateExerciseSchema` accepts both; `CreateTemplateCircuitSchema` = `CreateCircuitSchema` (step no longer omitted).

### Frontend
- `lib/queries/templates.ts` — `useCreateTemplateFromSession()`.
- `components/session/SaveAsTemplateButton.tsx` — owns `NamePromptModal` + mutation + toasts; renders nothing without exercises.
- Mounted in `SessionHistoryPanel.tsx`, `pages/SessionHistoryPage.tsx` (beside `DeleteSessionButton`) and `SessionPlanPanel.tsx` (replaces the inline stub, its two state vars and its modal).
- `CircuitBuilderSheet.tsx` — `+ / set` ramp no longer hidden in template mode; one `targets` payload for both mutations.

### Security fix found on the way
`POST /sessions` applied `templateId` with no ownership check — any trainer could instantiate another's template by id. `loadTemplatePlan` now scopes to the owner and returns 404 before any row is written. Test: `sessions.test.ts` "returns 404 when the template is not found or belongs to another trainer".

## Tests
- `__tests__/lib/exerciseCopy.test.ts` — remapper (5) + both mappers (6).
- `__tests__/routes/templates.test.ts` — from-session: 401 / 400 body / 404 / 400 empty (no insert, no tx) / 201 field parity (step, per-side, cardio fields, nothing session-specific leaks) / circuit remap / description; fork: multi-row insert + tx.
- `__tests__/routes/sessions.test.ts` — apply: tx + remap; ownership 404 with no insert; per-side explicit-wins / null-inherits + step carried.
- Both route test mocks: `transaction: (fn) => fn(db)` so `tx.insert` calls are observed by the same spies.

## Verify (this container cannot run vitest / tsc / drizzle-kit)
```
cd apps/backend && npx drizzle-kit generate
pnpm --filter @trainer-app/shared build
pnpm typecheck
pnpm --filter backend test
pnpm lint
```
Prod: run the SQL above. Frontend: PWA fully closed and reopened **twice** before judging.

## Deliberately not done
- Authoring ramp / per-side in the template builder's per-exercise add form (columns exist; circuit builder exposes the ramp). `DEFERRED_ITEMS.md` → "Template builder — bracket circuit members + reorder contiguity".
- Copying `sessions.notes` / `sessionNotes` — day commentary, not plan.
- Save-as-template on list rows.
