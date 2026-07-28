# Gesture & Interaction Guide

This is the map of how the app answers your touch — what a tap, swipe, or drag will do, and how the app moves in response. It's written so anyone can skim it and know what to expect *before* they try it: a trainer mid-set, a new athlete, or a developer wiring the next screen.

**Three rules keep it honest:**

1. **Plain language first, code pointer second.** Each entry reads like it's being explained to someone using the app, then names the component for whoever's building it.
2. **If it ships, it's here.** Every gesture and every bit of motion the app makes back has an entry. If it's described here but the code doesn't do it, that's a bug in one of them — fix it.
3. **Change an interaction → update this doc in the same commit.** A gesture the user can't predict is a broken gesture.

Source of truth for the mechanics: `apps/frontend/src/lib/interactions.ts` (the press/hover/pulse styles), `apps/frontend/src/lib/ux-events.ts` (the semantic motion engine), and the components named in each entry.

---

## The basics

- **Tap** — the universal "do it": buttons, cards, list rows, the pill, peek cards, the "?" hint buttons.
- **Scroll** — drag up/down through any list or a running workout. Scrolling never triggers a gesture on its own; the app only acts on the deliberate moves below.

---

## Gestures that ship

### In a running session

**Swipe down on the grabber → tuck the session away.**
The little grey bar at the very top of a running session is the *grabber*. Drag it down and the session shrinks to a pill at the bottom of the screen so you can glance at something else. Only the grabber does this — scrolling through your exercises won't tuck it away, and neither will tapping a button.
*Where:* any active session · *Under the hood:* `ActiveSessionOverlay`

**Tap the pill → bring the session back.**
The minimised session sits as a pill above the tab bar. Tap it to expand back to full screen. If you've got more than one session going, each has its own pill.
*Where:* minimised session · *Under the hood:* `SessionPill` / `ActiveSessionOverlay`

**Swipe sideways / tap a peek card → move between exercises.**
Inside a block, exercises sit side by side. Swipe left/right to move through them, or tap the faded *peek* card on either edge to jump to the previous or next one. Blocks move the same way along the top.
*Where:* live session execution · *Under the hood:* `WorkoutBlock`

### Lists & builders

**Swipe an exercise right → add it.**
In an exercise picker, swipe a row to the right to drop it straight into the block — a quick green flash confirms it. (You can also tap to open it and set targets first.)
*Where:* add-exercise sheets, template builder · *Under the hood:* `ExerciseAccordionRow`

**Drag the ⋮⋮ handle → reorder.**
Blocks and exercises in the plan/template builder have a grip handle. Press and drag it to reorder; the item lifts as you pick it up and settles into place when you drop it. The new order saves on its own.
*Where:* session plan, template builder · *Under the hood:* `SortableWorkoutList`, `@dnd-kit`

### Inputs

**Drag a number up or down → change it.**
Sets, reps, scores and the like use a drag-stepper: drag up to raise the value, down to lower it. Prefer buttons? The ▲ / ▼ do the same, and arrow keys work when it's focused.
*Where:* target setup, subjective score sliders · *Under the hood:* `DragStepper`

### Sheets & hints

**Swipe the handle down, tap outside, or press Esc → close a sheet.**
Bottom sheets (add exercise, pick template, camera, etc.) close when you drag the grey handle at the top downward, tap the dark area behind them, or press Escape. Dragging is scoped to the handle, so scrolling through a long sheet won't close it.
*Where:* all bottom sheets · *Under the hood:* `BottomSheet`

**Swipe a hint away → dismiss it.**
Tap a small "?" or "i" circle to open a hint bubble; flick it sideways to dismiss (or tap outside / press Esc).
*Where:* the `{date}` name hint, Personal Bests tooltips · *Under the hood:* `HintPopover`

**Drag the divider → compare progress photos.**
On a before/after photo comparison, drag the divider left/right to wipe between the two shots.
*Where:* progress photo comparison · *Under the hood:* `PhotoComparisonSlider`

---

## What the app does back

Motion is feedback — it tells you something happened. Here's the vocabulary you'll see:

