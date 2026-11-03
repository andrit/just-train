# The Body Map — Design Report

> **Just Train** · product design & development
> **Area:** Home (`DashboardPage`) — the body heat-map and its tap-in breakdown sheet
> **Date:** 2026-11-03 · **Status:** shipped (absolute 5-tier scale live, commit `1e2e0bf`)
> **Lens:** aesthetics · affordance · product-story fit

---

## In one line

The Home body figure is not a readout of what you trained — it's a **diagnostic that funnels you to
the next action**. The grey is the signal; a tap turns *"what am I neglecting?"* into *"add this to
today."*

---

## Act Zero — the product before the figure

Before the body map, logging produced numbers, one session at a time. The data was all captured —
every set already carried its muscles through the 34-term `exercise_muscles` vocabulary — but the
*body-level synthesis was invisible*. "Am I training in balance? What have I been neglecting?"
required holding weeks of sessions in your head and aggregating them yourself.

For an app whose whole pitch is a progress **narrative**, that was a gap at the centre: the data
existed, but the one picture that answers *"is this person moving forward, across their whole body?"*
was never drawn. The body map draws it.

---

## Aesthetics

### Colour is contextual to the surface it's painted on

The same body geometry appears twice in the app, in two different colour languages. On the
per-exercise placard (`MuscleMap`), worked muscles are **Ember Red** — primary solid, secondary
tinted — the gym-chart convention for *"these are the muscles this movement works."* On the Home
heat-map (`BodyHeatMap`), frequency is **Command-Blue**.

The switch is deliberate and precise: **red on a body reads as soreness or injury.** The red that
means "worked" on a reference chart would mean "hurt" on your *own* body. So colour meaning here
isn't a fixed global rule — it depends on the surface it sits on. That's a small piece of real
sophistication most colour systems never reach for.

### Magnitude is one hue, never a rainbow

"How often did I train this?" is a *quantity*, so the ramp is a **single hue stepped by lightness** —
never a categorical rainbow. It's the same discipline the exercise-type palette follows from the
other direction: a *kind* gets a categorical hue, a *quantity* gets a sequential ramp. The through-
line across the app's visual language is that **colour never lies about what kind of variable it
is.** The five Command-Blue steps are dataviz-validated — single hue, monotone lightness,
distinguishable steps on both the near-black and the white ground (brighter on dark, darker on
white).

### An absolute ladder, in discrete steps

The scale is **absolute**: fixed 30-day session-count buckets — `1–2 · 3–4 · 5–6 · 7–9 · 10+` →
five tiers, with untrained left grey — not normalized to the athlete's own peak. And **discrete**,
not a smooth gradient: five legible levels beat a continuous ramp nobody can actually read at a
figure the size of a thumbnail. (Both of these were decisions made *during* the review that produced
this report — see "The decision this report changed," below.)

---

## Affordance

### The grey is the signal

The actionable part of the figure is the dim and grey regions — what you're *not* training. Absence
is the hard thing to notice, so the app names it rather than leaving it to inference: a first-class
**"Neglected — N muscles untrained"** tile sits right beside **"Most trained,"** turning something
you'd otherwise have to deduce from dim shapes into something you can tap.

### A funnel to action, not a readout

This is the heart of the feature. The figure is the **top of a funnel that ends in "train this
today":**

1. Tap a region on the figure →
2. the breakdown sheet scopes to that region's muscles, busiest-first →
3. tap a muscle → the exercises that work it — *your own logged history* first, then **Primary
   movers** / **Also works it** from the library →
4. tap an exercise → its detail opens on the Exercises page, where **Add to Workout** is one tap.

See a gap, fill it, in four taps. The home screen's glanceable figure isn't the end of a lookup —
it's the start of a plan.

### Two resolutions of one dataset

The figure is the coarse glance; the sheet is the fine drill — and the sheet reaches muscles the SVG
can't paint (e.g. *Tibialis Ant.*), listed as text rows, so **every** muscle is reachable somewhere.
The glance and the drill want different granularity, and each gets its own. The same care shows in
the small moves: a region that maps to a single muscle auto-expands straight to its exercises (no
dead tap); head and knees carry no muscle and are inert rather than fake-tappable; a region tap stops
propagation so it doesn't also fire the whole-figure "all muscles" view.

---

## Product-story fit

Just Train's thesis is **Capture → Compare → Communicate** — every screen answering *"is this person
moving forward?"* The body map is that question answered **spatially**: moving forward means training
the *whole* body, not just the mirror muscles, and the figure makes imbalance legible in a single
glance. It serves Compare and Communicate at the top of the day.

And it's **rendered from data, not from a stored image.** There's no muscle-diagram asset; the figure
is drawn client-side from the muscle vocabulary (the old `exercises.visualization` image column is
now vestigial). That buys determinism, theming, offline rendering, and no licensing — the app keeps
rendering in its own hands, the same instinct as the hand-rolled exercise-type glyphs. The current
metric is session frequency; the code leaves a clean seam for sets / reps / volume later.

---

## The decision this report changed

This report's review did what a good review should: it changed the product. The heat scale moved from
**relative 3-tier** to **absolute 5-tier**.

- **Why.** The relative scale normalized each region to the athlete's *own* busiest region, so the
  top tier always lit up. That meant a once-a-week trainee and a twice-a-day trainee rendered
  identically — it hid real training volume, and it quietly *fought* the diagnostic-funnel headline:
  a light month couldn't be allowed to look light. Absolute scaling, paired with "the grey is the
  signal," makes the figure honest — a mostly-grey figure is the true *"you've barely trained this
  month,"* not a defect to design around.
- **Why five.** An absolute scale earns more resolution than a relative one; three tiers flattened
  real differences the fixed ladder can now show.
- **How the numbers were set.** The thresholds were tuned against the *real* 30-day distribution
  (`docs/sql/body-heat-distribution.sql`), not guessed, and the five-step ramp was dataviz-validated
  on both grounds. Shipped in commit `1e2e0bf`.

---

## Where it sits in the design language

The body map is one expression of the app's deepest visual principle: **honest representation — the
UI shows the true state of training, and derives or degrades safely.** Absolute-not-flattered heat;
rendered-from-data figures; a scale that reads as real frequency. It shares two threads with its
sibling features — *render/derive rather than store* (circuits derive live position from logged sets;
the body map renders from the muscle data) and *colour never lies about which variable it is*
(categorical hue for kind, sequential ramp for magnitude). The body map is where that principle
becomes the first thing you see each day.
