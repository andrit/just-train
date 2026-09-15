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

## Security Checklist (opened 2026-09-14 · this is the whole list)

Three tiers. **Gate** = must be done (dated) before public registration. **3.0** = before money and paid strangers. **Ongoing** = cadence, not a one-off. An item is done when it has a date and evidence; an undated item is open, whoever owns it. Decisions recorded 2026-09-15 are marked ⚖.

### Tier 1 — Pre-Go-Live gate

| # | Check | Owner | Status | Evidence / notes |
|---|---|---|---|---|
| G1 | **Ownership — URL ids.** Every parameterised route resolves the caller before acting | Claude | ✅ 2026-09-14 | 7 IDORs fixed; guard `__tests__/security/ownership-guard.test.ts` (fails on any unscoped route; failed on all 7 pre-fix) |
| G2 | **Ownership — body ids.** Every body/query foreign key checked (`clientId`, `exerciseId(s)`, `templateId`, `sessionId`) | Claude | ✅ 2026-09-15 | `POST /sessions` clientId + 5 exercise-visibility gaps fixed via `lib/ownership.ts` |
| G3 | **Ownership — real-database matrix.** Seed trainer A, call every route as B, expect 404 — against Postgres, not mocks | Claude (needs a test-DB URL on the Mac) | ⬜ | The guards are scans; this is the proof |
| G4 | **No anonymous route** (source + runtime GET/DELETE) | Claude | ✅ 2026-09-15 | `no-anonymous-route.test.ts`; 4-entry PUBLIC list |
| G5 | **Mass-assignment** — privileged fields never survive input schemas | Claude | ✅ 2026-09-15 | `mass-assignment.test.ts` |
| G6 | **Response leak** — `passwordHash` cannot reach a response | Claude | ✅ 2026-09-15 | `response-leak.test.ts` |
| G7 | **Rate limits** — every POST has a per-route limit or a listed reason | Claude | ✅ 2026-09-15 | `rate-limit-presence.test.ts` |
| G8 | **Dependency audit** — `pnpm audit` from the repo root, zero high/critical | you | ⬜ | record date + counts here |
| G9 | **Production surface, verified live** — `curl -sI …railway.app/documentation` → 404; `curl -sI …/health` shows CSP + `Cache-Control: no-store`; no debug routes | you | ⬜ | config says so; the header is proof |
| G10 | **Secrets hygiene** — rotate Railway Postgres password (pasted in chat, Aug); `git log --all --diff-filter=A -- '*.env'` empty; one-off `npx gitleaks git .` over history | you | ⬜ | |
| G11 | **Validation-before-auth** — bare POST → 400 not 401; decide leave-documented vs `authenticate` as `onRequest` | you ⚖ | ⬜ decision | also why G4's runtime layer is GET/DELETE only |
| G12 | **Account surface** — vetted; features tracked in `task-plan-account.md` | Claude | ✅ vet 2026-09-15 · ⬜ features | see "Account surface" below |
| G13 | **Delete-account semantics** ⚖ | you | ✅ decided 2026-09-15 | **Soft delete: deactivate (login blocked, data hidden), purge after 30 days by a scheduled job** — matches `/privacy` retention wording; restore-on-login within the window; hard purge as the first **admin** utility |
| G14 | **Email verification gating** ⚖ | you | ✅ decided 2026-09-15 | **Nothing gated before Go Live** (verification stays advisory; reset-password proves the mailbox) — revisit at 3.0 |
| G15 | **Account lockout** ⚖ | you | ✅ decided 2026-09-15 · ⬜ build | 5 failures/email → 15-min lock (counted for unknown emails too, `423` + retry-after); per-IP failure cap 20/15 min; notice email once mail is live; Turnstile register-always, login-adaptive after 3 failures. Build = account plan C9 |
| G16 | **Progress-photo delivery** — Cloudinary URLs are public if guessed; move `snapshot_media` (and form-check clips) to signed/authenticated delivery | Claude, design | ⬜ | the most sensitive data the app holds |
| G17 | **Upload content check** — magic-byte validation (`file-type`) before Cloudinary, not only the client `Content-Type` | Claude | ⬜ | closes the documented trade-off |
| G18 | **Backups** — Railway Postgres: automated backup enabled + retention; one restore *tested* (`pg_restore` into a scratch DB) | you | ⬜ | `Database-Management.md` documents manual `pg_dump` only; a backup never restored is a hope |
| G19 | **Cookie** — `sameSite: 'strict'` once `just-train.fit` fronts the app via the proxy (both origins same-site) | Claude, after DNS cut-over | ⬜ | the deferred item's own trigger |
| G20 | **Auth failure logging** — failed logins / lockouts logged at `warn` with email hash + IP, surfaced in Railway logs; Sentry alert on a spike | Claude | ⬜ | today only seed/email failures are logged |
| G21 | **Privacy page truth** — every promise on `/privacy` maps to a capability: deletion (G13), erasure (purge job), portability (export), processors list (Sentry ✅, Speed Insights ✅), retention numbers (`[PLACEHOLDER]` → real) | you + Claude | ⬜ | |

### Tier 2 — before 3.0 (money, paid strangers)

| # | Check | Notes |
|---|---|---|
| S1 | Full OWASP Top-10 pass — ZAP against staging, Burp on auth/refresh/upload; the ten areas in `DEFERRED_ITEMS.md` → Pre-3.0 | High findings block 3.0 |
| S2 | Refresh-token reuse detection (account plan A3) | ✅ 2026-09-15 — replay of a rotated token beyond a 10 s grace window revokes the family (`401 TOKEN_REUSE`); daily cleanup job |
| S3 | Stripe webhook signature verification + idempotent event handling; no card data ever touches the API | when Stripe lands |
| S4 | Admin surface hardened — `role = 'admin'` set only via SQL (no self-promotion path; guarded by G5), admin routes under `requireRole('admin')`, admin UI on its own origin (`metzger.just-train.fit`) with IP allow-list / Vercel protection | see admin note in `task-plan-account.md` |
| S5 | CAPTCHA (Turnstile) on register; adaptive on login | with G15 |
| S6 | Visual/E2E regression covering auth flows (login, refresh, lockout, reset) | Playwright |
| S7 | Data-protection impact note: what each processor receives, per feature (already done for Sentry/Speed Insights; extend to Stripe, Resend) | privacy page processors section |

### Tier 3 — ongoing

| # | Cadence | Check |
|---|---|---|
| O1 | monthly | `pnpm audit`; bump patch/minor deps; record date |
| O2 | monthly | review Sentry issues for auth-related patterns; review lockout counts |
| O3 | quarterly | rotate `JWT_SECRET` / `COOKIE_SECRET` / Cloudinary + Resend keys; rotate DB password |
| O4 | quarterly | restore-test a backup |
| O5 | on each browser major | service worker + install behaviour (already in Phase 20 "Ongoing") |
| O6 | on each new route | the four guards run in CI — a new parameterised route without ownership resolution fails the build |

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
