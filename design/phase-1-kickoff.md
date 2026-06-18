# Phase 1 Kickoff — Scaffold

**Phase:** 1 — Scaffold  
**SDLC owner:** Claude  
**Started:** 2026-06-18  
**Context:** TrainerApp is an existing app at v2.14.0 (React 18 + Vite, Fastify 4, Drizzle ORM + PostgreSQL, Railway + Vercel). Phase 1 is an **audit + gap-fill**, not a greenfield scaffold.

---

## Phase 1 deliverables (from SDLC)

| Deliverable | Status | Notes |
|------------|--------|-------|
| Framework initialized with PWA support (vite-plugin-pwa / Workbox) | ⚠️ Partial | vite-plugin-pwa + Workbox mentioned in user-flow as existing foundation — needs verification |
| Web App Manifest configured (name, icons 192/512/maskable, theme_color, display: standalone, start_url) | ❓ Unknown | Must verify manifest completeness in DevTools |
| Service worker registered and active in dev mode | ⚠️ Partial | SW foundation exists; contextual nudge trigger not implemented (TF-12 obstacle) |
| HTTPS configured for local testing (ngrok or Vite's HTTPS flag) | ❓ Unknown | Vercel provides HTTPS in prod; local dev HTTPS status unknown |
| App shell structure in place (header, nav, content slot) | ✅ Likely complete | Existing app at v2.14.0 with full nav |
| TypeScript configured | ✅ Known complete | pnpm monorepo, React 18 + Vite + TS |
| Environment variable structure documented | ❓ Unknown | `.env` exists; documentation status unknown |

---

## Phase 1 advance criteria (from SDLC)

1. Chrome DevTools → Application → Manifest shows valid manifest with no errors
2. Service worker registered and showing as 'activated and running' in DevTools
3. App passes Lighthouse installability check (no red flags)

---

## What needs to happen in Phase 1

### Step 1 — Audit existing PWA infrastructure
Read the existing codebase to establish baseline:
- `vite.config.ts` — confirm vite-plugin-pwa present and configured
- `public/manifest.json` or inline manifest in vite config — check all required fields
- Service worker registration — confirm SW registers in dev mode
- Check `index.html` for manifest link and theme-color meta
- Check that icons exist at correct sizes (192px, 512px, maskable variant)

### Step 2 — Fill gaps found in audit
Common gaps in existing apps:
- Missing maskable icon (most apps have regular icons but not maskable)
- `display: standalone` not set (app opens in browser instead of native-like)
- `start_url` not set or set to a route that requires auth (causes install to land on login)
- SW not registering in dev mode (vite-plugin-pwa defaults to prod-only in some configs)
- `theme_color` missing (Chrome toolbar doesn't match app color on Android)

### Step 3 — Verify advance criteria
Run Lighthouse installability check against local build. Target: all three advance criteria green before advancing to Phase 2.

---

## Key Phase 0 decisions that affect Phase 1

| Decision | Phase 1 implication |
|----------|-------------------|
| Three session creation paths (planned/build-first/jump-in) | App shell must restore `in_progress` sessions correctly on cold start |
| Offline queue for set logging | Service worker scope must cover `/session-exercises` and `/sets` POST paths |
| `MyTrainingPage` gap (G1/P8) — currently redirects to `/clients/:selfClientId` | Phase 1 doesn't fix this; Phase 3 does; SW routing must not hard-code the wrong path |
| Install prompt fires after first `SessionCompleted` | `beforeinstallprompt` capture must be wired before the event fires — part of app shell init |

---

## Phase 1 does NOT include

- Schema changes (Phase 2)
- Fixing G1/P8 URL leak (Phase 3)
- Building billing context (Phase 3/5)
- Push notification VAPID setup (Phase 6)
- Caching strategy per-endpoint (Phase 4)

---

## First action when Phase 1 begins

```
Read apps/propflow/vite.config.ts and any manifest configuration to establish
what PWA infrastructure is already in place.
```

Wait — check the actual app directory name. From the git status at session start, the apps include `apps/propflow/`. But the project is named `trainer`. Confirm the correct app path before reading files.

Actually the workspace is `/workspace/` which is the TrainerApp repo itself. The Vite config is at the project root, not in a subdirectory. Start with:

```
Read /workspace/vite.config.ts
Read /workspace/index.html  
find /workspace/public -name "manifest*" or check vite.config.ts for manifest inline config
```
