// ------------------------------------------------------------
// lib/prRecords.test.ts — unit tests for the pure record-derivation helper
//
// Pure function, no I/O. Covers: baseline suppression, chip moving to the
// current record, load vs volume divergence (the 180×5 vs 140×10 case),
// tie handling (earliest keeps it), and per-exercise isolation.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { deriveRecordSetIds, type RecordCandidate } from '../../lib/prRecords'

// Helper: build a row with an incrementing timestamp from an index.
function row(id: string, exerciseId: string, weight: number | null, reps: number | null, order: number): RecordCandidate {
  return { id, exerciseId, weight, reps, createdAt: new Date(2026, 0, 1, 0, 0, order) }
}

describe('deriveRecordSetIds', () => {
  it('gives the lone baseline set no record', () => {
    const { loadIds, volumeIds } = deriveRecordSetIds([row('a', 'ex1', 100, 10, 0)])
    expect(loadIds.size).toBe(0)
    expect(volumeIds.size).toBe(0)
  })

  it('awards both records to the set that beats the baseline', () => {
    const { loadIds, volumeIds } = deriveRecordSetIds([
      row('a', 'ex1', 100, 10, 0), // baseline
      row('b', 'ex1', 120, 10, 1), // heavier + more volume
    ])
    expect([...loadIds]).toEqual(['b'])
    expect([...volumeIds]).toEqual(['b'])
  })

  it('moves the chip to the current record, off the earlier holder', () => {
    const { loadIds, volumeIds } = deriveRecordSetIds([
      row('a', 'ex1', 100, 10, 0), // baseline
      row('b', 'ex1', 110, 10, 1), // was a PR at the time
      row('c', 'ex1', 130, 10, 2), // current record
    ])
    expect([...loadIds]).toEqual(['c'])   // not 'b'
    expect([...volumeIds]).toEqual(['c'])
  })

  it('separates load and volume records (180×5 vs 140×10)', () => {
    const { loadIds, volumeIds } = deriveRecordSetIds([
      row('base', 'ex1', 100, 10, 0), // baseline so records can exist
      row('vol',  'ex1', 140, 10, 1), // 1400 volume
      row('load', 'ex1', 180, 5,  2), // heaviest, but 900 volume
    ])
    expect([...loadIds]).toEqual(['load'])
    expect([...volumeIds]).toEqual(['vol'])
  })

  it('counts both sides for a per-side set when deriving the volume record', () => {
    // A lighter unilateral set can out-volume a heavier bilateral one because
    // its reps count for both sides (sideReps). Load stays weight-only.
    const { loadIds, volumeIds } = deriveRecordSetIds([
      { id: 'base', exerciseId: 'ex1', weight: 50,  reps: 10, createdAt: new Date(2026, 0, 1, 0, 0, 0) }, // baseline
      { id: 'bi',   exerciseId: 'ex1', weight: 100, reps: 10, createdAt: new Date(2026, 0, 1, 0, 0, 1) }, // 1000 vol, heaviest
      { id: 'uni',  exerciseId: 'ex1', weight: 60,  reps: 10, perSide: true, createdAt: new Date(2026, 0, 1, 0, 0, 2) }, // 60 × 20 = 1200 vol
    ])
    expect([...loadIds]).toEqual(['bi'])    // 100 is heaviest — per-side reps don't change load
    expect([...volumeIds]).toEqual(['uni']) // 1200 > 1000 — only true when both sides are counted
  })

  it('keeps the record on the earliest set when a later set ties it', () => {
    const { loadIds } = deriveRecordSetIds([
      row('a', 'ex1', 100, 10, 0), // baseline
      row('b', 'ex1', 120, 5,  1), // record
      row('c', 'ex1', 120, 5,  2), // ties b — must NOT steal the chip
    ])
    expect([...loadIds]).toEqual(['b'])
  })

  it('does not award when the record holder is still the baseline', () => {
    const { loadIds, volumeIds } = deriveRecordSetIds([
      row('a', 'ex1', 100, 10, 0), // baseline, heaviest + most volume
      row('b', 'ex1', 90,  5,  1),
    ])
    expect(loadIds.size).toBe(0)
    expect(volumeIds.size).toBe(0)
  })

  it('derives records independently per exercise', () => {
    const { loadIds } = deriveRecordSetIds([
      row('a1', 'ex1', 100, 10, 0),
      row('a2', 'ex1', 120, 10, 1),
      row('b1', 'ex2', 50,  10, 0),
      row('b2', 'ex2', 60,  10, 1),
    ])
    expect(loadIds).toEqual(new Set(['a2', 'b2']))
  })

  it('ignores non-resistance rows (missing weight/reps)', () => {
    const { loadIds, volumeIds } = deriveRecordSetIds([
      row('a', 'ex1', null, null, 0),
      row('b', 'ex1', 100,  10,  1),
    ])
    // only one valid set (baseline) -> no records
    expect(loadIds.size).toBe(0)
    expect(volumeIds.size).toBe(0)
  })
})
