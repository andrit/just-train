/**
 * setMath.ts — the single source of truth for per-side reps and set volume.
 *
 * Used by both frontend (display, volume previews) and backend (serializers,
 * KPI volume, PR/record derivation). Never compute `weight * reps` inline for
 * volume anywhere — route it through here so unilateral (per-side) work is
 * counted consistently.
 *
 * Laterality model (see exercises.laterality / session_exercises.trackPerSide /
 * sets.per_side):
 *   per_side = false            -> total reps = reps            (bilateral / "together")
 *   per_side = true,  L/R null  -> total reps = reps * 2        (symmetric, presumed equal)
 *   per_side = true,  L/R set   -> total reps = repsLeft+Right  (asymmetric drill-down)
 *
 * L and R each fall back to `reps` when null, so the symmetric case writes
 * nothing extra and still counts both sides.
 */

/** The minimal shape needed to compute reps/volume — a Set or set-like input. */
export interface SetLike {
  reps: number | null | undefined;
  weight?: number | null | undefined;
  perSide?: boolean | null | undefined;
  repsLeft?: number | null | undefined;
  repsRight?: number | null | undefined;
}

/**
 * Total reps performed in a set, counting both sides for per-side efforts.
 * Returns 0 when reps is null/undefined (e.g. a cardio/time-only set).
 */
export const sideReps = (set: SetLike): number => {
  const reps = set.reps ?? 0;
  if (!set.perSide) return reps;
  const left = set.repsLeft ?? reps;
  const right = set.repsRight ?? reps;
  return left + right;
};

/** True when this per-side set has an asymmetric L/R split recorded. */
export const isAsymmetric = (set: SetLike): boolean =>
  !!set.perSide &&
  (set.repsLeft != null || set.repsRight != null) &&
  (set.repsLeft ?? set.reps ?? 0) !== (set.repsRight ?? set.reps ?? 0);

/**
 * Volume for a single set = weight × total reps (both sides for per-side work).
 * Returns 0 when weight is null/undefined.
 */
export const setVolume = (set: SetLike): number =>
  (set.weight ?? 0) * sideReps(set);
