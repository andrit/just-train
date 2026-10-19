// ------------------------------------------------------------
// mode.test.ts — the gate that makes the mode "theme" promise real.
//
// A half-added variant (a label or capability present for one mode, missing for
// the other) fails CI here instead of leaking at runtime. This check CAN fail —
// delete any field from one mode in MODE_CONFIG and watch it go red.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { MODE_CONFIG, type Capability } from '@/lib/mode'
import { ProgressionStateEnum } from '@trainer-app/shared'

const CAPABILITIES: Capability[] = ['viewRoster', 'manageClients', 'sendReports', 'viewBilling']
const MODES = ['athlete', 'trainer'] as const

describe('MODE_CONFIG', () => {
  it('defines exactly the two modes', () => {
    expect(Object.keys(MODE_CONFIG).sort()).toEqual(['athlete', 'trainer'])
  })

  for (const mode of MODES) {
    describe(mode, () => {
      const cfg = MODE_CONFIG[mode]

      it('declares every capability as a boolean', () => {
        for (const cap of CAPABILITIES) expect(typeof cfg.can[cap]).toBe('boolean')
      })

      it('has non-empty dashboard + self-client labels', () => {
        expect(cfg.labels.dashboardTitle.length).toBeGreaterThan(0)
        expect(cfg.labels.selfClientLabel.length).toBeGreaterThan(0)
      })

      it('labels every progression state', () => {
        for (const state of ProgressionStateEnum.options) {
          expect((cfg.labels.progressionState[state] ?? '').length).toBeGreaterThan(0)
        }
      })

      it('has consistent, opposite isAthlete / isTrainer', () => {
        expect(cfg.isAthlete).toBe(mode === 'athlete')
        expect(cfg.isTrainer).toBe(mode === 'trainer')
        expect(cfg.isAthlete).not.toBe(cfg.isTrainer)
      })
    })
  }
})
