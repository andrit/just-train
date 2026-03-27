# SPA Transition Audit — TrainerApp

**Date:** March 2026  
**Current architecture:** React Router v6 multi-page SPA (routes render full page components)  
**Target architecture:** True SPA — view state managed in Zustand, navigation is animated panel transitions, URL is secondary and optional

---

## Your Diagnosis Is Correct

The current app is technically a single-page application in the React sense — it never full-page reloads. But it *behaves* like a multi-page app because every major transition is a URL change that unmounts the current tree and mounts a new one. That's the root of the session UI feeling wrong:

- Opening a client profile navigates away from the client list — you can't see both
- Starting a session navigates to `/session/:id` — the client context is gone
- Going back from a session page navigates away from the session entirely
- The live session screen has no awareness of where you came from

In a true SPA workout context, you'd never "navigate away" from a session. The session is always there. You slide a panel up. You slide it down. The underlying client profile stays mounted.

---

## Current Routing Inventory

| Route | Page | Route-dependent hooks | Severity to migrate |
|---|---|---|---|
| `/` | DashboardPage | none | Low |
| `/clients` | ClientsPage | none | Low |
| `/clients/:id` | ClientProfilePage | `useParams`, `useNavigate`, `useLocation` | Medium |
| `/exercises` | ExercisesPage | none | Low |
| `/sessions` | SessionsPage | none | Low |
| `/session/new` | SessionLauncherPage | `useNavigate`, `useSearchParams` | Medium |
| `/session/:id` | LiveSessionPage | `useParams`, `useNavigate` | High |
| `/session/:id/summary` | SessionSummaryPage | `useParams`, `useNavigate` | Medium |
| `/session/:id/history` | SessionHistoryPage | `useParams`, `useNavigate`, `useLocation` | Medium |
| `/templates` | TemplatesPage | none | Low |
| `/preferences` | PreferencesPage | none | Low |
| `/login` | LoginPage | `useNavigate` | Low |
| `/onboard` | OnboardingPage | `useNavigate` | Low |

**Total navigate() call sites:** 14 across 7 files  
**Total useParams() sites:** 5 (clientId, sessionId)  
**Total useSearchParams() sites:** 1 (clientId query param on launcher)

---

## What "True SPA" Means Here

The model shifts from **routes own data** to **Zustand owns data, views react to it**.

```
CURRENT:
  URL change → React Router mounts new page → page calls useParams → fetches data

TARGET:
  User action → Zustand state changes → panel/drawer animates in → component reads from store
  URL may update (for shareability/deep-linking) but is not the source of truth
```

The nav tabs (`Dashboard`, `Clients`, `Sessions`, `Exercises`) remain as top-level views — URL still changes between those. The change is in *how sub-views open*: client profiles, live sessions, session summaries — these become layered panels over the current view.

---

## Transition Plan — By Area

### 1. Navigation Shell
**Complexity: Low | Effort: 1 day**

The existing `Layout` + `NavLink` structure stays. The bottom tab bar and sidebar remain. The only change is that active-state management moves from React Router's `isActive` to a Zustand `activeTab` value. The URL still updates for tabs (good for direct links, PWA "install to home screen" memory).

No roadblocks.

---

### 2. Client Profile — Slide-Up Panel
**Complexity: Medium | Effort: 1–2 days**

Currently: tapping a client navigates to `/clients/:id`.  
Target: tapping a client opens a full-height slide-up panel (like iOS contacts detail) while the client list stays mounted underneath.

**What needs to change:**
- `ClientProfilePage` becomes `ClientProfilePanel` — accepts `clientId` as a prop instead of `useParams()`
- All `useParams()` calls replaced with prop
- `useNavigate('/clients')` back button replaced with `onClose()` callback
- `ClientsPage` manages `selectedClientId` state — null = list, string = panel open
- URL updates to `/clients/:id` as a side effect (not as the trigger)

**Roadblock — tab state within the profile:**
The profile has Overview / Timeline / Baseline tabs. Currently these are just local `useState`. That's fine in a panel, no change needed.

**No data migration needed** — TanStack Query cache is keyed by `clientId`, not URL.

---

### 3. Live Session — Persistent Overlay
**Complexity: High | Effort: 2–3 days**

This is the highest-value change and the reason the session UI feels disconnected.

Currently: starting a session navigates to `/session/:id`, losing all client context.  
Target: the session is a full-screen overlay that slides up from the bottom. Client profile (or launcher) is still mounted underneath. Tapping "minimise" or "back" slides the session down but keeps it running. Tapping the active session indicator re-opens it.

