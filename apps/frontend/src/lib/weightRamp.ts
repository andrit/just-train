// ------------------------------------------------------------
// lib/weightRamp.ts — Weight ramp expansion (pure)
//
// A ramp is a starting weight + a per-set step. Only the start and step are
// stored; the per-set sequence is expanded live for prefill/preview. Shared by
// the exercise-target editor (AddExerciseSheet) and circuit creation
// (CircuitBuilderSheet), where "sets" = the circuit's rounds.
// ------------------------------------------------------------

export function weightRampSequence(start: number, step: number, sets: number): number[] {
  return Array.from({ length: Math.max(1, sets) }, (_, i) => Math.max(0, start + i * step))
}
