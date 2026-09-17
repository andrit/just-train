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
| G3 | **Ownership — real-database matrix.** Seed trainer A, call every route as B, expect 404 — against Postgres, not mocks | Claude | ✅ 2026-09-16 — **in CI on every push** | `__tests__/db/ownership-matrix.test.ts`: 56 URL-id routes + 9 body-id cases, all 404; owner sanity 200; a coverage test fails CI if a parameterised route has no matrix entry. Found + fixed: two `403`s and two `204`-on-foreign-id (reorder routes), two `400`s (circuit visibility), a 500 on template detail with exercise media. Purge proven against real FKs alongside (found two purge defects). CI job step *Ownership matrix (real database)* |
| G4 | **No anonymous route** (source + runtime GET/DELETE) | Claude | ✅ 2026-09-15 | `no-anonymous-route.test.ts`; 4-entry PUBLIC list |
| G5 | **Mass-assignment** — privileged fields never survive input schemas | Claude | ✅ 2026-09-15 | `mass-assignment.test.ts` |
| G6 | **Response leak** — `passwordHash` cannot reach a response | Claude | ✅ 2026-09-15 | `response-leak.test.ts` |
| G7 | **Rate limits** — every POST has a per-route limit or a listed reason | Claude | ✅ 2026-09-15 | `rate-limit-presence.test.ts` |
| G8 | **Dependency audit** — `pnpm audit` from the repo root, zero high/critical | you + Claude | 🔄 2026-09-16: 97 findings (2 critical, 50 high) triaged below; tier 1 applied → **65**; Fastify 5 → **58** (2026-09-17; 2 critical, 33 high — both criticals and the bulk of the highs are install-time / dev tooling); **tier 2 (Fastify 5, drizzle 0.45, Sentry 10, argon2 0.45) is a launch blocker** because Fastify 4 is EOL with a reachable validation bypass | see *Dependency audit — 2026-09-16* |
| G9 | **Production surface, verified live** — `curl -sI …railway.app/documentation` → 404; `curl -sI …/health` shows CSP + `Cache-Control: no-store`; no debug routes | you | ⬜ | config says so; the header is proof |
| G10 | **Secrets hygiene** — rotate Railway Postgres password (pasted in chat, Aug); `git log --all --diff-filter=A -- '*.env'` empty; one-off `npx gitleaks git .` over history | you | ⬜ | |
| G11 | **Validation-before-auth** — bare POST → 400 not 401; decide leave-documented vs `authenticate` as `onRequest` | you ⚖ | ⬜ decision | also why G4's runtime layer is GET/DELETE only |
| G12 | **Account surface** — vetted; features tracked in `task-plan-account.md` | Claude | ✅ vet 2026-09-15 · ⬜ features | see "Account surface" below |
| G13 | **Delete-account semantics** ⚖ | you | ✅ decided + built 2026-09-15 | **Soft delete** (`DELETE /auth/me`), restore-on-login within 30 days, daily purge job with an explicit ordered delete (`purgeTrainer()`, also the admin hard-purge utility); `/privacy` retention text now matches |
| G14 | **Email verification gating** ⚖ | you | ✅ decided 2026-09-15 | **Nothing gated before Go Live** (verification stays advisory; reset-password proves the mailbox) — revisit at 3.0 |
| G15 | **Account lockout** ⚖ | you | ✅ decided · ✅ built 2026-09-15 | 5 failures/email → 15-min lock (unknown emails too, `423` + `retryAfterSeconds`); per-IP 20/15 min (`429`); notice email once mail is live. **In-process store** (no Redis client in the repo — `ioredis` removed on purpose; same durability as the global rate limiter; `FailureStore` interface is the seam). ⬜ Turnstile register-always / login-adaptive — own step. ⚠ per-IP keying uses `X-Forwarded-For[0]` — confirm under G9 that Vercel→Railway overwrites a client-sent header (if it appends, the per-IP cap is bypassable; the per-email lock does not depend on IP) |
| G16 | **Progress-photo delivery** — client media under Cloudinary `authenticated` type, URLs signed at read time (`mediaDeliveryUrl`) | Claude ✅ 2026-09-16 | ✅ code | **Signed, not expiring**: no credential-less delivery; rotate `CLOUDINARY_API_SECRET` to revoke every URL. A legitimately-loaded URL that leaks stays valid until the asset is deleted or the secret rotates. Escalation (backend proxy / paid token auth) + triggers in `DEFERRED_ITEMS`. Existing prod assets: none yet; rename-to-authenticated script is plan task 4 when needed |
| G17 | **Upload content check** — type decided from the bytes, client `Content-Type` ignored | Claude | ✅ 2026-09-15 | `lib/magicBytes.ts` (seven signatures, no dependency — `file-type` is ESM-only); `validateMediaFile(buffer)` feeds size class + Cloudinary `resource_type`; unit-tested incl. HTML-as-PNG |
| G18 | **Backups** — Railway Postgres: automated backup enabled + retention; one restore *tested* (`pg_restore` into a scratch DB) | you | ⬜ | `Database-Management.md` documents manual `pg_dump` only; a backup never restored is a hope |
| G19 | **Cookie** — `sameSite: 'strict'` once `just-train.fit` fronts the app via the proxy (both origins same-site) | Claude | ✅ 2026-09-16 | flipped the day the domain went live; unit test pins it; path-scoped to `/api/v1/auth` so navigations never needed it |
| G20 | **Auth failure logging** — failed logins / lockouts logged at `warn` with email hash + IP; lock events as Sentry security events | Claude ✅ 2026-09-15 · you ⬜ alert rule | Sentry → Alerts → new issue alert: *event message equals `Sign-in locked`* (or tag `kind:security`), threshold e.g. > 5 in 15 min → email. Until the rule exists the events land in Issues only |
| G21 | **Privacy page truth** — every promise on `/privacy` maps to a capability: deletion ✅, erasure ✅ (purge job), portability ✅ (`GET /auth/export`, 2026-09-15), processors list ✅, retention numbers ✅ | you + Claude | ✅ capabilities 2026-09-15 | §Your rights still carries the `[PLACEHOLDER]` legal-review marker — wording, not capability |

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

