# Light / Dark Theme

**Goal:** offer a designed light theme alongside the current dark one, selectable (system / light /
dark). Not just `prefers-color-scheme` cosmetics — a genuine light palette, because the point is
**visual ergonomics**: dark works for some athletes, a white-based light theme is what lets others
read the screen at a glance. Both themes are *designed*, not auto-inverted. Fits the product's "get
out of the athlete's way" principle — the interface adapts to how the person sees, rather than
forcing one ground on everyone.

**Written:** 2026-10-21 · **Status:** PLAN — token-infrastructure down-payment BUILT 2026-10-21;
the design pass + sweep (Steps 0, 2–4) are post-launch, pending appetite.

---

## Grounded findings (read the code, 2026-10-21)

- **Dark-only by construction.** ~1,000 raw `text-gray-N` + ~200 `text-white` occurrences across
  **116 of 140** components, each a fixed step chosen to read on near-black. A theme is a
  **tokenization sweep**, not a config flip.
- **Surfaces are already half-tokenized** (good foundation): `surface-border` (288×), `bg-surface`
  (115×), `bg-brand-*` (90×). Text is the un-tokenized half.
- **Hardcoded dark hex** in the charts: `heatRamp.ts` (`BASE_FILL #3F444C`, blue tiers),
  `MuscleMap.tsx` (`BASE_FILL/STROKE`, Ember fills), `BodyHeatMap.tsx` (`BASE_STROKE`). Plus the
  **crosshatch page texture** (`index.css`, hardcoded `#0d0d0d` + iron-grey lines) and the
  **focus-ring offset** (`ring-offset-black`).
- **No light palette exists.** `COLOR_SYSTEM.md` defines the 6 brand tokens + dark backgrounds only.
- No existing UI theme preference; colors were fixed hex; no `dark:` variants anywhere; `darkMode`
  unset.

## Architecture (chosen): variable-backed semantic tokens, no `dark:` variants

Semantic tokens in `tailwind.config` as `rgb(var(--x) / <alpha-value>)`; the CSS variables live in
`index.css` and **flip** by theme. The app uses zero `dark:` variants today, so we never add them —
the variables swap. Final wiring (full build): `:root` = light; `@media (prefers-color-scheme: dark)`
guarded `:root:not([data-theme="light"])` = system-dark; `:root[data-theme="dark"]` = explicit dark —
so system works and an explicit toggle wins both directions.

- **Ink scale** (the missing half): `ink` / `ink-muted` / `ink-subtle` / `ink-faint`.
- **Surface scale** (existing names, re-pointed to variables): `surface` / `surface-raised` /
  `surface-border` (and eventually the `brand.*` page-bg tokens).
- **Preference:** `theme` = `system | light | dark`; toggle in Preferences; persisted to localStorage
  (instant) + optionally the trainer record; an inline script in `index.html` stamps `data-theme`
  before first paint (no flash).
- Brand tokens stay fixed (accents, not surfaces) — **except `signal-yellow`**, invisible on white;
  needs an on-light variant.

## Sweep mapping (the vocabulary, for Step 2)

| Today (dark-assuming) | → token | dark value | light value (placeholder) |
|---|---|---|---|
| `text-white`, `text-gray-100` | `text-ink` | gray-100 | gray-900 |
| `text-gray-200/300` | `text-ink` (or keep as strong) | — | — |
| `text-gray-400` | `text-ink-muted` | gray-400 | gray-600 |
| `text-gray-500/600` | `text-ink-subtle` / `-faint` | gray-500/600 | gray-500/400 |
| `bg-black` (page) | `bg` / canvas token | #0d0d0d | off-white |
| `bg-white`, `text-black` | audit case-by-case | — | — |
| `ring-offset-black` | offset token | black | light ground |

Not mechanical where grays sit on different grounds (on-`surface` vs on-page) — needs eyes per screen.

## Steps

0. **Design the light palette** *(design, gates 2–4)* — light ground, surfaces, the 4 ink levels, the
   `signal-yellow`-on-light fix, and what the crosshatch becomes in light (a lighter engrave, or drop
   the texture). Add a light section to `COLOR_SYSTEM.md`.
1. **Token infrastructure** *(DONE 2026-10-21)* — see below.
2. **The sweep** *(the bulk)* — replace raw gray/white/black with `ink.*` / surface tokens across the
   116 files, screen-by-screen, each keeping dark correct.
3. **Charts + texture + focus ring** — `heatRamp` / `MuscleMap` / `BodyHeatMap` read tokens (or get
   light variants); light crosshatch; `ring-offset` token.
4. **Toggle + persistence + no-flash script + wire `prefers-color-scheme` + QA both themes** — every
   screen eyeballed in light (dark/light are designed, never an automatic flip).

## Step 1 — token-infrastructure down-payment (BUILT 2026-10-21)

Safe by construction: **default dark, opt-in light, zero visible change, no user can hit broken
light.**

- `tailwind.config.js`: `surface.{DEFAULT,raised,border}` → `rgb(var(--…)/<alpha-value>)` (dark values
  equal the former hex, so dark is byte-identical); added the `ink.{DEFAULT,muted,subtle,faint}` scale
  (variable-backed; unused until Step 2 adopts it).
- `index.css`: `:root` = dark defaults (= old hex); `:root[data-theme="light"]` = **placeholder** light
  set. **`prefers-color-scheme` deliberately NOT wired** — auto-flipping a system-light user before the
  sweep would show unreadable light. Light applies only when `data-theme="light"` is explicitly set,
  and **no shipped UI sets it** (test via devtools: `document.documentElement.dataset.theme='light'`).
- Verified: config parses, `tsc` clean. Dark output resolves to the same hex (confirm on a vite build).
- **Payoff:** the 400+ surface usages (`bg-surface`, `surface-border`, …) become theme-ready for free;
  new code can use `text-ink*` now so it stops adding dark-assuming debt; the eventual sweep shrinks to
  the text layer.

## Open decisions (before Steps 0/2–4)

- **Launch timing.** Recommendation: full sweep is **post-launch** (its own mini-phase); dark-only is a
  fine Phase-19 launch state. The down-payment is the pre-launch piece.
- **Light-palette design** owner/values (Step 0) — the crosshatch-in-light call, `signal-yellow`-on-
  light, whether light surfaces are pure-white cards on off-white or a warmer paper ground.
- **System default.** Once shipped: does a first-time user get `system` (follow OS) or `dark` (brand
  default)? Leaning `system`.

## Files

- `tailwind.config.js`, `src/index.css` (Step 1 — done).
- Step 2: the 116 component files (sweep).
- Step 3: `components/charts/{heatRamp.ts,MuscleMap.tsx,BodyHeatMap.tsx}`, `index.css` crosshatch,
  focus-ring offset.
- Step 4: `index.html` (no-flash script), a `lib/theme.ts` + `useTheme` hook, `PreferencesPage.tsx`
  (toggle), optional trainer-record `theme` field (the 6-file preference checklist), `COLOR_SYSTEM.md`.

## Guardrails

- Dark must stay byte-identical through Step 1 and each slice of Step 2.
- Never wire `prefers-color-scheme` until the sweep makes light actually readable.
- Charts: a single shared ramp module already exists (`heatRamp.ts`) — keep one source; don't let the
  figure and the breakdown-sheet dot drift (they share it today).
