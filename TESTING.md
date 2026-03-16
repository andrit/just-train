# Testing

## Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner — TypeScript-native, Jest-compatible API, fast |
| **Fastify inject()** | In-process HTTP — no real server, no ports, fast and isolated |
| **vi.mock()** | Module-level mocking — DB and slow auth functions replaced per test file |

---

## Running Tests

```bash
# Run all tests once (used in CI)
pnpm --filter backend test

# Watch mode — re-runs on file save during development
pnpm --filter backend test:watch

# With coverage report
pnpm --filter backend test:coverage
# Coverage written to apps/backend/coverage/

# From repo root
pnpm test
```

---

## What Is Tested

### `services/auth.service.test.ts` — Pure unit tests, no mocking

The auth service contains the security-critical functions. These tests run against
the real argon2 and jsonwebtoken implementations — no mocks.

| Function | What's verified |
|----------|----------------|
| `hashPassword` | Returns a string, not the original password, salted (different hashes each call), argon2id prefix |
| `verifyPassword` | Correct password → true, wrong password → false, empty string → false, malformed hash → false (no throw), case-sensitive |
| `generateAccessToken` | Returns a 3-part JWT, encodes trainerId + role + type correctly |
| `verifyAccessToken` | Valid token → correct payload, invalid token → throws, expired → throws with "expired" message, wrong secret → throws, wrong type ("refresh") → throws |
| `generateRefreshToken` | Returns raw + hash, raw is hex ≥64 chars, hash is argon2id, raw verifies against its own hash, unique per call |

### `middleware/authenticate.test.ts` — Middleware isolation tests

Tests the preHandler in a minimal one-route Fastify app. The DB is mocked (import
chain requirement), but JWT verification uses the real implementation.

| Scenario | Expected |
|----------|---------|
| No Authorization header | 401 |
| Header not starting with "Bearer " | 401 |
| Garbage token string | 401 |
| Expired token | 401 + `code: TOKEN_EXPIRED` |
| Token signed with wrong secret | 401 |
| Token with type "refresh" | 401 |
| Valid token | 200 + `request.trainer` populated |
| trainerId in request.trainer | matches token |
| role in request.trainer | matches token |

### `routes/auth.test.ts` — Auth route integration tests

All auth endpoints tested via Fastify inject(). DB and slow auth functions mocked.
`generateAccessToken` / `verifyAccessToken` run real — routes issue real JWTs.

| Route | Scenarios covered |
|-------|------------------|
| `POST /auth/register` | 201 + token + trainer, 409 on duplicate email, 400 missing fields, 400 short password, httpOnly cookie set |
| `POST /auth/login` | 200 + token + trainer, 401 unknown email, 401 wrong password, same error message for both (prevents enumeration), 400 missing fields, 400 bad email format, httpOnly cookie set |
| `POST /auth/refresh` | 401 no cookie, 401 missing headers, 401 invalid token, 200 new token issued, rotateRefreshToken called, new httpOnly cookie set |
| `POST /auth/logout` | 401 without auth, 200 with auth, revokeRefreshToken called |
| `GET /auth/me` | 401 without auth, 200 with trainer profile, 404 if trainer deleted, passwordHash never in response |

### `routes/clients.test.ts` — Resource route pattern tests

Client routes are tested thoroughly because they represent the pattern used by
all four resource route files (clients, exercises, sessions, templates). When
these tests pass, the structural guarantees hold for the others too.

| Route | Scenarios covered |
|-------|------------------|
| `GET /clients` | 401 no auth, 401 bad token, 200 empty array, 200 with clients, WHERE clause called (ownership) |
| `GET /clients/:id` | 401, 200 found, 404 not found, 404 different trainer (ownership), 400 non-UUID param |
| `POST /clients` | 401, 201 created, trainerId from JWT not body (injection prevention), 400 missing name, 400 bad email |
| `PATCH /clients/:id` | 401, 200 updated, 404 not found, 400 non-UUID, partial update accepted |
| `DELETE /clients/:id` | 401, 204 success, 404 not found, soft-delete uses `update()` not `delete()` |

---

## Mock Strategy

### DB mock

All route tests mock `../../db` entirely. The Drizzle `db` object is replaced
with a chainable mock where each method returns `this` except the terminal
methods (`.returning()`, `.orderBy()`) which return Promises.

Tests control what the DB "returns" using `mockResolvedValueOnce()`:

```ts
// Make the DB return a specific client
vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())

// Make insert return the newly created record
;(db as any)._chain.returning.mockResolvedValueOnce([makeClient()])

// Make the DB return nothing (simulate not found)
vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
```

`vi.clearAllMocks()` runs in `beforeEach` so mock state never leaks between tests.

### Auth service mock

Route tests mock the slow/stateful auth service functions:

```ts
vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,                                            // keep real JWT functions
    hashPassword:  vi.fn().mockResolvedValue('$argon2id$mocked'),
    verifyPassword: vi.fn().mockResolvedValue(true),   // override per test
    generateRefreshToken: vi.fn().mockResolvedValue({ raw: '...', hash: '...' }),
    storeRefreshToken: vi.fn().mockResolvedValue(undefined),
    // ...etc
  }
})
```

`generateAccessToken` and `verifyAccessToken` are NOT mocked in route tests.
Routes issue real JWTs; the middleware verifies them with the real implementation.
This keeps the middleware tests honest.

---

## Test File Structure

```
apps/backend/src/__tests__/
├── setup.ts                          # Sets env vars before any module loads
├── helpers/
│   ├── factories.ts                  # makeTrainer(), makeClient(), validLoginBody, etc.
│   └── buildApp.ts                   # buildAuthTestApp(), buildClientTestApp(), dbMockFactory()
├── services/
│   └── auth.service.test.ts          # Pure function unit tests (no mocking)
├── middleware/
│   └── authenticate.test.ts          # Middleware isolation tests
└── routes/
    ├── auth.test.ts                  # Auth endpoint integration tests
    └── clients.test.ts               # Client endpoint tests (covers ownership pattern)
```

---

## Adding New Tests

### For a new service function
Add to `services/auth.service.test.ts` or create `services/<name>.service.test.ts`.
If the function is pure (no DB), no mocking needed.

### For a new route
Follow the pattern in `routes/clients.test.ts`:
1. `vi.mock('../../db', ...)` at the top
2. `buildXxxTestApp()` helper or add to `buildApp.ts`
3. One `describe` block per endpoint
4. `beforeEach(() => vi.clearAllMocks())`
5. Cover: 401 without auth, happy path, 404 not found, 400 bad input

### For a new middleware
Follow `middleware/authenticate.test.ts`: build a minimal one-route Fastify app
with only the middleware under test as a preHandler.

---

## What Is NOT Tested Here

| Concern | Why | When |
|---------|-----|------|
| Drizzle schema files | Drizzle's type system + pgEnum catches mistakes at compile time | Never needed |
| Frontend components | UI is stub pages; E2E tests make more sense | Phase 5 (Playwright) |
| Cloudinary upload flow | Requires network; mock-only tests give false confidence | Phase 3 integration tests |
| Full DB integration | Requires a real PostgreSQL instance | Phase 6 (Docker test DB) |
| Rate limiting | Infrastructure concern, not business logic; resets are fiddly to test | Phase 6 if needed |
