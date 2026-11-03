---
id: rest-matches-the-modality
stage: seed
author: claude
grew-from: "[[3-circuits]]"
tokens: []
created: 2026-11-03
---

# Rest fires between rounds, not between exercises

The rest timer appears **only when the last exercise of a round is logged** — because in a circuit you
don't rest between the interwoven moves, only between rounds. The UI encodes the *actual training
semantics* of the modality, rather than firing a generic per-set timer. Behaviour matches how the
thing is really done.

Pulls on: [[circuit-modality-made-trustworthy]]
