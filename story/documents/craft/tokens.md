# Narrative Tokens — the system (Craft KB · portable)

Status: **provisional** — evolve or cut.

A **design system for meaning**: stable semantic IDs for the abstract stuff of the story —
motifs, themes, flaws, objects, atmospheres — so we can **generate** with them, **track** them,
and keep their evolution **disciplined**. Same idea as UI design tokens, pointed at subtext.
Portable: the *system* travels to any story; *this* story's tokens live in the Story KB
(`story/token-map.md`), and each token's identity lives in `story/glossary.md`.

## Two jobs (they map to the vectors)

- **Generate → Ponder.** Force tokens together to spark metaphor (see **Collide**).
- **Track → Bridge.** Watch where tokens cluster, where they get abandoned, and whether their
  meaning is actually evolving.

## The token record

- **id:** `token.<type>.<kebab-name>` — e.g. `token.motif.water`. Stable once assigned.
- **type:** one of the taxonomy below.
- **identity:** *lives in the glossary entry* (what this noun IS in the story). Not duplicated here.
- **trajectory:** ordered meaning-waypoints (see below).
- **trail-links:** typed edges to other tokens (see below).
- **collisions-to-try:** candidate pairings, with status (tried / kept / killed).

## Taxonomy (starter types)

- **motif** — a recurring image/element (`token.motif.water`).
- **theme** — an idea the story is *about* (`token.theme.hubris`).
- **flaw** — a character's internal fault (`token.flaw.pride`).
- **object** — a charged physical thing (`token.object.oyster-earring`).
- **env** — atmosphere / the physical state of the world (`token.env.decay`).

*(Parked, not part of this layer: "logline → 18 semantic blocks" blueprint generation — that's a
screenplay-structure generator, a form-lens feature for if/when we go screen.)*

## Trajectory — a motif must evolve

A static motif is a dead motif. Track how a token's **meaning mutates** across the story as the
lens moves through it. Waypoints are tied to structural position — form-agnostic (early / mid /
late) until a form is chosen, then act/episode markers.

> e.g. `token.object.oyster-earring`: lost wealth → personal purpose → the absurdity of bureaucratic existence.

## Trail-links — subtext made visible

Typed, directed edges between tokens. This is the subtext graph.

> `token.flaw.pride —expressed-as→ token.object.champagne`

`[[links]]` give the lightweight undirected version; trail-links add direction + relation. I can
render the whole web as a **mermaid network map** or a token's arc as a **trajectory timeline** on demand.

## Collide — a sub-move of Ponder

Name two tokens; I force them to intersect to spark a metaphor or scene.

> `token.motif.water` × `token.theme.hubris` → a man chokes on a sip of expensive champagne mid-brag.

**Candidates only — your gut vetoes.** A collision matrix throws off many clever-but-dead pairings;
most should die. The ones that survive are the ones that feel inevitable in hindsight.
(The procedure is the `collide` skill.)

## Boundary — design layer, not a line-index

The manuscript lives elsewhere, so this is a **design + generation registry**, not an exhaustive
index of every appearance. Clustering/frequency analysis only runs on text we actually have
in-session (a block you're drafting, a section you paste). We design and generate here; the
manuscript is yours, over there.

## Guardrails (so the tool stays a servant)

- **Few load-bearing tokens**, not a census.
- **Trajectory over tally** — how meaning *moves*, not how often it appears.
- **Collisions are candidates**; the writer vetoes.
- **Don't instrument while drafting** — door closed (King). This is a between-passes tool.
- **Provisional and cuttable**, like everything in the Craft KB.

## Future (deferred — not initial scope) · Manuscript passes

At **junctures** (end of a draft, end of an act, or "is this motif working?"), bring the manuscript
— or a section — in for a **read-only instrument pass**: tag instances, run clustering /
abandonment analysis, and audit each token's **actual trajectory against its intended** one; update
`story/token-map.md`; return a report (+ optional mermaid map / trajectory timeline). This is the
one moment the in-frame story meets its out-of-frame design.

Privacy discipline for this feature: the manuscript **visits transiently** — we persist only the
**derived token data**, never the prose. Processed locally, like everything else. The manuscript
stays external; only the analysis remains.