**Account capabilities — status as of 2026-09-15** (each was a `DEFERRED_ITEMS` entry; the plan is the account track of Phase 19):
| Capability | Status | Notes |
|---|---|---|
| Change password (current + new) | ✅ A1 | `PATCH /auth/password`; other devices signed out, caller kept |
| Active devices / sessions list + revoke one | ✅ A2 | `GET /auth/devices`, `DELETE /auth/devices/:deviceId`; "sign out everywhere" via `/auth/logout-all` |
| Refresh-token reuse detection | ✅ A3 | replay beyond a 10 s grace → family revoked, `401 TOKEN_REUSE`; daily cleanup job |
| Export my data (portability) | ✅ A4 | `GET /auth/export`, 3/hour |
| **Delete account** (with data + Cloudinary media) | ✅ A5 | soft: `DELETE /auth/me { password }` → `deactivated_at`; login within 30 days restores; daily purge job deletes media then rows |
| Forgot / reset password (email link) | ✅ B6 (code) · ⬜ live | `POST /auth/forgot-password` (always 202, 5/15 min) → `POST /auth/reset-password` (single-use SHA-256 token, 1 h, all devices signed out). **Live only once Resend + `APP_URL` are set** — until then the request succeeds and the mail silently fails (logged + Sentry) |
| Change email (re-verify) | ✅ B7 (code) · ⬜ live | `PATCH /auth/email` → link to the **new** address; swap only on redeem (token carries the target); old address notified. Same email-config gate as B6 |
| Email verification **enforced** | advisory only | decided: nothing gated before Go Live (G14) |
| Account lockout after N failures | ✅ C9 | 5/15 min per email (`423`), 20/15 min per IP (`429`), in-process store; Turnstile pending |

Plan: `.workbench/designer/current/task-plan-account.md` (Phase 19 track).

## Dependency audit — 2026-09-16

`pnpm audit` from the root: **97 findings / 94 advisories** (2 critical, 50 high, 37 moderate, 8 low). Raw output in `docs/user-tasks/audit-2026-09-16.{json,txt}` (untracked). Most of the count is one advisory × many transitive paths (`brace-expansion` alone is 138 paths). What matters is *reachability*: does the vulnerable code run in production, and can a request reach it?

