# Security Assessment

Reviewed: April 2026. Pre-Go-Live gate opened 2026-09-14 (below). Full OWASP pass before v3.0.0.

---

## Current State by Area

### HTTPS
**Status: ✅ Covered by infrastructure**

Vercel (frontend) and Railway (backend) both enforce HTTPS automatically and redirect HTTP. No code changes needed. Cross-origin cookies use `secure: true` + `sameSite: 'none'` in production.

---

### Content Security Policy (CSP)
**Status: ⚠️ Partial — tighten before v3.0.0**

Backend: Helmet is registered and provides default CSP headers. CSP was relaxed to allow Swagger UI static assets — in production Swagger UI is disabled via dynamic import guard, so the relaxed policy is unnecessary overhead.

Frontend: No explicit CSP headers. Vercel serves static files without adding CSP by default.

**Planned fix (v2.14.0):** Add `headers` block to `vercel.json` to set `Content-Security-Policy` on the frontend. Example:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; connect-src 'self' https://*.railway.app https://res.cloudinary.com; img-src 'self' data: https://res.cloudinary.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        }
      ]
    }
  ]
}
```

---

### Authentication
**Status: ✅ Strong**

- Passwords: argon2id with `memoryCost: 65536`, `timeCost: 3` — current OWASP recommendation
- Access tokens: JWT, 15-minute TTL, signed with `JWT_SECRET`
- Refresh tokens: httpOnly cookie, 7-day TTL, argon2-hashed before storage, per-device rotation, revoked on logout
- Token rotation: old token invalidated on every refresh — stolen tokens can only be used once before becoming invalid
- Email enumeration: login returns identical error message whether email or password is wrong

**Not implemented (future consideration):**
- OAuth 2.0 / social login — deferred to post-v3.0.0
- WebAuthn / biometrics — deferred to post-v3.0.0
- Email verification — `emailVerified` column exists in schema, flow not yet built

---

### Rate Limiting
**Status: ✅ Implemented (gap fixed April 2026)**

Global limit: 100 requests/minute per IP via `@fastify/rate-limit` registered globally.

Auth-specific limits:
- `POST /auth/login` — 10 attempts per 15 minutes per IP ✅
- `POST /auth/register` — 5 attempts per 15 minutes per IP ✅ (fixed — was unlimited)
- `POST /auth/refresh` — covered by global limit only (acceptable — refresh uses a signed cookie, not guessable)

Key generator uses `X-Forwarded-For` header when behind a reverse proxy (Railway injects this).

---

### Input Validation
**Status: ✅ Strong**

Every request body validated with Zod schemas on both frontend (UX) and backend (security). Backend validates independently — frontend validation cannot be bypassed to reach the DB. Drizzle ORM uses parameterised queries throughout — no raw SQL string interpolation, no SQL injection surface.

---

### Sensitive Local Data Encryption
**Status: ⚠️ Not implemented — planned v2.14.0**

TanStack Query caches API responses in memory (Zustand + React state) — nothing written to `localStorage` or `IndexedDB` directly. However, the PWA service worker (Workbox) caches API responses per the runtime caching config in `vite.config.ts`:

```ts
{ urlPattern: /^https?:\/\/.*\/api\//, handler: 'NetworkFirst', ... }
```

This means session data, client data, and exercise logs can persist in the browser's Cache Storage API between sessions. No encryption is applied.

**Risk level:** Low for current scale. Cache Storage is origin-scoped (not accessible cross-origin) and requires device access to read. Higher risk if multiple people share a device.

**Planned fix (v2.14.0):** Exclude sensitive API routes from service worker caching, or switch to `NetworkOnly` for `/api/` routes and only cache static assets.

---

### Service Worker Scope
**Status: ✅ Secure**

VitePWA registers the service worker scoped to `/` on the app's origin. It only intercepts requests matching the app's own origin — no cross-origin interception. Workbox handles scope automatically with no custom configuration needed.

---

## Pre-Go-Live Security Gate (Phase 19 · opened 2026-09-14)

A lightweight gate before public registration; the full OWASP pass stays a v3.0 gate.
An item is done when it has a date. Items without one are open.

| # | Check | Status | Evidence |
|---|---|---|---|
| 4a | **Ownership matrix** — every parameterised route resolves the caller's ownership before acting | ✅ 2026-09-14 (static guard) · ⬜ real-DB matrix | Audit found **7 IDORs** (all in the session/template exercise tree — see What Was Fixed). Source-level guard `__tests__/security/ownership-guard.test.ts` fails on any route that never uses `request.trainer.trainerId` in a scoping shape; it failed on all seven before the fix. The SQL-level proof (seed trainer A, call as B, expect 404, against real Postgres) is still to build. |
| 4b | `pnpm audit` — no high/critical | ⬜ | run from repo root; record date + count here |
| 4c | Production surface — Swagger UI + `/documentation/json` absent, CSP + `Cache-Control: no-store` on `/api/*`, no debug routes | ⬜ | `curl -sI https://just-train-production.up.railway.app/documentation` → expect 404; `curl -sI …/api/v1/health` shows the headers |
| 4d | Secrets hygiene — rotate Railway Postgres password; `.env` never committed | ⬜ | `git log --all --diff-filter=A -- '*.env'` must be empty |
| 4e | Validation-before-auth (unauthenticated callers get field-level 400s) — decide: leave (documented) or `authenticate` as `onRequest` | ⬜ designer decision | |

## Roadmap

| Version | Security Work |
|---|---|
| v2.14.0 | Tighten CSP via `vercel.json` headers |
| v2.14.0 | Restrict service worker caching — exclude `/api/` from Cache Storage |
| v2.14.0 | Review Helmet CSP in production (remove Swagger UI relaxation) |
| Post-v3.0.0 | OAuth 2.0 / social login |
| Post-v3.0.0 | WebAuthn / biometric authentication |
| Post-v3.0.0 | Email verification flow |

---

## What Was Fixed

### 2026-09-14 — seven IDORs in the session/template exercise tree (Phase 19 gate)
Session-exercises and sets carry no `trainer_id`; they belong to whoever owns the session. Seven routes mutated them by bare `id` with no ownership resolution, so any authenticated trainer could: add an exercise to anyone's session (`POST /sessions/:id/exercises`), edit or delete anyone's session-exercise (`PATCH`/`DELETE /session-exercises/:id`), **log sets onto anyone's session-exercise** (`POST /session-exercises/:id/sets` — it also inserted when the parent row did not exist), edit or delete anyone's set (`PATCH`/`DELETE /sets/:id`), and delete anyone's template exercise (`DELETE /template-exercises/:id`). Fixed with three resolvers in `routes/sessions.ts` — `ownedSession`, `ownedSessionExercise`, `ownedSet` — that load through the aggregate root and return 404 (never 403: no existence leak), plus a relational load on the template route. Circuit auto-ungroup (a circuit is ≥ 2 members) now runs in the same transaction as both deletes. Found by the source-level ownership guard, which is now a permanent test. Two earlier IDORs of the same class were found by reading code: `POST /templates/:id/fork` (2026-08) and template apply in `POST /sessions` (2026-09-14).


| Date | Fix |
|---|---|
| April 2026 | `POST /auth/register` — added rate limit (5/15min). Was unlimited. |
| April 2026 | `sameSite: 'none'` on refresh token cookie in production (cross-domain Vercel/Railway) |
| April 2026 | Host binding `0.0.0.0` in production — was conditionally binding to `localhost` |
