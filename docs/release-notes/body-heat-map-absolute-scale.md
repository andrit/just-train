# Body heat-map — absolute scale + 5 tiers

**Date:** 2026-11-02
**Area:** Home (`DashboardPage`) body heat-map + its tap-in breakdown sheet.

## What changed

The Home body figure shades each muscle region by **how often it was trained in the last 30 days**.
It used to be a **relative** 3-tier scale: each region's colour was normalized to the athlete's *own*
busiest region, so the top tier always lit up. That hid the one thing the figure should carry — real
training volume — because a once-a-week athlete and a twice-a-day athlete rendered identically, and it
worked against the figure's job as a "what am I neglecting?" diagnostic.

It is now an **absolute** 5-tier scale on a fixed semantic ladder of 30-day completed-session counts:

| sessions / 30d | tier |
|---|---|
| 0 | untrained (grey) |
| 1–2 | tier 1 |
| 3–4 | tier 2 |
| 5–6 | tier 3 |
| 7–9 | tier 4 |
| 10+ | tier 5 |

A mostly-grey figure is now the honest signal (you've barely trained), and the brightest regions mean
genuinely high frequency — not merely "your most-trained, whatever that was."

## Why these numbers

Thresholds were set from the real 30-day distribution, not guessed — see
`docs/sql/body-heat-distribution.sql` (a read-only query mirroring the
`/clients/:id/muscle-frequency` join: distinct completed sessions per muscle in the window).

## The colour ramp

Five single-hue Command-Blue steps, theme-flipped (brighter on the dark ground, darker on white),
dataviz-validated (one hue, monotone lightness, adjacent ΔL ≥ 0.06, light-end clears the contrast
floor on each ground). On light the high end is a deep navy — the `--heat-*` ramp is its own token
family, independent of `--command-blue`.

## Code

- `apps/frontend/src/index.css` — `--heat-4` / `--heat-5` added (and `--heat-1..3` recalibrated) in
  all three theme blocks (`:root` dark, `[data-theme="light"]`, `@media prefers-color-scheme: light`).
- `apps/frontend/src/components/charts/heatRamp.ts` — `HEAT_TIER_FILLS` 3 → 5; `heatFill(value)` is now
  a pure absolute-threshold function (no `max` argument):

  ```ts
  export function heatFill(value: number): string {
    if (!value || value <= 0) return HEAT_BASE_FILL
    if (value <= 2) return HEAT_TIER_FILLS[0]
    if (value <= 4) return HEAT_TIER_FILLS[1]
    if (value <= 6) return HEAT_TIER_FILLS[2]
    if (value <= 9) return HEAT_TIER_FILLS[3]
    return HEAT_TIER_FILLS[4]
  }
  ```

- `apps/frontend/src/components/charts/BodyHeatMap.tsx` and `.../BodyBreakdownSheet.tsx` — dropped the
  `max = Math.max(1, …)` normalization; both call `heatFill(count)` directly.

## Verification

- Container: `tsc --noEmit`, `eslint`, and a `postcss.parse` gate on `index.css` — all clean.
- Device: verified on-device in both themes (CI green, tiers spread as expected).