**What needs to change:**
- `LiveSessionPage` becomes `LiveSessionOverlay` — `sessionId` comes from `sessionStore`, not `useParams()`
- Rendered at the app root level (outside the Layout tree), always mounted when a session is active
- `sessionStore` already has the per-client session map — this becomes the trigger for showing the overlay
- Session persists in the overlay even when the trainer navigates to another client's profile
- A persistent "session in progress" indicator in the nav/header links back to the overlay

**Roadblock — multiple concurrent sessions:**
If trainer has sessions active for Client A and Client B simultaneously, which overlay is shown? Options:
- Show the most recently started/accessed session, with a switcher
- Show a "sessions in progress" pill that expands to let them pick

This is manageable but needs a design decision before building. Medium complexity.

**Roadblock — session summary:**
Currently the summary navigates to `/session/:id/summary`. In the SPA model, the summary replaces the session overlay content after end — same panel, different inner view. This is actually simpler than the current model.

---

### 4. Session Launcher — Bottom Sheet
**Complexity: Low | Effort: Half a day**

Currently: navigates to `/session/new` (with optional `?clientId=` query param).  
Target: a bottom sheet that slides up from within the client profile panel or from the dashboard. No navigation needed.

`useSearchParams` for `clientId` becomes a prop. `useNavigate` for going back becomes `onClose`.

No roadblocks.

---

### 5. Session History & Summary — Inner Panel Views
**Complexity: Low-Medium | Effort: 1 day**

Both are currently full-page routes. In the SPA model they become inner views within the session overlay or the client profile panel — navigating between them is a horizontal slide or a content swap, not a URL change.

`useParams` for `sessionId` becomes a prop. `useLocation` state (used in history page for "go back to where I came from") becomes a prop or store value.

---

### 6. URL as a Side Effect (Deep Linking Preservation)
**Complexity: Medium | Effort: 1 day**

The current URL-first model gives you deep linking for free. In the SPA model you need to preserve this by:
- Syncing view state to the URL as a side effect (`useEffect` that calls `history.pushState` or `navigate`)
- On app load, reading the initial URL and opening the appropriate panel/overlay

This is worth doing for PWA users who add the app to their home screen — they expect the app to resume where they left off.

React Router stays installed — it's used for the initial URL read and for tab navigation. The difference is that URL changes are *emitted* by state changes rather than *causing* them.

No major roadblocks, but requires careful handling of the initial load case.

---

## What Stays the Same

| Thing | Reason |
|---|---|
| TanStack Query | Already decoupled from routing. Zero changes. |
| Zustand stores | Already right. `sessionStore` is already the model for this. |
| React Router | Stays installed, used for tab nav and initial URL parsing |
| Bottom sheet / overlay primitives | `BottomSheet.tsx` already exists — extend it |
| Auth flow | Login and onboarding stay as full-page routes |
| Backend | Zero changes |

---

## Effort Summary

| Work item | Effort | Complexity |
|---|---|---|
| Navigation shell refactor | 1 day | Low |
| Client profile → panel | 1–2 days | Medium |
| Live session → persistent overlay | 2–3 days | High |
| Session launcher → bottom sheet | 0.5 days | Low |
| Session history/summary → inner views | 1 day | Low-Medium |
| URL side-effect sync | 1 day | Medium |
| **Total** | **6.5–8.5 days** | — |

---

## Recommended Approach

**Do it incrementally, not all at once.** The highest-value change — and the one that fixes your specific complaint about the session UI — is item 3 (live session as persistent overlay). That alone would make the session feel like it belongs in the app rather than being a separate page you navigate to.

**Suggested order:**
1. Live session → persistent overlay (fixes the core UX problem)
2. Session launcher → bottom sheet (natural companion)
3. Client profile → slide panel (unlocks the "plan the day" workflow)
4. Session history/summary → inner views
5. URL side-effect sync (polish, do last)

The navigation shell and URL sync can wait until everything else is panels-first.

---

## Blockers That Need Decisions Before Building

1. **Multiple concurrent sessions** — if trainer has two active sessions, which overlay shows? Need a switcher design.
2. **Session overlay z-index hierarchy** — the overlay needs to sit above client profiles but below modals. Need to define the layer stack.
3. **Android back button / browser back** — in the panel model, pressing back should close the panel, not navigate back in history. React Router's history stack needs to be managed carefully or you'll get double-backs.