### Runtime, reachable — the real list
| Package | Installed → fixed | Advisory | Reachability | Fix |
|---|---|---|---|---|
| `fastify` | 4.29.1 → ≥5.7.2 | **high** CVE-2026-25223 — `Content-Type` with a tab bypasses body validation; also 5.8.3 host/proto spoofing, 5.12.1 schema-coercion bypass | **Yes.** Zod body validation is the input guard on every route | **Fastify 4 is EOL — no 4.x patch.** Major upgrade: `fastify`, every `@fastify/*` plugin, `fastify-type-provider-zod`. **Tier 2, before Go Live.** |
| `fast-uri` (via fastify → ajv) | 2.4.0 / 3.1.0 → 2.4.7 / 3.1.8 | 7× high — host confusion, path traversal, SSRF in URI parsing | Yes — request URIs | **Tier 1 — pnpm overrides `fast-uri@2`, `fast-uri@3`** (2026-09-16) |
| `drizzle-orm` | 0.30.10 → 0.45.2 | high CVE-2026-39356 — SQL injection via unescaped identifiers | Low today: every identifier is a static schema name; `sql.raw` appears only in the test harness | Tier 2 with `drizzle-kit` 0.31 (15 minor versions; migrations tooling changes) |
| `@opentelemetry/core` (via `@sentry/node` 8) | 1.30.1 → 2.8.0 | moderate — unbounded allocation parsing a `baggage` header | Yes — incoming header, propagator runs on every request | Tier 2: `@sentry/node` 8 → 10 (brings OTel 2) |

### Runtime, not reachable
- `find-my-way` 8.2.2 — HTTP/2 DDoS; the app does not serve HTTP/2 (Railway terminates TLS, backend is HTTP/1.1). Goes away with Fastify 5.
- `@fastify/static` 7 (via `@fastify/swagger-ui`) — path-traversal guard bypass; Swagger UI is registered **only outside production**. Goes away with Fastify 5 (`swagger-ui` 5).
- `js-cookie` (via `resend` → `@react-email/render` → `js-beautify`) — a browser cookie helper that never executes server-side.

### Frontend bundle — Tier 1, applied 2026-09-16
- `dompurify` 3.3.3 → ^3.4.15 (14 advisories, all sanitiser bypasses; used on the report preview iframe).
- `react-router-dom` 6.30.3 → ^6.30.6 (open redirect → XSS via `//` and backslash paths). The two "fix ≥7.18" entries are SSR-only (`deserializeErrors`) — not used.
- `bullmq` 5.73 → ^5.81.5 — drops `uuid` as a dependency (moderate, v3/v5/v6 buffer bounds; BullMQ used v4 anyway).

### Install-time only
- `tar` ×12 incl. the **critical** — `argon2` 0.31's `node-pre-gyp` extracts a prebuilt binary during `pnpm install` on the build box; never at runtime, and the archive comes from argon2's own release. Fix: `argon2` → 0.45 (prebuildify, no `tar`). Native module — its own step, verify the Railway build. Tier 2.

### Dev / build tooling — never ships (~70 of 97)
`vitest` (the other **critical**: only when `vitest --ui`'s server is listening — never in CI or prod), `vite`, `postcss`, `nanoid`, `ws` (jsdom), `esbuild`, `@babel/*`, `browserslist`, `brace-expansion` (glob/minimatch under eslint, rimraf, node-pre-gyp), `js-yaml` (eslint), `serialize-javascript` (workbox-build at build time), `@humanfs/node`. Addressed by a tooling upgrade (vitest 1 → 3 brings vite 6) — a deliberate session, not a security fix. **Not** a launch blocker.

### Decision
**Fastify 5 applied 2026-09-16** (tier 2, first item) — deployed, matrix green, Sentry receiving from the new build. Re-audit 2026-09-17: **58** (3 low / 20 moderate / 33 high / 2 critical); `fastify`, `find-my-way`, `fast-uri`, `@fastify/static` gone. Remaining runtime-reachable: `drizzle-orm` (identifiers — low reachability), `@opentelemetry/core` via `@sentry/node` 8 (`baggage` header). Both criticals still install-time / dev-only.
Tier 1 applied 2026-09-16 → 97 to **65** (4 low / 23 moderate / 36 high / 2 critical); the remaining runtime-reachable set is exactly fastify, drizzle-orm, @opentelemetry/core. **Tier 2 — Fastify 5 first** (closes fastify + find-my-way + fast-uri-at-source + @fastify/static in one move), then drizzle 0.45 + drizzle-kit, Sentry 10, argon2 0.45 — each its own commit with `pnpm verify` + the real-DB lane green, before Go Live. Tier 3 (tooling) when convenient. Re-run the audit after each and update this section.

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
