---
kind: machinima — rig-run reaction to a frozen compost source
reacts-to: 1-exercise-type-coding.md
author: claude (companion reaction — observations + things to pull on, NOT report prose)
started: 2026-11-02
convention: single living doc. Writer's inline notes are authorNotes — *italic*, marked *1, *2…
            — folded into the next revision, never overwritten. Major restructure → snapshot to
            archive/ first.
---

# Reaction — exercise-type color & icon coding

Companion read, before any gardening. I name the vector where it matters. Three lenses, then the
spine test, then the tensions worth pulling on. Your redirect drives what gets planted.

## Aesthetics

- **The palette is engineered, not chosen by taste.** ΔE ≥ 15 on every pair, contrast ≥ 3:1 on
  both grounds — those are *measured* constraints with a validator behind them. The aesthetic story
  here is discipline: "pretty" is a byproduct of "provably distinguishable." That's a strong,
  honest angle — most colour-coding reports hand-wave "we picked a nice palette"; this one can show
  its work.
- **Colour is doing double duty** — differentiator *and* connotation. Red reads as strength/effort,
  blue as cardio/motion, emerald as calm/mobility, slate as cool-down/powering-off. Four of the
  five carry an intuitive meaning. **Fuchsia (calisthenics) is the outlier** — it has no obvious
  bodyweight connotation; it's there because it had to be ΔE-distant from red *and* blue while the
  warm and cool meaning-slots were already taken. Worth being honest about: one hue is "what
  validated," dressed as semantic. Not a flaw — but the report shouldn't pretend all five are
  equally connotative.
- **Hand-rolled glyphs are a deliberate cost** (someone drew five SVGs instead of `npm i`). It buys
  uniform weight/viewBox/stroke and zero dependency, and it matches the Barlow-Condensed /
  near-black "gym poster" identity — the icons have the same confident, drawn-by-hand line. The
  flip side: **four glyphs are literal depictions (barbell, bike, two body poses) and one is a
  metaphor (snowflake = cool = cold).** The icon *logic* isn't uniform. Minor, but it's the kind of
  seam a careful aesthetics read names.

## Affordance

- **Triple-redundant encoding is the real affordance, not the colour.** Colour for the
  tenth-of-a-second glance, shape for colour-blindness / greyscale / glare, label for certainty.
  The feature isn't "category tags" — it's *recognition speed with a safety net*. That reframes the
  whole piece around robustness, which is more interesting than decoration.
- **The system is density-aware.** `showIcon` suppresses the glyph exactly where the card art
  already shows it, so you never get a redundant double-icon; the drawer, with no art competing,
  shows icon+label. Small, but it's evidence of affordance *thought*, not just a shared component.
- **Unknown-type → neutral slate is a quiet win.** The fallback is the null slot, so a type the
  system doesn't recognise degrades to "no signal," never to a *wrong* signal. Failure is designed,
  not accidental — exactly the "a check that can't lie" instinct.
- **The sharpest affordance decision: type-art thumbnail, photo demoted to the drawer.** At the
  browse/plan altitude the card optimises for *"what kind of work is this?"* over *"what does the
  movement look like?"* That's a real stance with a real cost — for an unfamiliar exercise, the
  photo is how a novice recognises it, and it's now one tap away. Pull on this: right call for a
  *movement library*, or does it serve the planning trainer at the novice athlete's expense?

## Product-story fit (Act Zero)

- **The Act Zero is sharper than "there was no colour coding."** Before #25 there were *two*
  colour maps that could paint the **same type two different colours.** So the before-state isn't
  absence — it's **colour coding that contradicted itself.** For an app whose whole pitch is a
  trustworthy progress *narrative*, a visual vocabulary that lies about its own categories is a
  credibility leak. That reframes the headline.
- **So the real headline may not be "colour" at all — it's "consistency / trust."** #25 is as much
  a *consolidation* (two divergent maps → one source of truth) as a visual feature. The colour is
  what you see; the single source of truth is what makes it *believable*. I'd lead the report there.
