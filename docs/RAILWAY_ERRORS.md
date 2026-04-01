# Railway Hosting — Error Log & Resolution

> Living document. Updated until the deployment is stable.
> Stack: Fastify + Drizzle + pnpm monorepo + @trainer-app/shared workspace package

---

## Current Status: UNRESOLVED

**Latest error (still occurring):**
```
TypeError: schema.safeParse is not a function
    at fastify-type-provider-zod/dist/index.js:98
```

---

## Architecture Context

```
trainer-app/                     ← monorepo root
  apps/
    backend/                     ← Fastify API (Node CJS)
    frontend/                    ← React + Vite PWA
  packages/
    shared/                      ← Zod schemas + types used by both
```

The core tension: `@trainer-app/shared` is a TypeScript-only workspace package.
In dev, `tsx` handles it transparently. In production, plain `node` cannot run TypeScript files — so the compiled backend must never reference raw `.ts` at runtime.

---

## Error Timeline

---

### Error 1 — Healthcheck failure (host binding)

**Error:**
```
1/1 replicas never became healthy
Healthcheck failed
```

**Cause:** Server was binding to `localhost` instead of `0.0.0.0`. Railway's healthcheck probe comes from outside the container and can't reach `localhost`.

**Code:** `index.ts` had `NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'` — the condition was inverted. If `NODE_ENV` wasn't set yet at process start, it bound to `localhost`.

**Fix applied:**
```ts
// Before (wrong — depends on NODE_ENV being set correctly before bind)
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'

// After (correct — localhost only when explicitly in development)
const host = process.env.NODE_ENV === 'development' ? 'localhost' : '0.0.0.0'
```

**Status: ✅ Fixed**

---

### Error 2 — Missing environment variables

**Error:**
```
Error: Missing required environment variable: JWT_SECRET
```

**Cause:** Railway env vars not set in the service Variables tab.

**Fix:** Added all required env vars in Railway dashboard:
- `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_MS`
- `COOKIE_SECRET`, `NODE_ENV=production`, `PORT=3001`
- `CORS_ORIGIN`, `DATABASE_URL` (auto-injected by Postgres service)
- `CLOUDINARY_*` vars

**Status: ✅ Fixed**

---

### Error 3 — ERR_UNSUPPORTED_DIR_IMPORT

**Error:**
```
Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import
'/app/packages/shared/src/enums' is not supported
```

**Cause:** The compiled `dist/index.js` resolves `@trainer-app/shared` via the pnpm workspace symlink to `packages/shared/src/index.ts`. That file contains `export * from './enums'` — a directory import. ESM + Node.js does not support directory imports without explicit `/index`.

**First attempted fix:** Add `/index` to all directory imports in shared:
```ts
// Before
export * from './enums'
// After
export * from './enums/index'
```
Files changed: `index.ts`, `types/index.ts`, `schemas/index.ts`, `response-schemas.ts`, `utils/weight.ts`

**Result:** Fixed ERR_UNSUPPORTED_DIR_IMPORT but exposed the next error (see Error 4). The directory import fix is correct and should be kept.

**Status: ✅ Partially fixed** — directory imports resolved, but deeper issue exposed

---

### Error 4 — Static logo.svg not found (Swagger UI)

**Error:**
```
ENOENT: no such file or directory, open '/app/apps/backend/dist/static/logo.svg'
```

**Cause:** `import swaggerUi from '@fastify/swagger-ui'` at the top of `index.ts` caused Swagger UI to register its static file handler at module load time — before the `NODE_ENV !== 'production'` guard ran. It looked for `dist/static/logo.svg` which doesn't exist.

**Fix:** Moved swagger-ui to dynamic import inside `start()` behind the guard:
```ts
if (process.env.NODE_ENV !== 'production') {
  const { default: swaggerUi } = await import('@fastify/swagger-ui')
  await app.register(swaggerUi, { ... })
}
```

**Status: ✅ Fixed**

---

### Error 5 — schema.safeParse is not a function (Attempt 1 — esbuild)

**Error:**
```
TypeError: schema.safeParse is not a function
    at fastify-type-provider-zod/dist/index.js:98
```

**Cause:** Multiple copies of Zod in node_modules. `fastify-type-provider-zod` uses one instance to check schemas; the schemas defined in application code come from a different instance. `instanceof` checks fail across instances.

