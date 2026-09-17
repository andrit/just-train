// ------------------------------------------------------------
// instrument.ts — Sentry bootstrap. MUST be the first import in index.ts.
//
// @sentry/node (v10 since 2026-09-17) instruments Fastify/pg/ioredis by hooking `require`, so
// `Sentry.init` has to run before those modules are loaded. TypeScript emits
// CJS `require` calls in source order, so importing this file first is enough.
//
// No-ops without SENTRY_DSN (dev, CI, tests). See lib/sentry.ts for the
// helpers the rest of the app uses — nothing else imports @sentry/node.
// ------------------------------------------------------------

import * as dotenv from 'dotenv'
import { initSentry } from './lib/sentry'

// index.ts also calls dotenv.config() — but only after this file has run.
// dotenv never overrides variables that are already set, so calling it here
// first is safe and means a local .env SENTRY_DSN is honoured, not just
// Railway-injected env.
dotenv.config()
initSentry()
