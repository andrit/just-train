# Account hardening — consent capture, `COOKIE_SECRET` fail-fast, email + queue go-live

**Date:** 2026-11-13 · **Task:** #23 (D1, D2, D3) · **Source audit:** `docs/paid-user-account-audit.md`

Closes the three DEFINITE findings of the paid-user account audit. D2 was an env/config change on
Railway; D1 and D3 are code.

---

## D2 — Email + queue go-live (env, verified)

Set on Railway: `UPSTASH_REDIS_URL`, `RESEND_API_KEY`, `REPORT_FROM_EMAIL=no-reply@just-train.fit`,
`APP_URL=https://www.just-train.fit`; `just-train.fit` verified in Resend.

- With `UPSTASH_REDIS_URL` present, `index.ts` starts the BullMQ workers + scheduler at boot
  (`report-fanout`, `alert-fanout`, `challenge-expiry`, `account-purge`, `refresh-token-cleanup`).
- The report/alert workers call `sendReport` / the alert email path, which previously threw
  `RESEND_API_KEY is not set`. With the trio set they now deliver.
- **Verified end-to-end:** `POST /api/v1/auth/forgot-password` for the owner account → Resend
  dashboard shows `Delivered` → reset email received, link opens `https://www.just-train.fit/...`.
- **Observability fix:** the queue-start log line was `info`, but the prod logger runs at `warn`
  (`index.ts` `level: NODE_ENV === 'production' ? 'warn' : 'info'`), so a healthy start was invisible
  in Railway logs. Bumped to `warn`.

## D1 — `COOKIE_SECRET` fail-fast (`apps/backend/src/index.ts`)

Replaced the silent public-default fallback with a production guard mirroring `JWT_SECRET`:

```ts
const cookieSecret = process.env.COOKIE_SECRET
if (!cookieSecret && process.env.NODE_ENV === 'production') {
  throw new Error('Missing required environment variable: COOKIE_SECRET')
}
app.register(cookie, { secret: cookieSecret ?? 'dev-only-insecure-cookie-secret' })
```

The secret is unused today (no cookie is set with `signed: true`), so live severity is low — but a
public default becomes a forgery vector the moment one is. `COOKIE_SECRET` is set on Railway.
**⚠️ Deploy gate:** with this guard, an unset `COOKIE_SECRET` in production fails the boot (healthcheck
→ rollback).

## D3 — Consent recorded at register

A required Terms/Privacy checkbox now gates registration (replacing the passive "by creating an
account you agree…" line), and the server records *what* was agreed to and *when*.

- **Shared** (`packages/shared/src/schemas/index.ts`): `TERMS_VERSION = '2026-06-21'`;
  `acceptTerms: z.literal(true)` added to `CreateTrainerSchema` (rejects missing/false).
- **Columns** (`apps/backend/src/db/schema/trainers.ts`): `terms_accepted_at timestamp`,
  `terms_version text` — both nullable (older rows stay null until backfilled).
- **Register handler** (`routes/auth.ts`) stamps `termsAcceptedAt: new Date()`, `termsVersion: TERMS_VERSION`.
- **4-file column checklist:** serializer (`serializeTrainer`), `TrainerResponseSchema`
  (`.nullable().default(null)`), and `makeTrainer` factory all carry the two fields.
- **Frontend** (`pages/LoginPage.tsx`): accessible required checkbox (`<label htmlFor>`, `aria-invalid`,
  links `stopPropagation` so they don't toggle the box), client-side validation, sends `acceptTerms`.
- **Migration** (`docs/sql/add-terms-consent-columns.sql`): additive `ADD COLUMN IF NOT EXISTS` DDL +
  a `BEGIN…ROLLBACK` dry-run backfill (existing rows: `terms_accepted_at = created_at`,
  `terms_version = '2026-06-21'`, only where `created_at >= '2026-06-21'`; pre-terms rows left null),
  with before/after report SELECTs.
- **Tests** (`__tests__/routes/auth.test.ts`): register rejects without consent (missing and `false`);
  register stamps `termsVersion` + a `termsAcceptedAt` Date. Mass-assignment test body updated.
  Frontend fixtures (`handlers.ts`, `authStore.test.ts`, `api.test.ts`) carry the new response keys.

## Still open (task #23)

- **P1** — confirm `X-Forwarded-For`/`trustProxy` handling (curl the Railway host with a forged XFF).
- **P2** — confirm iOS standalone-PWA export download.
- **P3** — move the login-lockout / rate-limit store from in-process to Redis. **Adding
  `UPSTASH_REDIS_URL` for the queue did not change this** — `lockout.service.ts` still uses the
  in-memory store. Only matters at >1 replica.

## Deploy order (important)

1. Apply `docs/sql/add-terms-consent-columns.sql` to prod (review dry-run, flip `ROLLBACK`→`COMMIT`).
2. `cd apps/backend && npx drizzle-kit generate` and commit the migration.
3. Confirm `COOKIE_SECRET` is set on Railway (a 64-char random hex).
4. Push → redeploy. (SQL-before-code is safe because the columns are nullable; code-before-SQL would
   500 the register insert.)
5. Run `pnpm verify` (vitest) before pushing — container runs tsc/eslint only.
