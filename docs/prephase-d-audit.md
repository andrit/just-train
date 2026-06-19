# Pre-Phase D Audit — TrainerApp

**Date:** 2026-06-19
**Purpose:** Inventory of what exists and what is missing before Phase D (Design) work begins.
**SDLC reference:** `/workbench/project-types/pwa/project.json` → phase `D`

---

## What exists

| Deliverable | Location | Status |
|---|---|---|
| Product story | `design/product-story.md` | ✅ Complete — target user, problem, design thesis, PWA promise. Seeded to RAG. |
| Kano model | `design/kano.md` | ✅ Complete — Must-be / Performance / Delighter classifications per persona |
| Task flow | `design/task-flow.md` | ✅ Complete — updated for flat session structure in Phase 0 sign-off |
| User flow | `design/user-flow.md` | ✅ Complete — updated for flat session structure |
| Event storm | `design/event-storm.md` | ✅ Complete — 89 chunks, all domain events captured |
| Bounded contexts | `design/bounded-contexts.md` | ✅ Complete — 8 contexts (Identity, Training, Sync, Athlete, Roster, Insight, PWA, Billing) |
| Glossary | `design/glossary.md` | ✅ Complete — ubiquitous language with billing terms |
| Offline contract | `design/offline-contract.md` | ✅ Complete — what works offline, what degrades, what is blocked |
| Phase 0 sign-off | `design/phase-0-signoff.md` | ✅ Signed off 2026-06-18 by Andrew Ritter |
| Color tokens | `apps/frontend/tailwind.config.js` | ✅ 6 named tokens (forge-black, chalk-white, iron-grey, ember-red, command-blue, signal-yellow) + surface palette + font stack |
| Color system doc | `docs/COLOR_SYSTEM.md` | ✅ Full theory, rules, token rationale |
| Offline indicator | `apps/frontend/src/components/shell/OfflineBanner.tsx` | ✅ 4 states: offline / queued / syncing / error+retry |
| App shell / nav | `apps/frontend/src/components/layout/Layout.tsx` | ✅ Tab bar, header, content slot |
| Install prompt capture | `apps/frontend/src/lib/pwaInstall.ts` | ✅ `beforeinstallprompt` captured before React mounts; `showPWAInstallPrompt()` exported |

---

## What is missing

| Deliverable | Gap | Phase D criteria it blocks |
|---|---|---|
| `docs/product-development/product-synthesis.md` | ✅ Approved 2026-06-19 | Advance criterion met |
| `design/wireframes/wireframes.html` | ❌ No wireframes directory, no file | Advance criterion: must cover all planned screens including install flow and offline states |
| Screen × offline-state matrix | ❌ Offline contract defines categories but does not map them screen-by-screen | Advance criterion: every screen has an explicit offline state designed |
| Install prompt UI component | ❌ Event is captured but no component triggers it; timing, copy, and dismiss behaviour undecided | Advance criterion: install prompt designed with specific copy |
| Push notification design | ❌ Use cases referenced in product story but no timing / copy / action decisions made | Phase D deliverable |
| Loading / empty / error state inventory | ❌ States exist in code for individual screens but not formally inventoried | Phase D deliverable |

---

## Advance criteria status

| Criterion | Status |
|---|---|
| Every screen has an explicit offline state designed | ✅ Annotated in wireframes.html per screen (2026-06-19) |
| Install prompt designed with specific copy (not "Add to home screen") | ✅ Copy: "Train anywhere, even without signal. Your session data never disappears." — fires after first completed session, once, non-recurring (2026-06-19) |
| Mobile layout designed first — PWAs are primarily a mobile technology | ✅ wireframes.html built at 375px mobile-first throughout (2026-06-19) |
| `docs/product-development/product-synthesis.md` agreed as north star | ✅ Approved 2026-06-19 |
| `design/wireframes/wireframes.html` covers all screens including install + offline states | ✅ 20 screens, all offline states annotated, install prompt screen included (2026-06-19) |

**All 5 advance criteria met. Phase D complete — signed off 2026-06-19.**

---

## Design system review — open questions

### Background colour

Iron Grey (`#8A9099`) is labelled as "page background" in `tailwind.config.js` but `#8A9099` is a medium grey — too light to be a page background in a dark UI. The actual dark look comes from the surface palette (`surface.DEFAULT: #1E1E1E`). The old background was `#1a1a2e` (dark navy blue), removed in v2.14.0.

**Open question:** restore a dark grey-blue page background. Candidate: gun metal `#1c2028`. Pair with a CSS crosshatch texture using Iron Grey at low opacity.

### Borders

Current border token: `surface.border: #404040` — flat 1px, subtle. A more pronounced border system using variable weights (1.5px resting, 2px active/destructive) and a crosshatch texture on the resting state would give cards physical structural weight consistent with the "cast iron / knurling" language in COLOR_SYSTEM.md.

### CSS framework

Current stack: Tailwind CSS utilities + custom tokens. A Material UI migration was considered and rejected — migration cost is prohibitive at v2.14.0 and MUI's opinions fight against the custom industrial aesthetic and crosshatch patterns. **Recommendation: stay on Tailwind.** If pre-built accessible components are needed, add shadcn/ui selectively (Radix UI primitives, Tailwind-native, no migration required).

---

## Recommended Phase D sequence

**Track 1 — Product positioning** (prerequisite for wireframes):
Write and agree `docs/product-development/product-synthesis.md` — competitive position, target buyer, value chain, AI/voice/integration stance. This must be approved before wireframes are locked.

**Track 2 — Design system update** (before wireframes are styled):
- Update `tailwind.config.js`: add gun metal background token, crosshatch utility
- Update `COLOR_SYSTEM.md`: document background change and crosshatch convention
- Define border weight rules
- Build one test card in dev to validate before committing to wireframes

**Track 3 — Wireframes and screen inventory** (after Tracks 1 and 2):
- `design/wireframes/wireframes.html` — self-contained, all screens, 375px mobile-first
- Screen × offline-state matrix
- Install prompt component + copy
- Push notification design decisions
