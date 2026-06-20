# Phase 10 — QA Gate Checklist

> Test against the **production Vercel deployment** (not localhost).
> Each item must be verified on a real device, not browser DevTools emulation.
> Check each box as you confirm it. Phase 10 closes when all advance criteria are met.

---

## Setup

- [ ] Vercel deployment is current (latest main branch)
- [ ] You have an Android device with Chrome
- [ ] You have an iPhone with Safari 16.4 or later (Settings → General → About → iOS version)
- [ ] Both devices are on the same network or have mobile data

---

## 1. Android Chrome — Install to Home Screen - CONFIRMED

1. [ ] Open the Vercel URL in Chrome on Android
2. [ ] Log in and navigate around briefly (let the SW install)
3. [ ] Tap the browser menu (⋮) → "Add to Home screen" or wait for the install banner
4. [ ] Confirm the icon appears on the home screen with the name "Trainer"
5. [ ] Tap the icon — app opens **without** a browser address bar (standalone mode)
6. [ ] The URL bar and browser chrome are completely absent

**Advance criterion: ✅ Android home screen icon confirmed**

---

## 2. iOS Safari — Install to Home Screen

1. [ ] Open the Vercel URL in Safari on iPhone (must be Safari — Chrome on iOS cannot install PWAs)
2. [ ] Log in and navigate around briefly
3. [ ] Tap the Share button (rectangle with arrow at bottom of screen)
4. [ ] Scroll down and tap "Add to Home Screen"
5. [ ] Confirm the icon appears with the name "Trainer"
6. [ ] Tap the icon — app opens in standalone mode (no Safari chrome)
7. [ ] Log in if prompted (httpOnly cookie does not persist across installs on iOS — first launch requires login)

**Advance criterion: ✅ iOS home screen icon confirmed**

---

## 3. Offline Behavior — Installed App (Device Network Kill)

> Must be tested on the **installed app** with **device-level network disabled** — not DevTools offline toggle.

### Setup
1. [ ] Open the installed app from the home screen icon (standalone mode)
2. [ ] Log in if needed
3. [ ] Navigate to the Dashboard — confirm it loads

### Kill the network
4. [ ] Enable Airplane Mode on the device (or disable Wi-Fi + mobile data)
5. [ ] Attempt to navigate to the Dashboard, Clients, and Sessions pages

### Verify offline screens
6. [ ] App does **not** crash or show a browser error page
7. [ ] Cached pages render from SW precache (may show stale data or empty lists — both acceptable)
8. [ ] If session is in progress: session logging UI still responds (sets can be entered)
9. [ ] If not authenticated when offline: **OfflineAuthScreen** appears (not a blank page or login loop)

### Restore network
10. [ ] Disable Airplane Mode
11. [ ] App reconnects — any queued offline writes flush (check sync indicator if visible)

**Advance criterion: ✅ Offline mode verified on installed app**

---

## 4. Push Notifications

> **Deferred past SaaS launch** — VAPID keys not generated, no subscription endpoint.
> This item is formally skipped for Phase 10.

- [x] Skipped — documented in `docs/DEFERRED_ITEMS.md` and `docs/user-tasks/pwa-caching-strategy.md`

---

## 5. Service Worker Update Flow

> `registerType: 'autoUpdate'` is set in `vite.config.ts`. The SW updates silently — no user prompt.
> This test confirms the silent update mechanism works end-to-end.

1. [ ] Note the current state of some visible UI element (e.g. a button label, page title, version string if visible)
2. [ ] Make a trivial visible change and deploy to Vercel (e.g. change a heading, add a test string to the dashboard)
3. [ ] On the installed app: close the app fully (remove from recents on Android; swipe up on iOS)
4. [ ] Reopen the app from the home screen icon
5. [ ] The new content is visible — the update applied automatically without any prompt

**Note:** If the change doesn't appear after one reopen, try closing and reopening once more. `autoUpdate` activates the waiting SW on the next navigation after it installs.

---

## 6. Lighthouse ≥ 90 — Mobile

> Phase 7 confirmed ≥ 90 in DevTools. This confirms it holds on real hardware against the production deployment.

### Option A — Chrome DevTools on desktop (against Vercel URL)
1. [ ] Open the Vercel URL in Chrome on desktop
2. [ ] DevTools → Lighthouse tab → Mobile → Categories: Performance + Accessibility + Best Practices + PWA
3. [ ] Run audit
4. [ ] Screenshot results

### Option B — PageSpeed Insights (preferred — uses real mobile hardware)
1. [ ] Go to [pagespeed.web.dev](https://pagespeed.web.dev)
2. [ ] Enter the Vercel production URL
3. [ ] Run — wait ~60s
4. [ ] Screenshot results

### Pass criteria
- [ ] Performance ≥ 90 (mobile)
- [ ] Accessibility ≥ 90
- [ ] Best Practices ≥ 90
- [ ] PWA badge present (or Lighthouse PWA checks passing)

**Advance criterion: ✅ Lighthouse ≥ 90 mobile confirmed**

---

## Phase 10 Advance Criteria Summary

| Criterion | Status |
|---|---|
| Android home screen icon confirmed | ⬜ |
| iOS home screen icon confirmed | ⬜ |
| Offline mode tested on installed app (device-level network kill) | ⬜ |
| Lighthouse ≥ 90 mobile confirmed | ⬜ |

Phase 10 closes when all four are checked. Update `docs/PROJECT_STATE.md` Phase 9→10 row to ✅ and record any issues found as new deferred items in `DEFERRED_ITEMS.md`.

---

## Issues Found During QA

> Record anything broken or unexpected here as you test. Each issue gets a deferred item or an immediate fix.

| Issue | Severity | Resolution |
|---|---|---|
| | | |