**First approach — esbuild bundle:**
Added `build.mjs` using esbuild to bundle the backend into a single `dist/index.js`, inlining `@trainer-app/shared` and marking everything else external including `zod`.

```js
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'cjs',
  external: ['zod', 'fastify', 'fastify-type-provider-zod', 'argon2', 'pg', ...],
  alias: { '@trainer-app/shared': '../../packages/shared/src/index.ts' },
})
```

**Result:** `schema.safeParse is not a function` persisted because:
- esbuild `alias` doesn't override workspace symlinks — Node still resolved `@trainer-app/shared` at runtime to the raw `.ts` source
- Even when the bundle ran, `shared`'s own `zod` dependency was a separate pnpm-installed copy

**Status: ❌ Did not fix safeParse**

---

### Error 6 — ERR_MODULE_NOT_FOUND (esbuild alias not working)

**Error:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/app/packages/shared/src/enums/index' imported from
/app/packages/shared/src/index.ts
```

**Cause:** esbuild's `alias` option does not override workspace packages that are already resolved via pnpm's virtual store in `node_modules`. The bundle contained a `require('@trainer-app/shared')` which at runtime followed the symlink to the raw TypeScript source. Node couldn't run it.

**Second approach — esbuild plugin:**
Replaced `alias` with an explicit `onResolve` plugin:
```js
plugins: [{
  name: 'resolve-workspace-shared',
  setup(build) {
    build.onResolve({ filter: /^@trainer-app\/shared$/ }, () => ({
      path: sharedSrc,
    }))
  },
}]
```

**Result:** Still failed. The `onResolve` plugin was being overridden because esbuild detected the path was inside the pnpm virtual store and treated it as a known external.

**Status: ❌ Did not fix — esbuild workspace resolution unreliable**

---

### Error 7 — safeParse (Attempt 2 — pnpm override)

**Approach:** Added pnpm workspace override to force single Zod instance:
```json
// root package.json
"pnpm": {
  "overrides": { "zod": "^3.23.8" }
}
```
Also moved `zod` from `dependencies` to `peerDependencies` in shared, so pnpm wouldn't install a local copy.

**Result:** Override didn't take effect because the `pnpm-lock.yaml` committed didn't reflect the override — user had to run `pnpm install` locally first to regenerate it.

**Status: ❌ Correct direction, but lockfile problem meant it didn't deploy correctly**

---

### Error 8 — Typecheck failures after tsconfig paths

**Error:**
```
error TS6059: File '...packages/shared/src/...' is not under 'rootDir'
```

**Cause:** Added `paths` to backend `tsconfig.json` pointing to shared TypeScript source. This pulled shared source files into the backend's compilation scope, violating `rootDir: ./src`.

**Fix:** Removed `paths`. The workspace symlink + `main` field handles runtime resolution; `paths` is not needed and causes TS6059.

**Status: ✅ Reverted cleanly**

---

### Error 9 — schema.safeParse (latest — current)

**Error:**
```
TypeError: schema.safeParse is not a function
    at fastify-type-provider-zod/dist/index.js:98
