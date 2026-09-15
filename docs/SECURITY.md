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
| 4a | **Ownership matrix — URL ids** — every parameterised route resolves the caller's ownership before acting | ✅ 2026-09-14 (static guard) · ⬜ real-DB matrix | Audit found **7 IDORs** (all in the session/template exercise tree — see What Was Fixed). Source-level guard `__tests__/security/ownership-guard.test.ts` fails on any route that never uses `request.trainer.trainerId` in a scoping shape; it failed on all seven before the fix. The SQL-level proof (seed trainer A, call as B, expect 404, against real Postgres) is still to build. |
| 4a′ | **Ownership matrix — body ids** — every foreign key accepted in a request body is checked against "may the caller reference this row" | ✅ 2026-09-15 | Sweep of every input schema carrying `clientId` / `exerciseId(s)` / `templateId` / `sessionId`. Found: `POST /sessions` wrote `body.clientId` unchecked (sessions against another trainer's client, polluting their KPIs/at-risk/report); `exerciseId` on session-exercise, circuits (session + template), template-exercise and challenge create accepted another trainer's **private** exercise (name leak, and a 500-on-FK for unknown ids). All now go through `lib/ownership.ts` (`ownedClient`, `visibleExercise(s)` = public library OR own). Reorder routes were already constrained to the parent. |
| 4a″ | Permanent guards (`__tests__/security/`) | ✅ 2026-09-15 | `no-anonymous-route` (source: every route authenticated unless on the 4-entry PUBLIC list; runtime: every GET/DELETE 401s without a token) · `mass-assignment` (role / subscriptionTier / subscriptionStatus / emailVerified / trainerId / isSelf / id / passwordHash never survive Register, Update, Onboard, Client, Session schemas) · `response-leak` (serializer + response schema both drop `passwordHash`) · `rate-limit-presence` (every POST has a per-route limit or a listed reason for the global one). Each can fail; each is a scan, not a proof. |
| 4b | `pnpm audit` — no high/critical | ⬜ | run from repo root; record date + count here |
| 4c | Production surface — Swagger UI + `/documentation/json` absent, CSP + `Cache-Control: no-store` on `/api/*`, no debug routes | ⬜ | `curl -sI https://just-train-production.up.railway.app/documentation` → expect 404; `curl -sI …/api/v1/health` shows the headers |
| 4d | Secrets hygiene — rotate Railway Postgres password; `.env` never committed | ⬜ | `git log --all --diff-filter=A -- '*.env'` must be empty |
| 4e | Validation-before-auth (unauthenticated callers get field-level 400s) — decide: leave (documented) or `authenticate` as `onRequest` | ⬜ designer decision | Also why the runtime anonymous-route guard covers only GET/DELETE. |
| 4f | **Account / profile vet** | ✅ vetted 2026-09-15 · ⬜ features | See "Account surface" below. |

### Account surface — what a signed-in user can and cannot do to their own account (vetted 2026-09-15)

**Safe as built:** `PATCH /auth/me` spreads the body, but `UpdateTrainerSchema` holds only name / unit / preferences — no `role`, `subscriptionTier`, `subscriptionStatus`, `emailVerified`, `trainerMode` — and Zod strips unknown keys (now pinned by the mass-assignment guard). Register accepts name / email / password only. `POST /auth/onboard` may be re-called to switch mode ("before the trainer has meaningful data" — advisory; nothing enforces "no meaningful data"). `POST /auth/logout-all` revokes every device's refresh token. Refresh tokens rotate; device id is tracked.

**Missing — expected of any account, and required before strangers register** (each is a `DEFERRED_ITEMS` entry today):
| Capability | Status | Why it matters |
|---|---|---|
| Change password (current + new) | ✗ | basic hygiene; also the recovery path after a suspected compromise |
| Forgot / reset password (email link) | ✗ | without it a forgotten password is a lost account; needs Resend + `APP_URL` (parked on the domain — can run on the vercel.app origin now) |
| Change email (re-verify) | ✗ | typos at register are permanent today |
| Email verification **enforced** | advisory only | built; gate is one line when email is live |
| Active devices / sessions list + revoke one | ✗ | `refresh_tokens` has `device_name`, `last_used_at`; UI only |
| Refresh-token reuse detection | ✗ | replay of a rotated token should end all sessions (`last_used_at` exists for this) |
| **Delete account** (with data + Cloudinary media) | ✗ | `/privacy` §Data retention and §Your rights promise deletion and erasure — **the page promises what the app cannot do** |
| Export my data (portability) | ✗ | `/privacy` §Your rights lists portability |
| Account lockout after N failures | ✗ | decisions listed in `DEFERRED_ITEMS`; needed once registration is public |

Plan: `.workbench/designer/current/task-plan-account.md` (Phase 19 track).

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

### 2026-09-15 — body-supplied foreign keys (Phase 19 gate, second sweep)
`POST /sessions` inserted `body.clientId` with no ownership check (the only client lookup was *after* the insert, for the response) — a trainer could write sessions against another trainer's client, and every per-client computation (KPIs, at-risk, monthly report) would count them. Five routes accepted an `exerciseId` / `exerciseIds` with an existence check but no visibility check, so another trainer's private exercise could be attached (leaking its name) and an unknown id produced a 500 on the FK. Fixed via `lib/ownership.ts`: `ownedClient`, and `visibleExercise` / `visibleExercises` (public library OR the caller's own — the same rule `GET /exercises` already used). Four permanent guard tests added under `__tests__/security/`.

### 2026-09-14 — seven IDORs in the session/template exercise tree (Phase 19 gate)
Session-exercises and sets carry no `trainer_id`; they belong to whoever owns the session. Seven routes mutated them by bare `id` with no ownership resolution, so any authenticated trainer could: add an exercise to anyone's session (`POST /sessions/:id/exercises`), edit or delete anyone's session-exercise (`PATCH`/`DELETE /session-exercises/:id`), **log sets onto anyone's session-exercise** (`POST /session-exercises/:id/sets` — it also inserted when the parent row did not exist), edit or delete anyone's set (`PATCH`/`DELETE /sets/:id`), and delete anyone's template exercise (`DELETE /template-exercises/:id`). Fixed with three resolvers in `routes/sessions.ts` — `ownedSession`, `ownedSessionExercise`, `ownedSet` — that load through the aggregate root and return 404 (never 403: no existence leak), plus a relational load on the template route. Circuit auto-ungroup (a circuit is ≥ 2 members) now runs in the same transaction as both deletes. Found by the source-level ownership guard, which is now a permanent test. Two earlier IDORs of the same class were found by reading code: `POST /templates/:id/fork` (2026-08) and template apply in `POST /sessions` (2026-09-14).


| Date | Fix |
|---|---|
| April 2026 | `POST /auth/register` — added rate limit (5/15min). Was unlimited. |
| April 2026 | `sameSite: 'none'` on refresh token cookie in production (cross-domain Vercel/Railway) |
| April 2026 | Host binding `0.0.0.0` in production — was conditionally binding to `localhost` |
