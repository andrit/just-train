// ------------------------------------------------------------
// components/session/EndSessionModal.tsx (v1.5.0)
//
// Shown when trainer taps "End Session".
// Three sliders (1–10): Energy, Mobility, Stress.
// Optional session note.
// Target: < 15 seconds to complete (3 taps + confirm).
// ------------------------------------------------------------

import { useState }     from 'react'
import { Modal }        from '@/components/ui/Modal'
import { Button }       from '@/components/ui/Button'

interface SliderRowProps {
  label:    string
  hint:     string
  value:    number
  onChange: (v: number) => void
  lowLabel: string
  highLabel: string
}

function SliderRow({ label, hint, value, onChange, lowLabel, highLabel }: SliderRowProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">{label}</p>
          <p className="text-xs text-gray-600">{hint}</p>
        </div>
        <span className="font-mono text-2xl font-bold text-white w-8 text-right">
          {value}
        </span>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer
          bg-surface-border
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-command-blue
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-md"
        aria-label={`${label}: ${value} out of 10`}
      />

      <div className="flex justify-between text-[10px] text-gray-700 uppercase tracking-wider">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

interface EndSessionModalProps {
  open:      boolean
  onConfirm: (scores: { energyLevel: number; mobilityFeel: number; stressLevel: number; sessionNotes?: string }) => void
  onCancel:  () => void
  onDiscard?: () => void  // offered when session has no logged sets
  loading:   boolean
  hasWork:   boolean      // true if at least one set was logged
}

export function EndSessionModal({ open, onConfirm, onCancel, onDiscard, loading, hasWork }: EndSessionModalProps): React.JSX.Element {
  const [energy,   setEnergy]   = useState(7)
  const [mobility, setMobility] = useState(7)
  const [stress,   setStress]   = useState(5)
  const [notes,    setNotes]    = useState('')

  const handleConfirm = (): void => {
    onConfirm({
      energyLevel:  energy,
      mobilityFeel: mobility,
      stressLevel:  stress,
      sessionNotes: notes.trim() || undefined,
    })
  }

  // Empty session — offer discard or end anyway
  if (!hasWork) {
    return (
      <Modal open={open} onClose={onCancel} title="No work logged">
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-400">
            No sets were logged in this session. You can discard it (no record kept) or end it anyway.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={onDiscard}
              disabled={loading || !onDiscard}
              className="flex-1"
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleConfirm}
              loading={loading}
              className="flex-1"
            >
              End Anyway
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onCancel} title="How was that?">
      <div className="space-y-6 py-2">

        <p className="text-xs text-gray-500">
          Quick check-in — takes about 10 seconds. Tracked over time, these tell the whole story.
        </p>

        <SliderRow
          label="Energy"
          hint="How energised did you feel?"
          value={energy}
          onChange={setEnergy}
          lowLabel="Exhausted"
          highLabel="Full energy"
        />

        <SliderRow
          label="Mobility"
          hint="How did your body feel moving?"
          value={mobility}
          onChange={setMobility}
          lowLabel="Very stiff"
          highLabel="Full range"
        />

        <SliderRow
          label="Stress"
          hint="General stress level today"
          value={stress}
          onChange={setStress}
          lowLabel="Calm"
          highLabel="Very stressed"
        />

        {/* Optional note */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            Session note <span className="text-gray-700">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth noting…"
            rows={2}
            className="w-full field resize-none text-sm"
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={loading}
            onClick={handleConfirm}
            className="flex-1"
          >
            End Session
          </Button>
        </div>
      </div>
    </Modal>
  )
}
