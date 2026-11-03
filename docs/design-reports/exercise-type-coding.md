# Exercise-Type Colour & Icon Coding — Design Report

> **Just Train** · product design & development
> **Area:** the exercise library + anywhere a workout type appears (cards, badges, session headers)
> **Date:** 2026-11-03 · **Status:** shipped (#25 — `lib/exerciseTypeTheme.ts` + `ExerciseTypeBadge`)
> **Lens:** aesthetics · affordance · product-story fit

---

## In one line

You can read the **shape of a session before you read a word of it** — a colour and a small glyph tell
you *what kind* of work each block is, at a glance. "Three red and a blue" is a strength day with a
cardio finisher, read in the time it takes to look.

---

## Act Zero — the product before the coding

Two things were true before #25. First, a session was a **list of names**: answering "what kind of
day is this?" meant reading each one. Second — and more quietly — the colour that *did* exist
**contradicted itself.** Two separate colour maps (`WORKOUT_TYPE_COLOR` and
`WORKOUT_TYPE_BADGE_VARIANT`) could paint the *same* type two different colours, so a card and its
badge might disagree about what "cardio" looks like. Subtle, but real: the one visual cue that should
have made categories instant instead made them slightly untrustworthy.

So the starting point was both an **absence** (no fast read of *kind*) and an **incoherence** (the
colour that existed couldn't be relied on).

---

## Aesthetics

### Colour carries *kind*

Five types, one hue each — resistance red, cardio blue, calisthenics fuchsia, stretching emerald,
cooldown a neutral slate. This is one-hue-per-*kind*, the categorical counterpart to the body map's
one-hue-per-*magnitude*: across the app, **colour never lies about which kind of variable it is** — a
category gets a distinct hue, a quantity gets a single-hue ramp.

### Engineered — within hard constraints

The palette is validated, not taste-picked: ΔE ≥ 15 for normal vision on every pair, contrast ≥ 3:1
on both the dark and light grounds, and colour-blind separation held in the legal 6–8 band *because*
every surface pairs the colour with a glyph and a label. "Pretty" is a byproduct of "provably
distinguishable."

The honest other half: this palette is as much **constraint-solved** as freely designed. Fuchsia for
calisthenics isn't a connotation choice — it's the one colour-blind-safe slot left in the gap between
red and blue, arrived at mostly by elimination. The discipline is real; so is the fact that the wheel
didn't leave many options.

### Hand-rolled glyphs

Five SVG glyphs, drawn by hand, no icon library: barbell, bicycle, jumping-jack, split, snowflake.
That buys a uniform line weight, zero dependency, and the same confident Barlow-Condensed "gym-poster"
character the rest of the app has. Four are literal depictions; one (cool-down's snowflake) is a
metaphor — a small seam, kept deliberately. As with the body map's data-drawn figure, the app keeps
its rendering in its own hands.

---

## Affordance

### Colour is the experience; the glyph and label are the safety net

The daily read is the **colour** — a tenth-of-a-second "that block's cardio." The **glyph** is what
makes that read survive colour-blindness, greyscale, and gym glare; the **label** removes any
remaining doubt. The honest ranking: colour carries the experience, and the redundancy is insurance
for the cases colour alone can't serve — not the other way around. It's a quiet, well-placed safety
net, not the headline.

### Density-aware

On a library card the type-art thumbnail already *is* the icon, so the corner pill is **label-only** —
no redundant double-icon; in the detail drawer, where nothing competes, the badge shows icon + label.
One small prop (`showIcon`) encodes that judgement.

### An altitude decision — type-art on the card, photo in the drawer

The card thumbnail is the **type icon in the type colour**; the exercise **photo lives in the detail
drawer.** A conscious altitude call: the card answers *"what kind of work is this?"*, and clicking in
gives the movement itself. Browse altitude vs. detail altitude — not a cost, a division of what each
view is for.

### Fail-safe

An unrecognised type degrades to the neutral slate slot — *"no signal,"* never a *wrong-colour*
signal. The failure mode is designed, not accidental.

---

## Product-story fit

At the browse-and-plan altitude the coding serves **Compare** and **Communicate**: it lets you read a
session's structure without reading its words. That's the "legible at a glance" promise expressed in a
glance-sized unit — the shape of a day, in colour.

**The direction it's building toward: a trustworthy visual language.** #25's deepest move isn't the
hues — it's the **consolidation to one source of truth**, the single `EXERCISE_TYPE_THEME` that
replaced the two maps that disagreed. That's the precondition for trust: a vocabulary can only be
relied on once it's *coherent* everywhere it appears. The colour you see is the surface; the one
source of truth is what will let the app say the same thing about "cardio" on every screen. #25 made
the vocabulary consistent — the foundation the rest of the visual language gets built on.

---

## The decision this report records

During this feature's review we tested recoloring calisthenics from fuchsia to a more intuitive
**gold** ("bodyweight energy"). The measurement killed it: **gold is the same colour as the reserved
reward-amber** — the hue the app already uses for a PR / achievement flash. A persistent
calisthenics-gold pill would read as *"a PR just happened."* We kept fuchsia.

The point isn't the near-miss; it's the **principle** it made explicit: **a category hue must never
collide with a signal hue.** Colour can't be asked to mean two kinds of thing at once — a *type* and
an *event* — without the eye conflating them. That rule now guards the palette, and it's the reusable
takeaway, not the anecdote.

---

## Where it sits in the design language

Type coding is one expression of a **thread** running through the app (offered as a thread, not a
settled law): *honest representation* — colour never lies about its variable, an unknown input
degrades to a safe neutral, and rendering stays in the app's own hands (hand-rolled glyphs, like the
body map's data-drawn figure). The visual language is simply the surface where that thread is most
visible.
