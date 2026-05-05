import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter }        from 'react-router-dom'
import { useState, useEffect } from 'react'
import { PastSetRow, ActiveSetRow, FutureSetRow } from '@/components/session/SetRow'
import { RestTimerBanner }     from '@/components/session/RestTimerBanner'
import { EndSessionModal }     from '@/components/session/EndSessionModal'
import type { SetResponse }    from '@trainer-app/shared'

export default {
  title: 'Session',
} satisfies Meta

// ── Shared fixture ────────────────────────────────────────────────────────────

const makeSet = (overrides: Partial<SetResponse> = {}): SetResponse => ({
  id:                'set-1',
  sessionExerciseId: 'se-1',
  setNumber:         1,
  reps:              5,
  weight:            225,
  weightUnit:        'lbs',
  durationSeconds:   null,
  distance:          null,
  speed:             null,
  intensity:         null,
  side:              null,
  rpe:               8,
  notes:             null,
  isPR:              false,
  isPRVolume:        false,
  createdAt:         new Date().toISOString(),
  ...overrides,
})

// ── SetRow — Past ─────────────────────────────────────────────────────────────

export const PastSet_Hit: StoryObj = {
  name: 'SetRow / Past — Hit target',
  render: () => (
    <div className="max-w-sm p-4">
      <PastSetRow
        setNumber={1}
        set={makeSet({ reps: 5, weight: 225 })}
        targetReps={5}
        targetWeight={225}
      />
    </div>
  ),
}

export const PastSet_Surpassed: StoryObj = {
  name: 'SetRow / Past — Surpassed target',
  render: () => (
    <div className="max-w-sm p-4">
      <PastSetRow
        setNumber={2}
        set={makeSet({ reps: 7, weight: 235 })}
        targetReps={5}
        targetWeight={225}
      />
    </div>
  ),
}

export const PastSet_Missed: StoryObj = {
  name: 'SetRow / Past — Missed target (orange)',
  render: () => (
    <div className="max-w-sm p-4">
      <PastSetRow
        setNumber={3}
        set={makeSet({ reps: 3, weight: 205 })}
        targetReps={5}
        targetWeight={225}
      />
    </div>
  ),
}

export const PastSet_NoTarget: StoryObj = {
  name: 'SetRow / Past — No target (blank session)',
  render: () => (
    <div className="max-w-sm p-4">
      <PastSetRow
        setNumber={1}
        set={makeSet({ reps: 8, weight: 135 })}
        targetReps={null}
        targetWeight={null}
      />
    </div>
  ),
}

// ── SetRow — Active ───────────────────────────────────────────────────────────

export const ActiveSet_WithTargets: StoryObj = {
  name: 'SetRow / Active — With template targets',
  render: () => (
    <div className="max-w-sm p-4">
      <ActiveSetRow
        setNumber={2}
        targetReps={5}
        targetWeight={225}
        weightUnit="lbs"
        lastSet={makeSet({ reps: 5, weight: 225 })}
        onLog={(reps, weight) => console.log('Logged:', reps, weight)}
        isLogging={false}
      />
    </div>
  ),
}

export const ActiveSet_BlankSession: StoryObj = {
  name: 'SetRow / Active — Blank session (default reps)',
  render: () => (
    <div className="max-w-sm p-4">
      <ActiveSetRow
        setNumber={1}
        targetReps={10}
        targetWeight={null}
        weightUnit="lbs"
        lastSet={null}
        onLog={(reps, weight) => console.log('Logged:', reps, weight)}
        isLogging={false}
      />
    </div>
  ),
}

export const ActiveSet_Loading: StoryObj = {
  name: 'SetRow / Active — Logging in progress',
  render: () => (
    <div className="max-w-sm p-4">
      <ActiveSetRow
        setNumber={3}
        targetReps={6}
        targetWeight={245}
        weightUnit="lbs"
        lastSet={makeSet({ reps: 6, weight: 235 })}
        onLog={() => {}}
        isLogging={true}
      />
    </div>
  ),
}

// ── SetRow — Future ───────────────────────────────────────────────────────────

