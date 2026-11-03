---
kind: machinima — companion reaction to a dropped init
reacts-to: addPlyometrics-init.md
author: claude (companion reaction — the knot + trade-offs + questions, NOT a spec or a decision)
started: 2026-11-03
convention: single living doc with a Changelog. Writer's inline notes = authorNotes (*italic*, *n),
            never overwritten. The init is the frozen source — I react here, never edit it.
---

# Reaction — adding plyometrics to Just Train

The init isn't about the app yet — it's the **domain truth**: how plyometrics is actually tracked
(low reps × high *quality*, height/distance, rest, a "pop"/explosiveness rating, readiness, and a
PR that means *best jump*, not most volume). Taken as requirements, here's what it would take to make
Just Train capture that — and the one decision everything hangs on.

## The knot — a new 6th *type*, or a sub-mode?

Everything forks here. Today `WorkoutTypeEnum = [cardio, stretching, calisthenics, resistance,
cooldown]` — five. Plyometrics is genuinely its own modality (explosive power — not calisthenics'
bodyweight endurance, not resistance' load). So the instinct is "a 6th type." But a new type isn't a
row in an enum; it pulls the **whole type system** we just reported on:

- **A 6th colour — and the palette is already at the CVD ceiling.** This is the load-bearing cost.
  The type-coding review (2026-11-03) *measured* how constrained the wheel is: gold collided with the
  reward-amber, violet collides with cardio-blue, orange with red + amber. Fitting a 6th hue that's
  ΔE-safe against red / blue / fuchsia / emerald / slate **and** clear of the reward-amber is a real,
  maybe-unsolvable problem — not a paint job. (The glyph is the easy half; one more hand-rolled SVG.)
- **vs. a lighter model:** a box jump *is* a bodyweight movement — plyo could live as **calisthenics
  exercises** (or calisthenics with an "explosive" flag), dodging the 6th-hue problem entirely. Cost:
  it loses a distinct identity, its own filter, and its own coding.

That's the trade I'd want decided first: **is plyometrics' distinct identity worth spending the app's
last clean categorical colour slot on** — or is it a sub-mode of calisthenics?

## The good news — the *metrics* are mostly composable (so either path is cheaper than it looks)

The init's pillars map onto pieces that already exist, which lowers the cost of either fork:

- **Sets × Reps (low, e.g. 4 × 5)** — have it.
- **Height / Distance** (box height, broad-jump distance) — the cardio work (#21) already added a
  per-exercise `distance_unit` + a numeric intensity field. Height/distance is the same shape; likely
  reusable rather than net-new.
- **"Pop" / quality rating (1–3)** — a per-set qualitative field, close cousin to the existing RPE.
  Could be a plyo-flavoured RPE rather than a whole new concept.
- **Rest between sets** — the rest timer already exists (and circuits already taught it to fire on the
  right boundary).
- **Readiness (1–5 legs)** — this one's new-ish: it's a *pre*-session subjective, where today's
  subjective scores are captured at session *end*. Smallest new surface.

So the "editor morphs to the modality" pattern (from the set-targets report) handles plyo's inputs by
**composition** — reps + a height/distance dimension + a pop rating — not a from-scratch build.

## The gap that isn't composable — PR semantics

The app's PR engine is **Epley 1RM + volume (weight × reps)**. For plyo that's meaningless (no load;
the point is *height/distance*, not volume). The init's PR is **best jump / best distance** (`*`). So
plyo needs a **third notion of "best,"** per-modality. This rhymes with the already-noted BW-max-reps
catch (bodyweight → PR by max reps): the PR engine wants to become *modality-aware* — load→1RM,
bodyweight→max reps, plyo→max height/distance. Worth deciding whether plyo is the forcing function to
generalise PRs, or waits behind the BW catch.

## A quieter UX divergence worth naming

The init is emphatic: **quality over fatigue — stop when the "pop" drops.** That's the opposite of the
resistance live-session ethos (push toward the target). A plyo session might want the pop rating to
*drive a "call it here" nudge* rather than a "one more set" prompt. Small, but it's a genuine
behavioural difference from how the live session works today.

## What I'd want from you to move this

1. **The fork:** 6th first-class type, or a calisthenics sub-mode / "explosive" flag? (The colour
   ceiling is the real cost of "type"; identity/filtering is the real cost of "sub-mode.")
2. **If a type:** are you willing to spend the last clean palette slot — and should we even *try* to
   find a 6th CVD-safe hue before committing? (I can run the dataviz validator against candidates to
   see if one exists, same as the gold/fuchsia test.)
3. **PRs:** make the PR engine modality-aware now (fold in BW-max-reps + plyo height/distance), or
   ship plyo without PRs first?
4. **Readiness:** worth a pre-session readiness capture, or skip it for v1?

<!-- authorNotes land here or inline above, marked *1 *2 … -->

## Changelog

- **2026-11-03** — opening reaction: the type-vs-sub-mode knot (palette ceiling as the real cost),
  metric composability from #21 + RPE + rest timer, the modality-aware-PR gap, the quality-over-fatigue
  UX divergence, four questions.