- **Fit in the thesis** (*Capture → Compare → Communicate*): type coding serves **Compare** and
  **Communicate** at the browse/plan altitude. It lets you read the *shape of a session* without
  reading words — "three red + one blue" = a strength day with a cardio finisher. That's the
  product's "legible at a glance" promise expressed in a glance-sized unit.
- **Why now:** it rode in on the #22 token system (the colour infra already existed) as part of the
  exercise-library push. A clean "the groundwork paid off" beat — the tokens made a one-session
  feature out of what would otherwise have been a palette-wide retrofit.

## Spine test (Bridge — flagged, not yet planted)

Hypothesis from the backlog: all three features **encode an invisible dimension of training into
glance-legible form.** Type coding encodes *what kind*, with a CVD safety net. It fits cleanly. The
question for when we reach the body map (*what muscle*) and circuits (*how structured*) is whether
the **safety-net / redundant-encoding** half of the pattern generalises, or whether that's specific
to type coding. If it does, "legible with a safety net" is the spine; if not, the spine is just
"legible at a glance" and redundancy is this piece's own motif.

## Tensions worth pulling on (your call which we garden)

1. **Is the headline "colour" or "trust/consistency"?** I lean trust — the consolidation is the
   load-bearing move. *(my strong lean)*
2. **Fuchsia** — own it as "the validator's choice," or build a post-hoc connotation for it?
3. **Snowflake** — the one metaphor glyph among four literal ones. Name the seam, or leave it?
4. **Photo in the drawer** — defend it as altitude-appropriate, or flag it as a cost to the novice?

<!-- authorNotes land here or inline above, marked *1 *2 … -->

## Changelog

- **2026-11-02** — initial reaction (aesthetics / affordance / Act Zero), spine test, four tensions.
- **2026-11-02** — writer review + Claude reply: headline = trust via a visual language; **fuchsia →
  gold** (validator shows it's CVD-cleaner than fuchsia; keep clear of the reward amber); snowflake kept;
  photo-in-drawer kept. Corrected a light/dark transposition in the frozen dump. Recolor to spin out as
  an app task plan.
- **2026-11-02** — recolor plan drafted (`task-plan-calisthenics-recolor.md`): **gold is blocked** —
  measured ΔE to the reserved reward-amber is 2.5 / 5.3 (dark) and 9.8 / 12.5 (light), below the 15
  normal-vision floor, so a gold type pill would read as a PR. Hue decision REOPENED: (A) keep fuchsia
  [rec] · (B) gold + recolor the reward signal (separate initiative) · (C) a calmer safe magenta.
  Awaiting the writer's call.
- **2026-11-02** — hue decision RESOLVED: **keep fuchsia (A).** Gold blocked by the reward-amber
  collision; no code change. Report beat: a review that tested a change and consciously kept the original.


REPLY:
1. trust/consistency through a visual language (design elements at play)
2. honestly I think a gold or amber makes more sense than fuschia
3. snowflake metaphor workd for cool down...or maybe steam rising. either way, metaphor works here
4. altitude appropriate concious decision. you click in to the exercise and you get all the info, including the image. no conflict here

---
## Claude reply — 2026-11-02

First, a **correction to the frozen dump** (`1-exercise-type-coding.md`): I transposed light/dark for
the type palette. Actual — **dark** `#D91B1B/#3B82F6/#C026D3/#059669/#94A3B8`, **light**
`#B91C1C/#1D4ED8/#A21CAF/#047857/#334155`. (Per convention I don't edit the frozen dump; the report
draws from this corrected note.)

**1. Headline — locked:** *trust/consistency through a visual language.* Your framing sharpens mine —
the trust is delivered **by the design elements themselves** (colour + glyph + pill), not just by the
one-source-of-truth under the hood. Both layers: the SoR makes it *consistent*, the visual language
makes it *legible*. That's the lead.

**2. Fuchsia → gold/amber — yes, and the validator overturned my caution.** I'd worried amber-near-red
would be CVD-worse. It's the opposite: fuchsia's weak pair was actually **fuchsia↔cardio-blue** (ΔE 6.1
dark / 7.4 light — a WARN). Gold/amber **removes** that; the limiting pair becomes emerald↔red at ~8–9,
which **passes**. So the swap is cleaner for colour-blind readers *and* matches your read. Two real
constraints before we pick a value:
- **Don't reuse the reward amber.** The app's PR/achievement flash is amber (~`#F59E0B`). Making a
  *type* that same amber overloads a reserved signal — the exact "colour never lies about which
  variable it is" rule this piece is built on. So: a **gold clearly yellower than the PR amber**
  (e.g. `#EAB308`-ish on dark), never the literal reward amber.
- **It'll run bright.** Gold/amber is intrinsically lighter than the other four hues (it sits above the
  categorical lightness band), so it pops a bit more; and a *deep* gold dips under 3:1 on white
  (`#CA8A04` = 2.94). There's a squeeze — bright enough to clear white-contrast, not so bright it
  dominates. I'll pick exact light+dark hexes and validate both.

