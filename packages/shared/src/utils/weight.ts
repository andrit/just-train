/**
 * weight.ts — Weight unit conversion utility.
 *
 * Used by both frontend (display conversions) and backend (normalizing stored values).
 * Default unit for the app is lbs. Weight is stored per set with its unit,
 * so conversions are always for display purposes — historical records are never mutated.
 */

import type { WeightUnit } from "../enums";

const LBS_PER_KG = 2.20462;
const KG_PER_LB = 0.453592;

/**
 * Convert a weight value from one unit to another.
 * Returns the value unchanged if from === to.
 * Result is rounded to 2 decimal places.
 */
export const convertWeight = (
  value: number,
  from: WeightUnit,
  to: WeightUnit
): number => {
  if (from === to) return value;
  const converted = from === "lbs" ? value * KG_PER_LB : value * LBS_PER_KG;
  return Math.round(converted * 100) / 100;
};

/** Format a weight value with its unit for display. */
export const formatWeight = (value: number, unit: WeightUnit): string =>
  `${value} ${unit}`;

/** Convert and format in one step — useful for display components. */
export const displayWeight = (
  value: number,
  storedUnit: WeightUnit,
  displayUnit: WeightUnit
): string => formatWeight(convertWeight(value, storedUnit, displayUnit), displayUnit);
