---
kind: backlog
status: living · the queue that feeds development — FIFO by default, reorderable
author: claude (on the writer's instruction)
created: 2026-11-02
updated: 2026-11-02
---

# Report Backlog — Just Train design & development pieces

The running list of **what we're writing about**, and the **queue** that feeds development.
New subjects get added over time — this list is expected to grow.

## How the queue works

- **The queue is the ordered list under "## The queue" below.** Top = head.
- **FIFO by default** — we develop from the head down, in order.
- **Reorderable** — the writer can move any item to the head (or anywhere) at any time; when that
  happens I reorder the list here and note it under "Queue log" so the change is visible, never silent.
- **Head = what we're developing now.** "Start with X" means X is moved to the head (if it wasn't
  already) and becomes active.
- Nothing is dropped on reorder — items only change position. Completed items move to "## Done"
  with their report location, they don't vanish.
- **One report per item** — each queue item is developed into its own **standalone report**
  (decided 2026-11-02). No single multi-feature report.

## The shared lens (applies to every item unless noted)

These are **product design & development reports**. Each one is read through three focuses:

- **Aesthetics** — the sensory/visual craft of the thing.
- **Affordance** — what the interface invites and tells the user without words.
- **Product-story fit** — where it sits in the Just Train narrative (*Capture → Compare →
  Communicate*; "Is this person moving forward?"). The rig's **Act Zero** move lives here: the
  product *before* the feature, the gap it filled, why *this* now.

## The queue

1. **Color + icon coding of exercise types** — ✅ **RENDERED** → `docs/design-reports/exercise-type-coding.md`
   (see Done). The `EXERCISE_TYPE_THEME` visual system: the dataviz-validated 5-type palette, the
   hand-rolled type glyphs, type-art card thumbnails, the corner pill. *(shipped as #25.)*

2. **The body map** — ✅ **RENDERED** → `docs/design-reports/body-map.md` (see Done). The home-screen
   muscle heat-map + the tap-through body breakdown sheet.
   *(home-body-heatmap / body-map-history / exercise-muscle-map work.)*

3. **The circuits feature** — ✅ **RENDERED** → `docs/design-reports/circuits.md` (see Done).
   round-major (interwoven) execution: one set of each exercise per round, shared `circuit_id`,
   `CircuitBlock` / `CircuitBuilderSheet`.

4. **Set-targets input UI** — ✅ **RENDERED** → `docs/design-reports/set-targets-input.md` (see Done).
   The add-exercise "Set Targets" surface: typeable numeric fields
   (replacing the roll-only steppers + the focus-steal bug), the reps **ramp** (start + step/set),
   three reps modes (All same / Ramp / Per set), "Starting weight," and the opt-in "Use last
   time" prefill. *(discussions/exerciseUI/exerciseui-discuss.md + exerciseui-task-plan.md.)*

<!-- ADD NEW ITEMS BELOW THIS LINE (new items append to the tail by default) -->

## Queue log

- **2026-11-02** — initial three items added (FIFO order was: body map, type coding, circuits).
- **2026-11-02** — writer chose to start with **type coding**; moved it to the head (ahead of the
  body map). New order: type coding, body map, circuits.
- **2026-11-02** — added item 4 (set-targets input UI) to the tail. Decided: one standalone report
  per item.
- **2026-11-02** — all four items brought to **stage 2** (compost frozen + machinima reaction in
  `compost-heap/`), each **awaiting writer review** before gardening. Files: `1-exercise-type-coding`,
  `2-body-map`, `3-circuits`, `4-set-targets-input-ui` (+ their `-machinima` sidecars).
- **2026-11-03** — all four reviews **closed**. Reports land in `docs/design-reports/`. First rendered:
  **body map** (`docs/design-reports/body-map.md`). Remaining to render: type coding, circuits,
  set-targets (all reviewed; garden clusters still to seed for 1/3/4).
- **2026-11-03** — rendered **type coding** + **circuits** (full cycle each: garden → gardening vet in
  the machinima Afterward → report). Cadence set: full cycle per piece, writer reviews the bundle
  (seeds + machinima vet + report) to shape the final draft. **Last up: set-targets.**
- **2026-11-03** — rendered **set-targets** (full cycle). **All four reports drafted** in
  `docs/design-reports/`. All four garden clusters planted (33 notes total); every loose thread in MAP
  fulfilled. Next: writer's final-draft pass across the set; reports still **unstaged** for review.

## Done

- **The body map** → `docs/design-reports/body-map.md` (rendered 2026-11-03). Headline: the Home
  figure is a diagnostic funnel to action. Carries the shipped relative→absolute, 3→5-tier decision as
  a beat.
- **Color + icon coding of exercise types** → `docs/design-reports/exercise-type-coding.md` (rendered
  2026-11-03). Leads with the felt experience (read a session's shape at a glance); trust via a visual
  language as the future direction; carries the tested-and-kept-fuchsia decision as a principle beat.
  Gardening vet in the machinima Afterward.
- **The circuits feature** → `docs/design-reports/circuits.md` (rendered 2026-11-03). Felt-first (the
  box + dot-grid flow); derived-state demoted to the trust layer; scope named honestly (resistance-only,
  shared targets, two gaps parked); thesis = modality made trustworthy through design. Gardening vet in
  the machinima Afterward.
- **Set-targets input UI** → `docs/design-reports/set-targets-input.md` (rendered 2026-11-03).
  Shortest by design; felt-first (just type it / the ramp); honest it's part restoration + part
  refinement; the Capture-side counterexample (shares design-values, not the glanceability spine).
  Gardening vet in the machinima Afterward.
