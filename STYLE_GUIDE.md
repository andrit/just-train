# Style Guide

Coding conventions for TrainerApp. Follow these when writing new code or reviewing changes. The ESLint config enforces the mechanical rules — this guide covers the patterns and reasoning behind them.

---

## Core philosophy

**Functional over imperative.** Prefer pure functions, immutable data, and declarative patterns. Avoid classes, mutation, and side effects outside of designated boundaries (hooks, mutations, event handlers).

**Explicit over implicit.** Types should be declared. Imports should be used. Returns should be clear. If something is intentionally unused, prefix it with `_`.

**Small and focused.** Functions do one thing. Components render one concern. Files own one feature.

---

## Pre-commit checklist (run before every zip/push)

```
□ Every import is actually used in the file body
□ No ! non-null assertions — use ?? fallback or guard instead
□ Every JSX conditional with multiple children uses <> fragment
□ pnpm typecheck passes
□ pnpm lint passes
```

---

## TypeScript

### No non-null assertions
Never use `!` to assert a value is non-null. Use a guard or a fallback instead.

```ts
// ❌
const name = user!.name

// ✅
if (!user) return null
const name = user.name

// ✅
const name = user?.name ?? 'Unknown'
```

**Exception:** `eslint-disable-next-line @typescript-eslint/no-non-null-assertion` is acceptable when you can prove the value exists at runtime but TypeScript can't see it. Document why.

### No `as any` casts
Avoid `as any`. Use proper types, `as unknown as T`, or a typed helper.

```ts
// ❌
const result = (thing as any).value

// ✅
const result = (thing as { value: string }).value
```

**Exception:** `(app.log as any)` is isolated to `src/lib/logger.ts`. Everywhere else use `routeLog(app)`.

### Unused variables
Prefix intentionally unused variables with `_`.

```ts
// ❌ — will fail lint
const [value, setValue] = useState(0) // setValue never called

// ✅
const [value, _setValue] = useState(0)

// ✅ — better, just remove it
const [value] = useState(0)
```

### Type imports
Use `import type` for types that are only used as types.

```ts
import type { ClientResponse } from '@trainer-app/shared'
```

---

## React / JSX

### One parent element per JSX return
Multiple sibling elements must be wrapped in a fragment.

```tsx
// ❌ — parse error
return (
  condition && (
    <ComponentA />
    <ComponentB />
  )
)

// ✅
return (
  condition && (
    <>
      <ComponentA />
      <ComponentB />
    </>
  )
)
```

### Hooks
- All custom hooks live in `src/hooks/`
- Query hooks live in `src/lib/queries/`
- No hook calls inside conditions or loops
- `useEffect` deps arrays must be complete — use `eslint-disable-next-line react-hooks/exhaustive-deps` with a comment when intentionally omitting a dep

### No index keys
Don't use array index as a React key unless the list is static and never reordered.

```tsx
// ❌
items.map((item, i) => <Row key={i} />)

// ✅
items.map((item) => <Row key={item.id} />)

// ✅ — static list, acceptable with suppress
Array.from({ length: 4 }).map((_, i) => (
  // eslint-disable-next-line react/no-array-index-key
  <SkeletonCard key={i} />
))
```

### Component structure order
```tsx
// 1. Imports
// 2. Types / interfaces
// 3. Constants (outside component)
// 4. Component function
//   a. Hook calls (useState, useQuery, etc.)
//   b. Derived values
//   c. Event handlers
//   d. Effects (useEffect last)
//   e. Early returns (loading, error, empty)
//   f. Main return JSX
// 5. Sub-components (bottom of file)
```

---

## Backend (Fastify + Drizzle)

### Logging
Always use `routeLog(app)` — never `app.log` directly or `(app.log as any)`.

```ts
// ❌
;(app.log as any).error(error)
;app.log.error(error)

// ✅
;routeLog(app).error(error)
```

### Drizzle queries
- Use `.returning()` after insert/update, then guard the result
- Never use `!` on a Drizzle `.returning()` result

```ts
// ❌
const [row] = await db.insert(table).values(data).returning()
return row!.id

// ✅
const [row] = await db.insert(table).values(data).returning()
if (!row) return reply.status(500).send({ error: 'Insert failed' })
return row.id
```

### Route handler structure
```ts
app.post('/route', { schema: { ... } }, async (request, reply) => {
  const body = request.body as z.infer<typeof BodySchema>

  try {
    // 1. Auth/ownership check
    // 2. Business logic
    // 3. DB operations
    // 4. Return response
  } catch (error) {
    ;routeLog(app).error(error)
    return reply.status(500).send({ error: 'Descriptive message' })
  }
})
```

### New columns checklist
See CONTRIBUTING.md — always update schema, serializer, response schema, and test factory together.

---

## Functional patterns

### Prefer const and immutability
```ts
// ❌
let result = []
for (const item of items) {
  result.push(transform(item))
}

// ✅
const result = items.map(transform)
```

### Prefer early returns over nesting
```ts
// ❌
function process(x: Value | null) {
  if (x) {
    if (x.active) {
      return doWork(x)
    }
  }
  return null
}

// ✅
function process(x: Value | null) {
  if (!x) return null
  if (!x.active) return null
  return doWork(x)
}
```

### Pure helper functions
Extract repeated logic into named functions rather than inline expressions.

```ts
// ❌
const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`

// ✅
function daysAgoLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}
```

---

## File organisation

### Naming
- Components: `PascalCase.tsx`
- Hooks: `useFeatureName.ts`
- Utilities: `camelCase.ts`
- Types/schemas: `camelCase.ts`

### Import order (enforced by preference, not lint)
1. React
2. Third-party libraries
3. Internal — `@/` aliased imports
4. Relative imports
5. Type imports

### Shared lib files
- `lib/formatters.ts` — all display formatting (dates, durations, weights)
- `lib/exerciseLabels.ts` — all workout type / equipment / difficulty display maps
- Do not copy these locally — import from the shared file
