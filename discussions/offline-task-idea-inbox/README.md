# Offline Task / Idea Inbox

A drop-box for TrainerApp ideas the designer captures **outside** a working session — thoughts that
arrive away from the keyboard, before they're shaped enough to be a task.

## How the designer uses it

- Drop one Markdown file per idea (or per cluster of related ideas) into this folder.
- Rough is fine — bullet fragments, half-formed. The point is to not lose the thought.
- Name files by topic, kebab-case: `custom-exercise-improvements.md`, `rest-timer-sounds.md`.

## How Claude treats it

- **Triaged at session start.** Claude checks this folder when a session opens and surfaces anything new.
- **Responds in-file.** Claude appends its reply to the same file under a dated
  `## Claude reply — <date>` header (append-only — it never edits or deletes the designer's text),
  and leaves a short pointer in chat. The file is the system of record for the exchange.
- **Grounded before answering.** Claude checks the actual code first — several "new" ideas turn out to
  already partly exist, so the work is often *enhance/consolidate*, not *build*.
- **Not built off a note alone.** An inbox item becomes real work only after the designer confirms
  direction; Claude then converts it to a `task_create` entry and the idea file records the decisions.

## Lifecycle

```
idea dropped  →  Claude triages + responds in-file  →  designer confirms direction
             →  task_create  →  built  →  decisions recorded back in the idea file
```

Resolved idea files stay here as the decision record; nothing is deleted.