Path (same shape as the heat-map): I write an **app task plan** — swap `--type-calisthenics` in the
three `index.css` blocks, keep the jumping-jack glyph + label, dataviz-validate the final pair incl.
distance from the reward amber — then **your confirm**, then execute. So item 1, like the body map,
becomes *a review that changed the product.*

**3. Snowflake — kept.** Agreed the metaphor earns its place (cool/cold; steam-rising is a nice
alternate if we ever revisit — "heat leaving the body"). Not a seam to flag; a deliberate choice.

**4. Photo in the drawer — kept, defended.** Altitude-appropriate conscious decision: the card answers
"what kind," the click-in gives everything incl. the image. No conflict — the report frames it as
intent, not a cost.

**Net:** all four resolved; one app change spun out (the recolor). Say the word and I'll draft the
`--type-calisthenics` recolor task plan the way we did the heat map.

_— end Claude reply —_
---

## Afterward — gardening vet (2026-11-03)

I planted the type-coding cluster (9 notes); before Rendering, here are the doubts about **how I
portrayed it** — the parts most likely to be my angle rather than the feature's truth. Stated so the
report can correct for them, not inherit them.

1. **Engineering story dressed as a user story.** The headline I planted — "trust via a visual
   language," built on [[two-maps-that-lied]] — centres on a *consolidation the user never saw*. A user
   who never met the old two-map inconsistency doesn't *feel* "now it's trustworthy." Real risk: the
   lead is a designer's truth, not a felt-UX one. The report should be honest that this is a
   **product-integrity** story unless we can name a user-visible symptom of the old bug.

2. **Robustness overstated as "the real affordance."** [[triple-redundant-encoding]] frames colour+
   glyph+label as the centre. But for most users the *colour* is the daily experience; glyph+label are
   insurance for the CVD/greyscale case. I may have elevated my preferred "robustness" angle above the
   actual felt experience. The report should rank them: colour is the experience, redundancy is the
   safety net — not "redundancy is the point."

3. **The "rejected gold" beat risks padding.** [[fuchsia-kept-decision]] is a *non-change*. "A review
   that changed the reasoning, not the code" can inflate a non-event into profundity. It earns a place
   only if it carries the transferable **principle** (a type hue must not collide with the reward
   signal — colour never lies about which variable it is), not as a war story.

4. **"Engineered palette" leans too intentional.** I portrayed the palette as disciplined design, but
   the gold exploration showed it's substantially **constraint-forced** — fuchsia is "the one free
   CVD-safe slot," chosen by elimination, not connotation. I flagged this inside [[engineered-palette]],
   but the cluster still tilts "designed." Honest framing: engineered *within hard constraints*, and one
   hue landed where it did because nothing else fit.

5. **Over-committing the cross-piece spine.** I linked four notes to [[honest-representation]] as if the
   spine is settled. It's still a *candidate* pending the Bridge across all four pieces. Gardening may be
   pre-baking a conclusion; the report should present it as a thread, not a law.

**Lowest-confidence claim overall:** #1 (the trust headline's user-visibility). If I had to cut or
hedge one thing before Rendering, it's that. Flagging for your call before I draft.
