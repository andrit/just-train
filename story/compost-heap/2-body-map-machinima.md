---
kind: machinima — rig-run reaction to a frozen compost source
reacts-to: 2-body-map.md
author: claude (companion reaction — observations + things to pull on, NOT report prose)
started: 2026-11-02
convention: single living doc with a Changelog. Writer's inline notes = authorNotes (*italic*, *n),
            never overwritten. Major restructure → snapshot to archive/ first.
---

# Reaction — the body map

Companion read, before gardening. Three lenses, spine test, tensions.

## Aesthetics

- **The red→blue decision is the sharpest colour call in the app.** The *same* body geometry wears
  two colour languages: Ember Red roles on the per-exercise placard ("these are the muscles this
  move works") and a Command-Blue magnitude ramp on the Home heat-map — *because* "red on a body
  reads as soreness/injury." So colour meaning is **contextual to the surface it's painted on.**
  That's a genuinely sophisticated idea and it's a strong aesthetics beat.
- **"Magnitude = one hue, never a rainbow."** Same dataviz discipline as the type-coding palette —
  categorical hue for *kind*, single-hue ramp for *quantity*. The app refuses rainbow-for-magnitude.
  A real through-line in the design language: **colour never lies about what kind of variable it is.**
- **Discrete buckets, not a smooth gradient.** Three legible tiers beat a continuous ramp nobody can
  read at `h-48` glance size. Deliberate legibility-over-fidelity trade.
- **Normalized to the athlete's own busiest region** → the figure never looks dead for an active
  user. But it means heat is **relative emphasis, not absolute volume** — train everything once +
  chest twice and chest reads "high," the rest "low." Honest at a glance? Name it.

## Affordance

- **The figure is a diagnostic, and the *gray* is the signal.** It answers "what am I actually
  hitting?" — and the untrained (gray) regions are the actionable part, arguably more valuable than
  the bright ones. The app makes *absence* visible, which is the hard thing to notice.
- **It's an entry point, not a readout.** The full chain is: see a gap → tap it → see that region's
  muscles → see library exercises that fill it → open one → **Add to Workout**. The Home figure is
  the **top of a funnel that ends in "train this today."** That's the strongest product beat here.
- **"Neglected" is surfaced as a first-class tile** ("N muscles untrained"), not left to be inferred
  from dim regions. Affordance built specifically for the thing that's easy to miss.
- **Density-aware, like type-coding's `showIcon`:** a single-muscle region auto-expands straight to
  exercises (no dead tap); `stopPropagation` disambiguates region-tap vs whole-figure-tap; inert
  head/knees never pretend to be tappable.
- **Two resolutions of one dataset:** the figure is the coarse glance, the sheet is the fine drill
  (and reaches muscles the figure can't paint). The app respects that a glance and a drill want
  different granularity.

## Product-story fit (Act Zero)

- **Before:** logging produced numbers; "am I balanced?" required mentally aggregating across
  sessions. The data was captured but the **body-level synthesis was invisible.** The heat-map is
  the app answering its own thesis spatially — *moving forward = training the whole body, not just
  the mirror muscles.*
- **The "render from data, not stored images" choice** (visualization column left vestigial) is a
  "we built the harder-but-righter thing" beat: deterministic, themeable, offline, no licensing —
  and it rhymes with type-coding's hand-rolled glyphs. The app keeps rendering in its own hands.
- **`metric = sessions` with a seam for sets/reps/volume** — honest v1 scope: frequency now,
  intensity later.

## Spine test (Bridge — flagged)

Fits "legible at a glance" cleanly (encodes *what muscle / how often*). The **redundant-encoding
safety net** shows up differently than in type-coding: here it's *"the sheet is the accessible,
labelled fallback for the figure"* (every row has label + count + heat dot; unpaintable muscles are
text) rather than per-element colour+shape+label. So the safety net generalises as a **principle**
(always a labelled fallback) but not as the same **mechanism.** Worth tracking for the eventual spine.

## Tensions worth pulling on (your call which we garden)

1. **Relative vs absolute heat** — normalized to the user's own busiest region. Does "high" mislead?
2. **Two colour languages on near-identical figures** (red roles vs blue magnitude). Coherent system,
   or latent confusion? *(I lean coherent — different contexts — but name it.)*
3. **Three discrete tiers** — enough resolution, or does it flatten real differences?
4. **Headline** — "a body figure on Home," or **"the home screen is a diagnostic funnel to action"**?
   *(I lean the funnel — it's the strongest story and the truest to the code.)*

<!-- authorNotes land here or inline above, marked *1 *2 … -->

## Changelog

- **2026-11-02** — initial reaction (aesthetics / affordance / Act Zero), spine test, four tensions.
- **2026-11-02** — writer review + Claude reply (blocks below): **absolute** heat (was relative),
  **5 tiers** (was 3), diagnostic-funnel headline locked; heat-ramp change to be queued as app work.
- **2026-11-02** — round 2: 5-above-gray confirmed; app task plan written
  (`.workbench/designer/current/task-plan-body-heat-absolute-5tier.md`, awaiting confirm to execute);
  item 2 stage-2 brainstorm **closed** — ready for Bridge → garden on request.

REPLY:
1. actually think Id prefer absolute over relative. relative as the design doesnt say much. if its absolute, relative becomes obvious
2. different contexts
3. honestly, would like to see 5 tiers
4. diagnostic funnel makes sense to me

there are a couple of ites that we could tweak in the app, from this discussion. We should discuss those and could even capture the decision in this product design piece.
ENDREPLY;

---
## Claude reply — 2026-11-02

Taking your four in turn, then the two that are actually live app decisions — which I think compose
into one stance.

**Resolved:** (2) different contexts — dropped as a tension. (4) diagnostic funnel — locked as the headline.

**(1) Absolute over relative — agreed, and it's more load-bearing than it looks.** Your reasoning is
exactly right: relative hides the one thing the figure should carry — *how much you've actually
trained each region.* Normalizing to your own peak makes a once-a-week trainee and a twice-a-day
trainee render identically. **And absolute reinforces the funnel (#4):** a mostly-gray figure for a
light user isn't a "dead" figure to avoid — it's the honest diagnostic ("barely trained this month"),
which is the whole point. So relative wasn't just less informative, it was quietly *fighting* the
headline. #1 and #4 turn out to be the same decision.

The real work absolute creates is **choosing the thresholds** — what 30-day session-count counts as
each tier. That's the one thing we must not guess: I'd propose a starting ladder and then
**sanity-check it against your real logged distribution** before locking, so the tiers actually
spread instead of everyone piling into one bucket.

**(3) Five tiers — yes, and it pairs naturally with absolute** (more levels only pay off once the
scale means something fixed). Two notes: *(a)* 5 sequential single-hue steps is right at the
distinguishability ceiling at glance size — doable, but we build it with the dataviz skill and
validate the luminance steps are separable on *both* grounds. *(b)* Quick confirm: 5 heat levels
*above* gray (6 states incl. untrained), or 5 total incl. gray? I'm assuming 5 above gray.

Starting ladder to react to (5 above gray, per muscle / 30 days; numbers are placeholders until we
check real data): `0 → gray · 1–2 → t1 · 3–4 → t2 · 5–6 → t3 · 7–9 → t4 · 10+ → t5`
(≈ half-weekly up to 3×/week).

**On capturing the decision in the piece — yes, and here's the clean split:**
- The **report** records the *decision + rationale*: relative→absolute, 3→5 tiers, why, before/after.
  That's a real beat — *a retrospective design review that improved the product it was reviewing.* It
  makes the piece stronger, not tangential.
- The **code change** is ordinary app work (machine-write side), not story/companion work — so it gets
  its own task plan + your confirm per the standing rule, keeping the rig in its lane. It touches
  `heatRamp.ts` (3→5 tiers, drop the `max`-normalization), the `--heat-*` tokens in `index.css` (2
  new, dataviz-validated), and removes the normalization in both `BodyHeatMap` and `BodyBreakdownSheet`.

**Two questions to move:**
1. 5 above gray, or 5 total? And OK to query your real 30-day distribution to tune the thresholds?
2. Want me to write the app-side task plan for the heat-ramp change now (separate from the report), or
   hold it until the body-map report is drafted so the decision is documented first?

_— end Claude reply —_
---
REPLY:
1. 5 above gray. OK to query the real 30-day distribution to tune the thresholds
2. write it now. otherwise review of this post's initial brainstorm is complete upto this point, would you say?
ENDREPLY;

---
## Claude reply — 2026-11-02 (2)

**1. Locked: 5 above gray** (6 states incl. untrained gray). And I grounded the distribution query on
the live `/clients/:id/muscle-frequency` join (distinct *completed* sessions per muscle, 30-day
window) rather than inventing it — it's a **read-only** SELECT. One honest boundary: I don't hold the
Railway `DATABASE_URL` in this container, so **you run it against prod** (read-only, safe); it's in the
task plan as task 1, and its output sets the tier thresholds (I left a placeholder ladder to react to).

**2. Task plan written** → `.workbench/designer/current/task-plan-body-heat-absolute-5tier.md` (the
file watcher ingests it automatically — I won't manually ingest). It's frontend-only, no schema change;
touches `heatRamp.ts`, the `--heat-*` tokens in `index.css`, and the de-normalization in both
`BodyHeatMap` and `BodyBreakdownSheet`. **Execution waits on your confirm of the plan** — then container
runs tsc/eslint, you run the prod SELECT + `vite build` + on-device QA. Keeping it off the story lane.

**On "is the brainstorm review complete?" — yes, up to this point, with one honest caveat.**
- All four tensions are resolved: **absolute** heat (1), colour-languages **dropped** (2), **5 tiers**
  (3), **diagnostic-funnel headline** (4).
- The Aesthetics / Affordance / Act-Zero observations you didn't push back on stand as **accepted raw
  material** for the report.
- **Caveat:** the one thing still open isn't body-map-specific — it's the **cross-piece spine**
  ("legible at a glance" vs the wider "honest representation — show the true state, derive/degrade
  safely"). That resolves when we Bridge across all four, not here.

So item 2's stage-2 brainstorm is **closed**. What that unlocks: whenever you say go, item 2 moves to
**Bridge → garden** — I plant the decided notes (incl. a *decision* note capturing relative→absolute +
3→5 tiers and why), then Render → thread → the report. The report will carry this review as a beat: a
retrospective design review that changed the product it was reviewing.

_— end Claude reply —_
---