- **PR flash** — beat your best on a set and an amber "New PR" fills the log area for about a second, then leaves a small **Load** or **Vol** chip on that set.
- **Rest timer** — after you log a set, a countdown bar slides into the footer; the number flips each second, turns amber in the last 10s and pulses red in the last 3. Tap **Skip** to end it.
- **Focus ring** — a field you tap into gets an attention ring, and a brief flash confirms when you commit it.
- **Press & lift** — buttons press down when tapped; cards lift slightly on hover; the round **+** button (FAB) gently pulses to say "start here."
- **Green flash** — confirms a swipe-to-add.
- **Panels slide in** from the right (a client profile, a session's history); going back slides them off.
- **Toasts** slide in at the top and clear themselves.
- **Session moments** — starting a session and finishing one get their own bigger transitions (a start reveal, a fade into the summary).

---

## Under the hood

- **`lib/interactions.ts`** — the reusable press / hover / pulse / lift class values (`button`, `fab`, `card`, `danger`, `icon`). Import these instead of re-styling motion per component.
- **`lib/ux-events.ts`** — a semantic motion engine: `fire('type', { target })` plays a consistent animation and runs any registered side effect. See the Developer section for the full palette.
- **Per-component** — physical gestures (swipe, drag, pinch) are hand-rolled with touch/pointer handlers in the component named in each entry above. There is no shared `useSwipe` hook yet; if you add a third swipe, consider extracting one.

---

## For developers — the interaction palette you can reach for

If the shipping set above isn't enough, most of what you'd want already exists as **named, ready-to-use events** in `lib/ux-events.ts` — call `fire('type', { target })` and you get a consistent animation plus any side effect, instead of hand-rolling motion. Prefer these before inventing something new.

**Wired today** (in active use): `single_press`, `create`, `update`, `page_enter`, `session_start`, `session_end`, `rest_tick`, `rest_complete`.

**Defined and available** (in the taxonomy, not yet used — reach for these first):

| Event | Intended effect |
|---|---|
| `double_press` | double-tap / double-click action |
| `long_press` | hold — context menu, activate a reorder handle |
| `swipe_left` / `swipe_right` | dismiss / delete-reveal · archive / mark-done |
| `swipe_up` / `swipe_down` | scroll-to-next / expand · pull-to-refresh / collapse |
| `drag_start` / `drag_end` | lift on pick-up · settle on drop |
| `text_focus` / `text_input` / `text_commit` / `text_clear` | attention ring · contextual guidance · confirm flash · clear |
| `select_change`, `toggle`, `slider_change` | dropdown / switch / 1–10 slider feedback |
| `page_exit` | route leaving — content exits |
| `drawer_open` / `drawer_close` | panel in/out from the right |
| `tab_change` | lateral tab switch — crossfade |
| `modal_open` / `modal_close` | modal in / out |
| `delete` | collapse-out on removal |
| `achieve` | goal achieved — celebrate animation |
| `set_logged` | fast check-pop, repeatable |
| `loading_start` / `loading_end` | loading affordances |
| `error` | validation / server error — shake + red flash |
| `success` | operation confirmed — green flash |
| `warning` | non-blocking notice — amber pulse |

Note: some of these overlap gestures already built by hand (e.g. `swipe_right` exists physically in `ExerciseAccordionRow` without going through `fire()`). The table describes the *animation engine's* intent — wiring a bespoke gesture to also `fire()` the matching event gives it the shared look for free.

**Known gaps:**
- **No shared swipe/drag hook** — each gesture re-implements its own touch/pointer math, and the `ActiveSessionOverlay` and `BottomSheet` handle-swipes are now near-identical. Extract a `useSwipeDismiss` next time you touch either.

---

## Changing this guide

Add, remove, or change an interaction and update this file **in the same commit** — an entry that lies is worse than no entry. New physical gesture → add it under *Gestures that ship*. New motion/feedback → add it under *What the app does back*. Wired up a previously-idle `ux-events` type → move it from "available" to "wired" in the palette.
