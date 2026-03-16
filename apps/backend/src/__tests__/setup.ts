// ------------------------------------------------------------
// __tests__/setup.ts — Global test environment setup
//
// This file runs BEFORE any test module is imported.
// Order matters: auth.service.ts calls requireEnv('JWT_SECRET')
// at module evaluation time, so the env var must already be set.
//
// Do NOT import application modules here — this file only sets
// up the environment that those modules will read when they load.
// ------------------------------------------------------------

// ── Auth secrets ─────────────────────────────────────────────────────────────
// Test-only values — never used in production.
// Long enough to satisfy any minimum-length checks.
process.env.JWT_SECRET      = 'test-jwt-secret-that-is-long-enough-for-testing-only-do-not-use-in-prod'
process.env.COOKIE_SECRET   = 'test-cookie-secret-32-bytes-ok!!'
process.env.JWT_ACCESS_TTL  = '15m'
process.env.JWT_REFRESH_TTL_MS = String(7 * 24 * 60 * 60 * 1000)

// ── Database ──────────────────────────────────────────────────────────────────
// A dummy URL — the actual pg Pool is never created in tests because
// the db module is mocked in all route test files.
// auth.service pure-function tests don't import db at all.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db'

// ── Environment ───────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test'
