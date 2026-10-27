// ------------------------------------------------------------
// components/charts/heatRamp.ts
//
// The one source for the Home body heat-map ramp, shared by the figure
// (BodyHeatMap) and its tap-in sheet (BodyBreakdownSheet) so they can't drift —
// they did once, the sheet kept Ember Red after the figure moved to blue.
//
// "How often trained" is a magnitude, so: one hue in discrete buckets. Gray when
// untrained; otherwise three Command-Blue tiers that brighten with frequency
// (more = brighter, so the busiest region pops on the dark ground). Blue, not red
// — red on a body reads as soreness/injury. Tiers are normalized to the busiest
// value in the set, so the top tier always lights up.
// ------------------------------------------------------------

// Variable-backed so the ramp flips by theme (dark values equal the former hex).
// Returned as rgb(var(--x)) strings — consumed via `style` (SVG fill / CSS bg),
// since var() does not resolve inside SVG presentation attributes.
export const HEAT_BASE_FILL  = 'rgb(var(--chart-base))'                                      // untrained (neutral)
export const HEAT_TIER_FILLS = ['rgb(var(--heat-1))', 'rgb(var(--heat-2))', 'rgb(var(--heat-3))'] as const // low, med, high

// Fill color for a value given the busiest value in the set. `max` must be ≥ 1.
export function heatFill(value: number, max: number): string {
  if (!value) return HEAT_BASE_FILL
  const r    = value / max                           // 0 < r ≤ 1
  const tier = r <= 1 / 3 ? 0 : r <= 2 / 3 ? 1 : 2   // low | med | high
  return HEAT_TIER_FILLS[tier]
}
