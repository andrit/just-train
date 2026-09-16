# Fastify 4 → 5 upgrade: Task Plan
**Why:** dependency audit 2026-09-16 (`docs/SECURITY.md` → *Dependency audit*). Fastify 4 is end-of-life and carries a **reachable body-validation bypass** (CVE-2026-25223, `Content-Type` with a tab character) with no 4.x patch. Zod body validation is this app's input guard on every route, so the bypass is the one audit finding that is a launch blocker. The same move retires `find-my-way` 8, `@fastify/static` 7 and the `fast-uri` chain at source.
**Written:** 2026-09-16 · **Status:** DRAFT — awaiting designer confirmation after vet.

## Verified constraints (registry + repo, 2026-09-16)
- Every plugin's current major targets Fastify 5 (`fastify-plugin ^6`): `@fastify/cookie` 9→**11**, `cors` 9→**11**, `helmet` 11→**13**, `multipart` 8→**10**, `rate-limit` 9→**11**, `swagger` 8→**9**, `swagger-ui` 4→**6**.
- **`fastify-type-provider-zod`** is the pivot: 1.1.9 today. Lines **7.x / 6.x require Zod 4** (`zod >=4.1.5`); **5.x requires the `zod/v4` API** (its `zod >=3.25.56` peer is the 3.25 release that *ships* `zod/v4` — **first build attempt misread this as "Zod 3 API"; every response 500'd because 5.x looks for v4 internals on each schema**). The line for Fastify 5 + the Zod 3 API our schemas use is **4.x** (peer `zod ^3.14`, `fastify ^5`). So: type-provider **^4.0.2** + Zod **^3.25.76** everywhere (a compatible minor; also positions the later Zod 4 move).
- Node: Fastify 5 needs Node 20. `engines.node >=20`, CI is Node 20, Railway's Nixpacks reads `engines` → 20. ✓
- Sentry: `@sentry/node` 8.55 `setupFastifyErrorHandler` — Fastify 5 support in the 8.x line is **assumed, not verified** (Unknown 1). If it fails, `@sentry/node` 10 (already tier 2) is pulled into this commit.
- Fastify 5 removals grep'd against `src/` — none used: `request.routerPath`, `request.routeConfig`, `request.context`, `reply.getResponseTime`, `reply.redirect(code, url)`, JSON-schema shorthand, `setDefaultRoute`. `GET /health` already uses a Zod response schema (the `safeParse` incident in RAILWAY_ERRORS.md).
- Module augmentations we own (`types/fastify-plugins.d.ts`, `authenticate.ts`, `idempotency.ts`) merge into `FastifyRequest`/`FastifyReply` — unchanged in v5; the hand-written cookie/multipart shims may become redundant or conflict with the plugins' own v5 types (Unknown 3).
- `buildApp.ts` casts `cookie`/`multipart` to `FastifyPluginCallback` for the test app — expect type churn there, no behaviour change.
- 700+ tests: 38 unit files (mocked db) + the real-DB lane. The security guards (`no-anonymous-route`, `mass-assignment`, `rate-limit-presence`, `response-leak`, `ownership-guard`) and the G3 matrix are exactly the net for this kind of change: they assert *behaviour the framework mediates* (validation runs, unknown keys stripped, 401/404/400 ordering, per-route rate-limit config present).

## What changes in behaviour (known, from the type-provider changelog 1 → 5)
1. **Validation error shape.** Today a failed body validation is Fastify's default `{ statusCode: 400, code: 'FST_ERR_VALIDATION', error: 'Bad Request', message: '<zod issues JSON>' }`. In 5.x the provider raises typed errors and recommends a custom error handler; without one the default shape persists but the `message` formatting changes. The frontend reads `errorData.error` (→ "Bad Request" either way — pre-existing, not great) and shows the message on some forms. **Decision inside the plan:** add the recommended `setErrorHandler` that maps Zod validation errors to our own `{ error, code: 'VALIDATION', details }` (`ErrorResponseSchema` already has `details` for exactly this) — a strict improvement, and it makes the 400 body predictable for the guards.
2. **Response serialisation error shape.** Today a response that fails its Zod schema 500s with `{ error, details: { issues } }` (seen in the G3 run). In 5.x it is a `ResponseSerializationError` → 500 with a plain message. Same status; the custom handler keeps `details` in non-production so the real-DB lane still tells us *which field* failed.
3. **Swagger needs `transform: jsonSchemaTransform`** (Zod → JSON Schema for the docs). Today `@fastify/swagger` is registered without it — the docs likely show empty schemas already. Adding it is one line and makes `/documentation` truthful (dev only).
4. Everything else — `request.file()`, `reply.setCookie`, `config.rateLimit`, `keyGenerator`, `errorResponseBuilder`, CORS `origin(origin, cb)`, helmet directives, `onRoute`, `inject` — same API across the majors listed. Verified against each plugin's current README; the tests are the proof.

## Tasks
1. **Bump + install** *(low, Mac)* — `fastify ^5.12`, seven plugins to the majors above, `fastify-type-provider-zod ^5.1.0`, `zod ^3.25.76` in root override + shared + backend + frontend. `pnpm install` → lockfile. Depends on: none.
2. **Compile to green** *(medium)* — `pnpm --filter @trainer-app/shared build && pnpm typecheck`. Expected churn: `buildApp.ts` plugin casts, possibly the cookie/multipart shim (`types/fastify-plugins.d.ts` — delete it if the v5 plugin types now merge cleanly, keep it if pnpm's layout still hides them), any `FastifyInstance` generic annotations. **No route logic changes** in this task — if a route needs to change to compile, that's a finding to report, not a silent edit. Depends on: 1.
3. **Error handler** *(low)* — `lib/errorHandler.ts`: Zod validation → 400 `{ error: 'Validation failed', code: 'VALIDATION', details: issues }`; response serialisation → 500 `{ error: 'Response failed validation', details }` (details only when `NODE_ENV !== 'production'`); everything else → existing behaviour (Sentry handler stays attached). Unit-tested via `inject` on a throwaway route. Update the `no-anonymous-route` guard's 400 expectation if the shape matters to it (it checks status only). Depends on: 2.
4. **Swagger transform** *(low)* — `transform: jsonSchemaTransform` on `@fastify/swagger`; confirm `/documentation` renders locally with real schemas. Depends on: 2.
5. **Tests green** *(medium)* — `pnpm verify` (unit lane) then push → CI real-DB lane. Expect a handful of assertions on the old 400 `message` format; move them to the new shape, never loosen to "any 4xx". Depends on: 3.
6. **Sentry check** *(low)* — with `SENTRY_DSN` unset locally the handler is inert; the real check is the first Railway deploy: throw from `/health?boom=1`-style test route? No — use the existing *Sentry test error* path from the Phase 18 runbook and confirm an event arrives. Depends on: 5, deploy.
7. **Docs** *(low)* — CHANGELOG; `SECURITY.md` audit section (re-run `pnpm audit`, record counts); `RAILWAY_ERRORS.md` gets a line ("Fastify 5 + type-provider 5: all response schemas must still be Zod — unchanged rule"); `CLAUDE.md` tech-stack line "Fastify 4" → "Fastify 5"; `PROJECT_STATE.md` tech table. Depends on: 5.

## Execution order
1 → 2 → 3 → 4 → 5 → 7, then push → 6. One commit if 2–5 stay small; two (bump+compile, then error handler) if the compile churn is large enough to want its own diff. **Lockfile on the Mac** (dependency change). **No schema, no prod SQL.** Rollback = revert the commit + `pnpm install`; the database is untouched.

## Verification — what "done" means
- `pnpm verify` green; CI green including the real-DB matrix (the 404-never-403/400 ordering is exactly what a validation change could disturb).
- Security guards green **without edits** to their expectations (a guard that had to be relaxed to pass is a finding).
- `pnpm audit`: `fastify`, `find-my-way`, `fast-uri`, `@fastify/static` gone from the reachable list; count recorded.
- Manual: register → login → log a set → upload (multipart path) → refresh-token rotation (cookie path) on the deployed app, phone reopened twice. Swagger renders in dev with real schemas.
- Sentry receives a test event post-deploy (Unknown 1 closed).

## Unknowns
1. **`@sentry/node` 8.55 + Fastify 5** — if `setupFastifyErrorHandler` rejects v5, pull Sentry 10 into this commit (it's tier 2 anyway; brings OTel 2 and closes the `baggage` advisory).
2. **Type-provider 5's validator replaces `request.body` with the parsed value** (defaults applied, unknown keys stripped) — same as 1.x as far as the mass-assignment guard has proven; the guard re-proves it.
3. **The hand-written cookie/multipart type shim** may now conflict with the v5 plugins' own declarations (duplicate `setCookie` signatures). Resolve by deleting the shim if `tsc` is clean without it; keep it otherwise. Either way, no runtime effect.
4. **`@fastify/multipart` 10 `limits` defaults** — file-size limits are set explicitly in `index.ts`; confirm they still apply (an upload over 10 MB must still 413/400 — one inject test with a large buffer against the mocked upload).
5. **`@fastify/rate-limit` 11 `errorResponseBuilder` signature** — README says unchanged; the presence guard checks config, not shape. A single inject test hitting a 2/min test route twice pins the 429 body.

## Not in this plan
Zod 4 (type-provider 6/7, shared package, frontend — its own plan). drizzle 0.45, argon2 0.45, Sentry 10 unless Unknown 1 forces it. Node 22.
