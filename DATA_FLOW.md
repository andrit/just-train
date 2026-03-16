# Data Flow Documentation

End-to-end data flow for every major operation in the Trainer App.

---

## Authentication Flow (Phase 2)

### Login
```
User submits email + password
  → POST /api/v1/auth/login
  → Rate limit check (10/15min per IP)
  → Zod validates body (LoginSchema)
  → DB: SELECT trainer WHERE email = $1
  → argon2.verify(password, passwordHash)
  → generateAccessToken(trainerId, role) → JWT (15 min)
  → generateRefreshToken() → random 48-byte hex + argon2 hash
  → DB: INSERT refresh_tokens (hash, deviceId, expiresAt)
  → DB: UPDATE trainers SET last_login_at = NOW()
  → Response: { accessToken, trainer } + Set-Cookie: httpOnly refresh token
  → Frontend: authStore.setAuth(accessToken, trainer)
  → Frontend: apiClient attaches Authorization: Bearer <token> on all requests
```

### Token Refresh (silent, automatic)
```
API returns 401 { code: 'TOKEN_EXPIRED' }
  → apiClient.attemptTokenRefresh()
  → POST /api/v1/auth/refresh (browser sends httpOnly cookie automatically)
  → Server: reads X-Trainer-ID + X-Device-ID headers
  → DB: SELECT refresh_tokens WHERE trainer_id + device_id + not expired
  → argon2.verify(rawToken, storedHash) for each candidate
  → rotateRefreshToken(): DELETE old row, INSERT new row (transaction)
  → generateAccessToken() → new JWT
  → Response: { accessToken, trainer } + new Set-Cookie
  → authStore.setAuth(newToken, trainer)
  → apiClient retries the original failed request
  → Transparent to the user — no interruption
```

### App Load (session restoration)
```
App mounts → AuthProvider.useEffect fires
  → GET /api/v1/auth/me (with current access token, if any)
  → If 401 TOKEN_EXPIRED: apiClient auto-refreshes via cookie → retries /auth/me
  → If refresh succeeds: authStore.setAuth() → user sees app normally
  → If all fails: authStore.clearAuth() → ProtectedRoute redirects to /login
  → isInitializing = false → spinner removed → app renders
```

---

## Resource Request Flow (Phase 2)

### Standard protected request
```
React component calls: useQuery({ queryFn: () => apiClient.get('/clients') })
  → apiClient.get('/clients')
  → Attaches Authorization: Bearer <accessToken> from authStore.getState()
  → Attaches X-Device-ID header
  → HTTP GET /api/v1/clients
  → Fastify: authenticate middleware
      → Extract + verify JWT
      → request.trainer = { trainerId, role }
  → Route handler:
      → db.select().from(clients).where(eq(trainerId, request.trainer.trainerId))
      → Fastify serializes response through ClientListResponseSchema (Zod)
        (strips any DB fields not in the schema — passwordHash can never leak)
  → Response JSON
  → TanStack Query stores in cache
  → React re-renders with data
```

---

## Session Tracking Flow

### Pre-planned session (from template)
```
Trainer opens "New Session" → selects client + template
  → POST /api/v1/sessions { clientId, templateId, date }
  → Server reads template → copies workouts + exercises with target values
  → Session status: "planned"
  → Frontend loads session detail (GET /sessions/:id) → full tree
  → On session day: PATCH /sessions/:id { status: "in_progress", startTime: now }
  → Trainer works through exercises, logs each set:
      → POST /session-exercises/:id/sets { reps, weight, rpe }
      → TanStack Query invalidates session cache → UI updates
  → Session end: PATCH /sessions/:id { status: "completed", endTime: now }
```

### Live-built session
```
Trainer taps "Start Session" → selects client
  → POST /api/v1/sessions { clientId, date, startTime: now }
  → Status: "in_progress" immediately (no template)
  → Trainer adds workout blocks as needed:
      → POST /sessions/:id/workouts { workoutType, orderIndex }
  → Trainer adds exercises to each block:
      → POST /workouts/:id/exercises { exerciseId, orderIndex }
  → Log sets in real time as exercises are performed
```

### Quick-add exercise mid-session
```
Trainer needs an exercise not in the library
  → POST /api/v1/exercises/quick-add { name, bodyPartId, workoutType }
  → Exercise created with isDraft: true
  → Immediately available to add to the session
  → Library shows "needs info" badge on draft exercises
  → Trainer enriches later: PATCH /exercises/:id { description, instructions }
```

---

## Offline Sync Flow (Phase 6 — not yet built)

```
Device goes offline during active session
  → apiClient fetch fails
  → Set is written to IndexedDB via syncLog
  → syncStore.addPendingSet() → badge count increments in UI
  → Workbox service worker queues background sync

Device comes back online
  → Workbox fires sync event
  → App reads pending sets from IndexedDB
  → Replays each operation against the server in order
  → Server deduplicates using localId
  → syncStore.clearPendingSet() → badge clears
```

---

## Schema → API → UI: One Source of Truth

```
packages/shared/src/enums/index.ts
  ↓ WorkoutTypeEnum, BodyPartEnum, etc.

packages/shared/src/schemas/index.ts (input schemas)
  ↓ CreateClientSchema → validates POST /clients body
  ↓ CreateSetSchema    → validates POST /sets body

packages/shared/src/schemas/response-schemas.ts
  ↓ ClientResponseSchema → Swagger docs + Fastify response serialization
  ↓ SetResponseSchema    → strips DB-only fields from responses

apps/backend/src/db/schema/*.ts
  ↓ Drizzle pgEnum uses Zod enum .options → DB + TS types in sync

apps/frontend/src/lib/api.ts
  ↓ apiClient.get<ClientResponse[]>('/clients')
  ↓ TypeScript type is inferred from shared schema → no manual typing
```
