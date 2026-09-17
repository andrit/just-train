# Sentry SDK 8 → 10 (backend; frontend optional): Task Plan
**Why:** audit tier 2 — `@opentelemetry/core` 1.30 (via `@sentry/node` 8.55) has a moderate advisory: unbounded allocation parsing a `baggage` header, which is an *incoming request header* — reachable from the internet on every request. The fix (core ≥2.8) only ships inside Sentry 9+/10, which moved to OpenTelemetry 2. Also: `@sentry/node` 8 is out of support.
**Written:** 2026-09-17 · **Status:** CONFIRMED (designer, 2026-09-17) — DONE 2026-09-17 — deployed; forged-Origin 500 captured; audit 58 → 57 (`@opentelemetry/core` gone). Cron heartbeat NOT verified (Redis unset). Frontend SDK still 8 (optional task 4 open).

## Verified (registry + repo, 2026-09-17)
- `@sentry/node` 10.75.0: `engines.node >=18`; deps pull `@opentelemetry/sdk-trace-base ^2.9` → `@opentelemetry/core` 2.9 — the advisory closes. Node on Railway is 24. ✓
- **Our entire Sentry surface is six calls**, all in `lib/sentry.ts` (nothing else imports the SDK — that was the Phase 18 design and it pays off now): `init({ dsn, environment, release, tracesSampleRate, sendDefaultPii, beforeSend })`, `setupFastifyErrorHandler(app)`, `captureException`, `captureMessage(msg, { level, tags })`, `setUser`, `withMonitor(slug, fn, { schedule, checkinMargin, maxRuntime, timezone })`. Every one exists unchanged in v9 and v10. The 8→9 and 9→10 removals (`enableTracing`, `autoSessionTracking`, `Handlers`, the `Integrations` namespace, `transactionContext` in `tracesSampler`, `@sentry/utils`) touch nothing we call.
- `instrument.ts` already does what v9+ insists on: `Sentry.init` before any other module loads (first import, own `dotenv.config()`). CJS build → `require-in-the-middle` path, same as today.
- `beforeSend` scrubbing (drop `request.data/cookies/query_string`, strip query from url) and `sendDefaultPii: false` are pinned by unit tests (`__tests__/lib/sentry.test.ts`) — those tests are the guard that the upgrade doesn't loosen the privacy promise.
- Frontend: `@sentry/react` 8 → 10.75 is the same shape (`init` with the same six options, `captureException`, `captureMessage`) — **no advisory there**; included as an optional second commit so the two SDKs don't drift two majors apart. `@sentry/vite-plugin` 3.x stays.

## What changes in behaviour
1. **OTel 2 under the hood** — span/trace plumbing is Sentry's concern; we sample 5 % and read nothing back. The one thing to watch: v9+ instruments Fastify through `@fastify/otel` semantics rather than `@opentelemetry/instrumentation-fastify` 0.44 (the version in tonight's stack traces). **Error capture** (`setupFastifyErrorHandler`) does not depend on it; **request tracing** might silently be absent if v10 wants `@fastify/otel` installed (Unknown 1). Tracing is not a requirement of Phase 18 — errors, cron, uptime are.
2. Nothing else observable: same DSN, same release tag (`RAILWAY_GIT_COMMIT_SHA`), same cron monitor slug and schedule, same scrubbing.

## Tasks
1. **Bump** *(low, Mac)* — `@sentry/node ^10.75.0`. `pnpm install` → lockfile. Depends on: none.
2. **Compile + unit lane** *(low)* — `pnpm typecheck`, `pnpm verify`. Expected: clean; if a type on `withMonitor`'s options or `beforeSend`'s event moved, fix the call, never the test. Depends on: 1.
3. **Deploy + prove** *(low, yours)* — Railway green; then one **real 5xx event** must reach `trainer-node-fastify` from the new release. Cleanest trigger without a test route: `curl -s -i https://www.just-train.fit/api/v1/exercises -H 'Origin: https://evil.example'` → a CORS rejection is a 500 through the error handler and is captured (that is exactly how tonight's proof worked). Check the event's `release` = new SHA and that `beforeSend` still scrubbed (no `data`/`cookies` on the event). Depends on: 2.
4. **Frontend (optional, own commit)** *(low)* — `@sentry/react ^10.75.0`, `pnpm --filter frontend build` (the only check that bundles), deploy, PWA reopened twice, `throw new Error('Sentry test')` from DevTools → event in `trainer-frontend`. Depends on: none (independent of 1–3).
5. **Docs** *(low)* — CHANGELOG; `SECURITY.md` audit section (re-run `pnpm audit`, record; `@opentelemetry/core` gone from reachable); DEPLOYMENT monitoring block unchanged (same vars). Depends on: 3.

## Execution order
1 → 2 → 3 → 5; 4 whenever. **Lockfile on the Mac.** No schema, no SQL. Rollback = revert + `pnpm install`.

## Verification — done means
- `pnpm verify` green; `sentry.test.ts` unchanged and green (privacy pinning intact).
- A 5xx from the new release visible in Sentry with request body/cookies/query absent.
- `pnpm audit` no longer lists `@opentelemetry/core`; count recorded.
- Cron heartbeat cannot be verified until `UPSTASH_REDIS_URL` is set (the scheduler is off) — **recorded as not verified**, not as passed.

## Unknowns
1. Whether v10 Fastify *tracing* needs `@fastify/otel` as an explicit dependency. Doesn't block: error capture is what the phase requires. If Sentry's Performance tab stays empty after the deploy and we want traces, add `@fastify/otel` in its own commit.
2. `import-in-the-middle` 3 / `require-in-the-middle` in v10 with the CJS `dist/` build — expected fine (v8 uses the same mechanism); the deploy proves it.

## Not in this plan
argon2 0.45 (tar), drizzle 0.45, Zod 4, Vitest 3.
