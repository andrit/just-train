# User Task: Phase 12 Offline Indicator Smoke Test

**When to do this:** Phase 12 advance criteria — verify the offline indicator works correctly
in a real offline scenario before closing the phase. Takes ~5 minutes.

**What you're testing:** `OfflineBanner.tsx` — the thin bar that appears at the top of the app
when offline or syncing. It has five states:

| State | What triggers it | Message |
|---|---|---|
| Offline, no queued writes | Go offline | "You're offline — session data is saved locally" |
| Offline, queued writes | Go offline after logging a set | "Offline — N writes queued" |
| Syncing | Come back online with queued writes | "Syncing N writes…" |
| Sync error | Sync fails | "N writes failed to sync — tap to retry" |
| Online, idle | Everything normal | Banner hidden |

---

## Setup

Open the app in Chrome. Log in. Navigate to the dashboard.

Open DevTools: `Cmd+Option+I` → **Network** tab → throttling dropdown → **Offline**.

---

## Test 1 — Offline with no queued writes

1. Set Network to **Offline**
2. Navigate between tabs (dashboard, sessions, clients)
3. **Expected:** Amber banner appears at top — "You're offline — session data is saved locally"
4. Set Network back to **Online**
5. **Expected:** Banner disappears within 1–2 seconds

---

## Test 2 — Offline with queued writes

1. Start a live session and log one set (while **online**)
2. Set Network to **Offline**
3. Log another set
4. **Expected:** Amber banner — "Offline — 1 write queued" (or however many)
5. Set Network back to **Online**
6. **Expected:** Banner briefly shows "Syncing 1 write…" in blue, then disappears

---

## Test 3 — Banner is visible while scrolling

1. Set Network to **Offline**
2. Open a session with several exercises — scroll down
3. **Expected:** The offline banner stays pinned at the top, visible throughout

---

## Test 4 — iOS install instructions (while you're here)

On an iPhone in Safari (not installed to home screen yet):

1. Open the app after completing at least one session
2. **Expected:** A bottom card appears: "Train anywhere, even without signal"
   with the Share icon and "Add to Home Screen" instructions
3. Tap × to dismiss
4. **Expected:** Banner never reappears (marked seen in localStorage)

If you don't have an iPhone handy, you can simulate:
- Chrome DevTools → **Sensors** → set UA to iPhone
- Note: `beforeinstallprompt` won't fire on a simulated iOS UA, but the iOS instruction path in `InstallPromptBanner` can be manually triggered via the passive install icon in the nav

---

## Pass criteria

- [ ] Offline banner appears when network drops
- [ ] Correct message for no-queue vs. queued-writes state
- [ ] Banner disappears when back online
- [ ] "Syncing…" state visible briefly during replay
- [ ] Banner stays visible while scrolling
- [ ] iOS install instructions appear (or iOS UA simulation shows the share-sheet text)

When all boxes are checked, Phase 12 is clear to close.