```

**Current config:**
- esbuild is removed
- Backend uses plain `tsc --outDir dist`
- shared `main` now points to `./dist/index.js`
- Railway build: `pnpm install --frozen-lockfile && pnpm --filter @trainer-app/shared build && pnpm --filter backend build`
- shared has `prepare` script so `pnpm install` auto-compiles it

**Current hypothesis:**
The `pnpm.overrides` for `zod` may not have taken effect (lockfile may not have been regenerated locally before commit). This means pnpm installs multiple Zod copies and the instance conflict persists.

**Next steps to try:**
1. Confirm `pnpm-lock.yaml` was regenerated locally with `pnpm install` after adding the override
2. Check Railway build logs to confirm `pnpm --filter @trainer-app/shared build` actually ran and succeeded
3. Check `node_modules/.pnpm` on Railway to confirm there's only one Zod version: `ls node_modules/.pnpm | grep zod`

---

## What Is Known To Be Correct

These changes are confirmed working and should not be reverted:

| Change | File | Reason |
|--------|------|--------|
| Host binding fix | `apps/backend/src/index.ts` | Railway healthcheck needs 0.0.0.0 |
| Dynamic swagger-ui import | `apps/backend/src/index.ts` | Prevents logo.svg ENOENT in prod |
| `/index` on all enums imports | `packages/shared/src/**` | Fixes ERR_UNSUPPORTED_DIR_IMPORT |
| `NODE_ENV=production` in Railway | Railway dashboard | Required for cookie/cors/logging |

---

## Root Problem Summary

There are **two independent problems** that both need to be solved simultaneously:

### Problem A — Raw TypeScript at runtime
At runtime, `node dist/index.js` resolves `@trainer-app/shared` to raw `.ts` source (via workspace symlink → `main: ./src/index.ts`). Node cannot run TypeScript.

**Correct fix:** Compile shared to CJS before backend compiles. Set `main: ./dist/index.js` in shared. Run `pnpm --filter @trainer-app/shared build` before `pnpm --filter backend build` in Railway.

### Problem B — Duplicate Zod instances
pnpm installs Zod separately in `packages/shared/node_modules/zod` AND in the root/backend. `fastify-type-provider-zod` uses one copy; app schemas come from another. `safeParse` fails.

**Correct fix:** `pnpm.overrides` in root `package.json` with `"zod": "^3.23.8"` + `pnpm install` run locally to regenerate lockfile before committing.

### Why each fix alone fails
- Fix A alone → `schema.safeParse is not a function` (duplicate Zod)
- Fix B alone → `ERR_MODULE_NOT_FOUND` / `ERR_UNSUPPORTED_DIR_IMPORT` (raw TypeScript)
- Both together → should work

---

## Current File State

### `packages/shared/package.json`
```json
{
  "main":  "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "prepare": "tsc -p tsconfig.build.json",
    "build":   "tsc -p tsconfig.build.json"
  },
  "dependencies": { "zod": "^3.23.8" }
}
```

### `packages/shared/tsconfig.build.json`
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module":           "CommonJS",
    "moduleResolution": "node",
    "outDir":           "./dist",
    "rootDir":          "./src",
    "declaration":      true
  },
  "include": ["src"]
}
```

### `package.json` (root)
```json
{
  "pnpm": {
    "overrides": {
      "zod": "^3.23.8"
    }
  }
}
```

### `railway.json`
```json
{
  "build": {
    "buildCommand": "pnpm install --frozen-lockfile && pnpm --filter @trainer-app/shared build && pnpm --filter backend build"
  },
  "deploy": {
    "startCommand": "pnpm --filter backend start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60
  }
}
```

### `apps/backend/package.json` build script
```json
"build": "tsc --outDir dist"
```

---

## Checklist Before Each Deploy Attempt

- [ ] Ran `pnpm install` locally after any `package.json` change
- [ ] `pnpm-lock.yaml` is committed with latest changes
- [ ] `packages/shared/dist/` is in `.gitignore` (should not be committed)
- [ ] Railway env vars are all set (JWT_SECRET, COOKIE_SECRET, DATABASE_URL, etc.)
- [ ] Railway build log shows `pnpm --filter @trainer-app/shared build` succeeded
- [ ] Railway build log shows no TypeScript errors in backend build

---

## .gitignore Entries Required

```
packages/shared/dist/
apps/backend/dist/
apps/frontend/dist/
```

---
*Last updated: session Mar 31 2026*

---

### Error 10 — schema.safeParse still failing despite pnpm.overrides

**Finding:** `pnpm.overrides` forces the same Zod **version** across the workspace but does NOT prevent pnpm from installing a **local physical copy** inside `packages/shared/node_modules/zod`. Two copies exist at the same version but are separate module instances — `instanceof` checks fail across them.

**Root cause confirmed:** `zod` in shared's `dependencies` = pnpm installs a local copy regardless of overrides.

**Fix:**
1. Move `zod` from `dependencies` → `peerDependencies` in `packages/shared/package.json` — tells pnpm not to install a local copy
2. Add `.npmrc` at workspace root with `hoist-pattern[]=zod` — forces zod to root node_modules
3. Keep `pnpm.overrides: { "zod": "^3.23.8" }` for version consistency

Combined effect: one physical copy of zod at workspace root. All `require('zod')` calls — from shared's compiled dist, from backend routes, from fastify-type-provider-zod — resolve to the same instance.

**Status: PENDING DEPLOY**
