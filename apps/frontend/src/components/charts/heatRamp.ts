// ------------------------------------------------------------
// components/charts/heatRamp.ts
//
// The one source for the Home body heat-map ramp, shared by the figure
// (BodyHeatMap) and its tap-in sheet (BodyBreakdownSheet) so they can't drift —
// they did once, the sheet kept Ember Red after the figure moved to blue.
//
// "How often trained" is a magnitude, so: one hue in discrete buckets. Gray when
// untrained; otherwise FIVE Command-Blue tiers that step with frequency (brighter
// on the dark ground, darker on white). Blue, not red — red on a body reads as
// soreness/injury. Tiers are ABSOLUTE 30-day session-count buckets (a fixed
// semantic ladder, not normalized to the athlete's own peak), so the heat tells
// you real training frequency. See task-plan-body-heat-absolute-5tier.md.
// ------------------------------------------------------------

// Variable-backed so the ramp flips by theme (dark values equal the former hex).
// Returned as rgb(var(--x)) strings — consumed via `style` (SVG fill / CSS bg),
// since var() does not resolve inside SVG presentation attributes.
export const HEAT_BASE_FILL  = 'rgb(var(--chart-base))'                                      // untrained (neutral)
export const HEAT_TIER_FILLS = [
  'rgb(var(--heat-1))', 'rgb(var(--heat-2))', 'rgb(var(--heat-3))',
  'rgb(var(--heat-4))', 'rgb(var(--heat-5))',
] as const // tiers 1–5

// Fill color for an absolute 30-day session count (gray if untrained). Fixed
// semantic ladder: 1–2 · 3–4 · 5–6 · 7–9 · 10+ → tiers 1–5.
export function heatFill(value: number): string {
  if (!value || value <= 0) return HEAT_BASE_FILL
  if (value <= 2) return HEAT_TIER_FILLS[0]
  if (value <= 4) return HEAT_TIER_FILLS[1]
  if (value <= 6) return HEAT_TIER_FILLS[2]
  if (value <= 9) return HEAT_TIER_FILLS[3]
  return HEAT_TIER_FILLS[4]
}
