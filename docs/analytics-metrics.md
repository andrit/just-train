# Analytics — North Star, Funnel, Retention

> **Status:** definitions ratified 2026-11-14; queries in `docs/sql/analytics/`. No real-user data
> yet (beta ≈ the owner + test accounts), so the numbers in this doc are **illustrative** — the SQL
> is the real system and produces the true figures once users arrive.
>
> **Why this doc exists:** so the metrics are *defined once* and computed the *same way* every time.
> The three headline metrics are accounting-grade — they must be correct — so they come from the
> **operational database**, never from the lossy product telemetry (see "Data sources" below).

---

## Data sources — and why it matters

The app has two stores, good at different things. Picking the wrong one silently corrupts a metric.

| Source | What | Use it for | Never use it for |
|---|---|---|---|
| **Operational DB** (`trainers`, `clients`, `sessions`) | Durable relational rows; a signup or completed session cannot be lost | **North Star, funnel, retention** (must be correct) | — |
| **`client_events`** (`track()` → `POST /telemetry`) | First-party, PostHog-shaped, but **fire-and-forget: never retries, drops on failure** (`services/telemetry.ts`) | Engagement *colour*: PR detections, offline cache hits, PWA installs | Anything you need to reconcile or bill on |

The three metrics below are computed **entirely from the operational DB.** No new telemetry events are
needed — every funnel and retention signal is already a durable row. Telemetry stays as-is for texture.

## Definitions locked (so they don't get re-litigated)

- **"Completed session" = `sessions.status = 'completed'`.** Not `partial` (which nothing in the app
  sets today) and not `in_progress`. This matches every existing KPI and report query (`routes/kpis.ts`,
  `services/report.service.ts`) — one definition of "a session happened," everywhere.
- **Athlete-first unit.** A metric's unit is the **athlete = a trainer's self-client** (`clients.is_self = true`).
  Retention cohorts on `trainers.created_at`; a "retained" or "active" week means that trainer's
  **self-client** logged a completed session. The trainer-with-roster variant (count *any* client's
  session) is the same query with the `is_self` filter dropped — noted in each file, not built, because
  the product is athlete-first and beta has no rosters.