export const FutureSet_WithTarget: StoryObj = {
  name: 'SetRow / Future — With target',
  render: () => (
    <div className="max-w-sm p-4 space-y-2">
      <FutureSetRow setNumber={3} targetReps={6}  targetWeight={245} />
      <FutureSetRow setNumber={4} targetReps={6}  targetWeight={245} />
    </div>
  ),
}

// ── Full accordion stack ──────────────────────────────────────────────────────

export const FullAccordion: StoryObj = {
  name: 'SetRow / Full accordion — 2 past, 1 active, 2 future',
  render: () => (
    <div className="max-w-sm p-4 space-y-2">
      <p className="text-xs text-gray-500 mb-4">Squat — Resistance · 5 sets</p>
      <PastSetRow  setNumber={1} set={makeSet({ reps: 5, weight: 225 })} targetReps={5} targetWeight={225} />
      <PastSetRow  setNumber={2} set={makeSet({ reps: 5, weight: 225, setNumber: 2 })} targetReps={5} targetWeight={225} />
      <ActiveSetRow
        setNumber={3}
        targetReps={5}
        targetWeight={225}
        weightUnit="lbs"
        lastSet={makeSet({ reps: 5, weight: 225 })}
        onLog={(r, w) => console.log(r, w)}
        isLogging={false}
      />
      <FutureSetRow setNumber={4} targetReps={5} targetWeight={225} />
      <FutureSetRow setNumber={5} targetReps={5} targetWeight={225} />
    </div>
  ),
}

// ── Rest timer banner ─────────────────────────────────────────────────────────

function LiveTimerDemo({ initialSeconds }: { initialSeconds: number }): React.JSX.Element {
  const [remaining, setRemaining] = useState(initialSeconds)
  const total = initialSeconds

  useEffect(() => {
    if (remaining <= 0) return
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const mockTimer = {
    isRunning:   remaining > 0,
    remaining,
    total,
    start:       (s: number) => setRemaining(s),
    skip:        () => setRemaining(0),
    progressPct: ((total - remaining) / total) * 100,
  }

  return (
    <div className="relative h-32 bg-brand-primary rounded-xl overflow-hidden">
      <RestTimerBanner timer={mockTimer} />
      <div className="flex items-center justify-center h-full pt-12">
        <p className="text-gray-600 text-sm">Content below the banner</p>
      </div>
    </div>
  )
}

export const RestTimer_Counting: StoryObj = {
  name: 'RestTimerBanner / Counting down from 90s',
  render: () => <LiveTimerDemo initialSeconds={90} />,
}

export const RestTimer_Low: StoryObj = {
  name: 'RestTimerBanner / Low (≤10s, amber)',
  render: () => <LiveTimerDemo initialSeconds={8} />,
}

export const RestTimer_VeryLow: StoryObj = {
  name: 'RestTimerBanner / Very low (≤3s, red + pulse)',
  render: () => <LiveTimerDemo initialSeconds={3} />,
}

export const RestTimer_Hidden: StoryObj = {
  name: 'RestTimerBanner / Hidden when not running',
  render: () => {
    const mockTimer = { isRunning: false, remaining: 0, total: 0, start: () => {}, skip: () => {}, progressPct: 0 }
    return (
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-2">Timer not running — banner is null (hidden):</p>
        <RestTimerBanner timer={mockTimer} />
        <p className="text-xs text-gray-700">(nothing rendered above)</p>
      </div>
    )
  },
}

// ── End session modal ─────────────────────────────────────────────────────────

export const EndSession_Modal: StoryObj = {
  name: 'EndSessionModal / Default',
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(true)
      return (
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-command-blue text-white rounded-lg text-sm"
          >
            Open modal
          </button>
          <EndSessionModal
            open={open}
            onConfirm={(scores) => { console.log('Scores:', scores); setOpen(false) }}
            onCancel={() => setOpen(false)}
            loading={false}
            hasWork={true}
          />
        </div>
      )
    }
    return <MemoryRouter><Demo /></MemoryRouter>
  },
}
