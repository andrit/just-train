# User Manual — how to talk to the rig (Craft KB · portable)

Status: living

The handles for driving the rig — the **ways of speech** that invoke each part. **Natural language
is fine**; these are starting phrasings, not rigid commands. Add your own — if a new phrasing
clearly means one of these, I'll honor it. Whenever I act, I **name the vector/move** I'm in, so
it's never ambiguous.

## Quick reference

| Say… | …and I will |
|------|-------------|
| **"menu"** (also "options", "what can I do") | lay out the console — the four entry moves |
| **"Ponder …"** + an idea | riff & expand; generate possibilities, "what ifs" |
| **"Bridge …"** + ideas | map how they connect; surface gaps and contradictions |
| **"Render …"** + ideas | organize faithfully — **no invention** |
| **"Collide X × Y"** | force two tokens together to spark a metaphor (candidates only — you veto) |
| **"Act Zero …"** | develop the seed — the world *outside* the lens |
| **"glossary …"** / name the players | build the bible — characters, places, concepts |
| **"the knot …"** | name the central tension in an idea, so we can pull on it |
| **"boost this"** (opt. "…as a `<form>`") | take the pen for **one** voiced story block, then hand it back |
| **"…as a screenplay scene / novel chapter / episode cold-open / short story"** | load that form's rulebook for the task |
| **"edit this"** / **"do a pass"** | show **Original + Proposed side-by-side**; nothing applied without your yes |
| **"Perkins-light"** (default) · **"Bellen-close"** / **"go to line level"** | structural nudges · close line work |
| **"lean King / more Gaiman / Kaufman the dialogue"** | steer the voice toward that archetype (a lean, never a copy) |

## Notes

- **A vector needs something to act on.** Pair it with input — an idea, a draft, a token. ("Ponder this: …")
- **Collide is a sub-move of Ponder.** Most collisions die on contact; that's the point — the survivors feel inevitable.
- **Boost is the *one* hand-over.** Everywhere else you hold the pen; I'm a companion, not a co-author.
- **Form is a lens, not a commitment.** Default stays form-agnostic; a form request only changes the rulebook for that one task.
- **Everything is provisional.** Any move or phrasing that doesn't earn its keep gets cut.

## Written notation (not spoken)

- `[[Name]]` — link glossary entries to weave the world together.
- `token.<type>.<name>` — a narrative token id. Types: `motif · theme · flaw · object · env`.

## The garden (graph model)

How ideas are stored and grown. **Grow in a graph; present in a tree.**

**Three zones — the directory maps to how *processed* an idea is, never to what it's *about*
(subject lives in `[[links]]` and `tokens:`, not in folders):**

1. **`compost-heap/`** — ① raw intake. Dumps as written. **Frozen / append-only — never edited.**
2. **`garden/`** — ② the living graph. **Flat** folder of atomic, linked idea-notes. Where growth happens.
3. **`documents/story/`** — ③ canon: the Rendered truth (`glossary.md`, `token-map.md`, `threads/`).

Flow: **dumped** (compost) → **cultivated** (garden) → **Rendered** (canon) → finished prose leaves
as a **story block** to the external manuscript.

**Note anatomy** (`garden/_TEMPLATE.md`): front-matter `id · stage · author · grew-from · tokens · created`,
then the idea + `[[links]]`.

**Stages live in front-matter, not folders:** `seed → sprout → branch → leaf`. Promotion = edit the
word; the file never moves (so links never break).

**Link rules — direction matters:**
- **garden → compost** = *lineage* (`grew-from`), **one-way** (compost is frozen; seeds never point forward).
- **garden ↔ garden** = *relationship* (`[[links]]`), reciprocal — the real web.
- **compost → anything** = none. Seeds are historical artifacts.
- Links resolve by **filename** (`[[the-darkman]]`), never folder paths; a link to a not-yet-created note
  is a **promise**, not an error.

**Who plants:** both. You plant freely; I plant only as the explicit output of a move (Render/Bridge/Ponder)
or when you ask — never silently. Every note tags `author:`. **I never overwrite a note you authored** (edit
protocol applies — propose, you accept); you edit mine freely. See the `plant-note` skill for the procedure.

**`garden/MAP.md`** is the hand-kept index — your navigation in VS Code, and what I render a **mermaid**
graph from on request. (Obsidian-later adds auto-backlinks + graph view for free; same files, no migration.)

### Machinima files — the reaction sidecar

A **`<source>-machinima.md`** is a rig-run reaction *beside a **frozen / read-only** source* — a compost-heap
seed now, a visiting manuscript section later. It exists because a frozen source can't absorb the discussion,
so the reaction lives next to it. **Inside the garden you don't make `-machinima` sidecars** — garden notes
are living, so discussion flows into the note or a new linked child note. *Sidecar for frozen things; links
for living things.*

**authorNotes.** The writer's inline edits/annotations *inside* a machinima file are called **authorNotes**
and are written in *italics* (a `*n` marker ties a note to a specific spot). They are the writer's, never
overwritten; I fold them into the next revision and respond to them, leaving the originals intact.

**Versioning.** A machinima file is a **single living doc** (not one file per version). It carries a
`## Changelog` (v1 → v2 → …, one line each). **Before any major restructure**, I first snapshot the current
file — *capturing the latest authorNotes* — to `compost-heap/archive/<source>-machinima-v<N>.md` (frozen,
never edited), then rewrite the living doc. Nothing is ever lost; the archive is the undo.

## Not active yet (future)

- **"manuscript pass"** — at a juncture (end of a draft or act), bring the manuscript in for a
  read-only token audit, then it leaves. Deferred — not built.

---

*Full picture of how the pieces fit: `documents/README.md`. The move-by-move prompt bank: `craft/interface.md`.*