- **Weeks are ISO, Monday-start.** Session/activity week buckets on the **training date**
  (`sessions.date::date`, the user's own notion of when they trained); cohort week on
  `date_trunc('week', trainers.created_at)`. Keeping these distinct avoids a Sunday-night session
  landing in the wrong week.
- **Activation window = 7 days; habit window = 14 days**, both measured from signup (`created_at`).
- **Test accounts are excluded by an explicit email list**, not by role. The owner
  (`ritterandrew1@gmail.com`) is `role = 'admin'` but is the *only real user* — filtering by role would
  drop the real account and keep the 5 test ones. Each query has an `excluded` CTE at the top; fill in
  the test emails there, in one place. Deactivated accounts (`deactivated_at IS NOT NULL`) are always
  excluded.

---

## 1. North Star Metric — Weekly Logged Sessions

**Definition:** count of completed self-client sessions per ISO week.

A logged session is the atom of value: the whole thesis (*Capture → Compare → Communicate → "is this
person moving forward?"*) cannot begin until someone logs. It compounds breadth and frequency, and it
*leads* retention and revenue rather than lagging them.

**Decomposition** — the useful part, because it says *what to push* when the number moves:

```
Weekly Logged Sessions  =  Weekly Active Athletes  ×  Sessions per Active Athlete
      (North Star)              (breadth)                   (depth)
```

A dip is immediately diagnosable as a breadth problem (fewer people) or a depth problem (same people,
less often).

**Guardrails** (so you don't win NSM the wrong way): 4-week retention (§3) and start→complete rate
(don't inflate with abandoned sessions).

**Rejected alternative:** "Weekly Active Athletes with ≥2 sessions" — a purer habit signal, but it
discards the depth axis and is harder to teach. Weekly Logged Sessions + the decomposition keeps both.

```
Weekly Logged Sessions (ILLUSTRATIVE — real output comes from north-star-weekly.sql)
W1  ▇▇ 14
W2  ▇▇▇ 22
W3  ▇▇▇▇▇ 38
W4  ▇▇▇▇▇▇▇ 55     ← 18 active athletes × 3.1 sessions each
```

Query: `docs/sql/analytics/north-star-weekly.sql`

## 2. Activation funnel

Self-serve athlete path; each step is a conversion gate. **Activation = first completed session.**

| Stage | Defined as | Source |
|---|---|---|
| Signed up | eligible `trainers` row exists | `trainers.created_at` |
| Onboarded | `trainers.onboarded_at IS NOT NULL` | `trainers` |
| Started first session | self-client session with `start_time IS NOT NULL` | `sessions` |
| **Activated** ★ | first self-client `completed` session **within 7 days** of signup | `sessions` |
| Habit | **≥3** self-client completed sessions **within 14 days** of signup | `sessions` |

```
ILLUSTRATIVE
Landing visit       1,000    —      ← lives on the marketing site, NOT the app (see seam below)
  ↓ sign up           120   12%
Account created       120
  ↓ onboard           100   83%
Onboarded             100
  ↓ start first        78   78%
First started          78
  ↓ complete ★ ACT.    61   78%     ← activation
Activated              61
  ↓ ≥3 in 14 days      34   56%
Habit                  34
```
Overall visit→activated ≈ 6%, signup→activated ≈ 51%. The worst step is where you focus — here the
12% visit→signup (a landing/positioning problem, which feeds the #28 content-marketing workstream).

**The top-of-funnel seam:** "Landing visit" is *not* in the app DB — it lives in the separate
`just-train.fit` marketing-site project's analytics. The funnel is stitched across two systems at the
signup boundary; the SQL covers signup→habit, and the visit→signup rate is joined in by hand until the
split-hosting work (#30) makes the boundary a clean redirect.

Query: `docs/sql/analytics/activation-funnel.sql`

## 3. Retention cohorts

Group athletes by **signup week**; each cell = % of that cohort whose self-client logged a completed
session in week N after signup. Watch for the curve **flattening** (a retained core) vs. decaying to
zero (leaky bucket). The asymptote is the true retained fraction; the W0→W1 drop measures
onboarding/activation quality.

```
ILLUSTRATIVE (retention-cohorts-weekly.sql returns this in long form; pivot to the triangle)
Cohort     W0    W1    W2    W3    W4    W5
Nov-03    100%   46%   33%   29%   25%   24%   ← flattening ≈ retained core
Nov-10    100%   44%   31%   27%   —     —
Nov-17    100%   48%   35%   —     —     —
Nov-24    100%   —     —     —     —     —
```

Query: `docs/sql/analytics/retention-cohorts-weekly.sql`

---

## Running these

All three are **read-only `SELECT`s** — safe to run directly against prod (no `BEGIN…ROLLBACK` needed,
per the repo's SQL rule for reads). Get the URL from Railway → Postgres → Variables → `DATABASE_PUBLIC_URL`
(don't save it to a file):

```
psql "<DATABASE_PUBLIC_URL>" -f docs/sql/analytics/north-star-weekly.sql
```

Before trusting the output, fill the `excluded` email list at the top of each file with the test
accounts, or the numbers are dominated by test data.

## Deferred — the next layer (not built yet)

- **Admin metrics endpoint.** `GET /api/v1/admin/metrics` behind `requireRole('admin')` (owner is admin),
  running these queries and returning JSON, to back a live dashboard instead of hand-run SQL. Deferred on
  purpose until the definitions have been run against real-ish data and settled — build the consumer after
  the source is proven. See PROJECT_STATE deferred table.
- **Landing-visit stitch.** Wire the marketing-site visit count into the top of the funnel once #30
  (split hosting: `app.just-train.fit` + apex landing) lands and the signup boundary is a clean redirect.
