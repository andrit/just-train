# Phase 18 — Monitoring: errors, availability, field performance, first-party usage

**Date:** 2026-09-14 · **Scope:** backend + frontend + service worker + migration (additive) · **Cost:** $0 on current free tiers

## Decision
Survey and level choice: `.workbench/designer/current/task-plan-phase-18.md`. Chosen L2 (errors + availability) + L3 (Speed Insights) + L4 option A (own counters, no third-party analytics), with a hard requirement that usage tracking stays extensible to a paid sink.

## Backend Sentry — `apps/backend/src/instrument.ts`, `src/lib/sentry.ts`
```ts
// index.ts — first import, before fastify/pg/ioredis are required
import './instrument'
```
```ts
// lib/logger.ts — the chokepoint every route already uses
error: (msg, context) => {
  captureError(msg, context)   // Error instances only; inert without SENTRY_DSN
  return context ? log.error(msg, context) : log.error(msg instanceof Error ? msg.message : msg)
},
```
Uncaught 5xx: `attachSentryErrorHandler(app)` after `Fastify()`. Worker failures: `captureError(err, 'report-worker:<id>')` in both `worker.on('failed')` handlers and the scheduler's. Trainer tag: `setSentryUser(trainerId)` in `middleware/authenticate.ts`.

## Cron heartbeat — `queues/scheduler.ts`
```ts
if (job.name === 'alert-fanout')
  await withCronMonitor('scheduler-hourly', '0 * * * *', fanOutAtRiskAlerts)
```
The crontab string must match the `upsertJobScheduler` pattern above it. Sentry alerts on missed / late / failed check-ins.

## Service-worker errors — `sw.ts` → `lib/swErrorRelay.ts`
Worker: `self.addEventListener('error' | 'unhandledrejection')` → `postMessage({ type: 'SW_ERROR', kind, message, stack, filename, lineno })` to all windows. Page: `installSwErrorRelay()` rebuilds an `Error` with the worker's stack and `Sentry.captureException(err, { tags: { source: 'service-worker' } })`.

## Speed Insights — `main.tsx`
`<SpeedInsights sampleRate={0.2} />` from `@vercel/speed-insights/react`. Free tier 10k events / 30 days.

## First-party counters — `POST /telemetry` → `client_events`
- Schema: `db/schema/client-events.ts` (`id, trainer_id, name, props jsonb, client_ts, created_at`; index on trainer+name+created_at).
- Shared: `ClientEventSchema` (lower-case dotted name, flat scalar props), `ClientEventBatchSchema` (1–50), `TelemetryAcceptedResponseSchema`.
- Sink: `lib/telemetry/sink.ts` — `TelemetrySink { record(trainerId, events) }`; `postgresSink`, `noopSink`, `createTelemetrySink(TELEMETRY_SINK)`. A vendor sink is one new file + one case.
- Route: `routes/telemetry.ts` — `authenticate`, 60/min, 202 `{ accepted }`; sink injectable for tests.
- Frontend: `services/telemetry.ts` — `track(name, props)` folds repeats into one event with `count`; `flush()` every 30 s / on hidden / on `online`, only when authenticated and online; failures dropped, never queued. `initTelemetry()` in `main.tsx`.
- Signals: `sw.ts` NetworkFirst plugin `cachedResponseWillBeUsed` → `CACHE_HIT` (fires only when the network failed, so it means "served offline"); `syncService` → `offline.queue_flush`; `useEndSession` → `session.completed`; `useLogSet` → `record.detected` (load|volume); `pwa:installed` → `pwa.installed`.
- Prod SQL: `docs/sql/add-client-events-table.sql` (idempotent). Drizzle: `npx drizzle-kit generate` → `0006`.

## Tests
Backend: `__tests__/lib/sentry.test.ts`, `__tests__/lib/telemetrySink.test.ts`, `__tests__/routes/telemetry.test.ts` (+ `buildTelemetryTestApp` in `helpers/buildApp.ts`). Frontend: `__tests__/unit/swErrorRelay.test.ts`, `__tests__/unit/telemetry.test.ts`.

## Verify (user)
```
pnpm install
```
```
pnpm --filter @trainer-app/shared build
```
```
cd apps/backend && npx drizzle-kit generate
```
```
pnpm typecheck
```
```
pnpm --filter backend test
```
```
pnpm --filter frontend test
```
```
pnpm lint
```
Then the runbook: `docs/user-tasks/phase-18-monitoring-setup.md`.

## Deliberately not done
Session replay; PostHog; status page; log shipping — `DEFERRED_ITEMS.md` → "Monitoring L5".
