---
id: heat-absolute-decision
stage: sprout
author: claude
grew-from: "[[2-body-map]]"
tokens: [theme.honest-representation]
created: 2026-11-02
---

# DECISION — absolute heat, not relative

**Decided 2026-11-02 (writer, in the body-map review).** The Home heat-map moves from a **relative**
scale (each region normalized to the athlete's own busiest region) to an **absolute** 30-day
session-count scale.

**Why:** relative hid the one thing the figure should carry — *how much you've actually trained each
region*. A once-a-week and a twice-a-day trainee rendered identically. Absolute also **reinforces the
funnel** ([[body-map-diagnostic-funnel]]): a mostly-gray figure for a light user is the honest
diagnostic, not a defect to avoid. So relative wasn't just less informative — it quietly fought the
headline.

**Report beat:** this is a *retrospective design review that changed the product it was reviewing* —
the report records relative→absolute and the before/after.

**Implementation:** app-side, `.workbench/designer/current/task-plan-body-heat-absolute-5tier.md`
(frontend-only; thresholds tuned from the real 30-day distribution before locking).

Pulls on: [[body-map-diagnostic-funnel]], [[heat-five-tiers-decision]], [[honest-representation]]
