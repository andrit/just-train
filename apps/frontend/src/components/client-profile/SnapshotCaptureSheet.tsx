// ------------------------------------------------------------
// components/client-profile/SnapshotCaptureSheet.tsx
//
// Capture a point-in-time measurement Snapshot. Covers the subset of
// fields the Baseline tab surfaces (body comp, the five 1–10 subjective
// scores, push-ups, mile time) + notes — the full ~30-field schema is
// deliberately not exposed for v1 athlete self-capture.
//
// Every field is optional and starts UNSET. Numbers omit when blank;
// mile time omits at 0:00; the subjective scores start null and are
// omitted unless the user moves the slider — a score control reading "5"
// that saved nothing would invent data the athlete never gave (the same
// trap the end-session flow fixed). Only set fields are sent.
// ------------------------------------------------------------

import { useEffect, useState }        from 'react'
import type { CreateClientSnapshotInput } from '@trainer-app/shared'
import { cn }                         from '@/lib/cn'
import { interactions }               from '@/lib/interactions'
import { BottomSheet }                from '@/components/ui/BottomSheet'
import { ScoreSlider }                from '@/components/ui/ScoreSlider'
import { MinSecField }                from '@/components/ui/MinSecField'
import { Spinner }                    from '@/components/ui/Spinner'
import { useCreateSnapshot }          from '@/lib/queries/clients'

interface SnapshotCaptureSheetProps {
  clientId: string
  open:     boolean
  onClose:  () => void
  /** First-ever snapshot — tweaks the heading copy. */
  isFirst?: boolean
}

// Parse a numeric text field; empty / invalid → undefined (omit the field).
function num(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function SnapshotCaptureSheet({
  clientId,
  open,
  onClose,
  isFirst = false,
}: SnapshotCaptureSheetProps): React.JSX.Element {
  const createSnapshot = useCreateSnapshot()

  // Number fields as strings so they can be cleared (empty = not recorded).
  const [weight,     setWeight]     = useState('')
  const [bodyFat,    setBodyFat]    = useState('')
  const [restingHr,  setRestingHr]  = useState('')
  const [pushUps,    setPushUps]    = useState('')
  const [mileSecs,   setMileSecs]   = useState(0)

  // Subjective scores: null until the user moves the slider.
  const [energy,     setEnergy]     = useState<number | null>(null)
  const [sleep,      setSleep]      = useState<number | null>(null)
  const [stress,     setStress]     = useState<number | null>(null)
  const [mobility,   setMobility]   = useState<number | null>(null)
  const [selfImage,  setSelfImage]  = useState<number | null>(null)

  const [notes,      setNotes]      = useState('')

  // Reset to a clean form each time the sheet opens.
  useEffect(() => {
    if (!open) return
    setWeight(''); setBodyFat(''); setRestingHr(''); setPushUps(''); setMileSecs(0)
    setEnergy(null); setSleep(null); setStress(null); setMobility(null); setSelfImage(null)
    setNotes('')
    createSnapshot.reset()
    // createSnapshot is a stable mutation object; depending on `open` alone is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const weightN    = num(weight)
  const bodyFatN   = num(bodyFat)
  const restingHrN = num(restingHr)
  const pushUpsN   = num(pushUps)

  const body: CreateClientSnapshotInput = {
    ...(weightN    !== undefined && { weightLbs:           weightN }),
    ...(bodyFatN   !== undefined && { bodyFatPct:          bodyFatN }),
    ...(restingHrN !== undefined && { restingHeartRateBpm: Math.round(restingHrN) }),
    ...(pushUpsN   !== undefined && { maxPushUps:          Math.round(pushUpsN) }),
    ...(mileSecs > 0   && { mileTimeSecs: mileSecs }),
    ...(energy    !== null && { energyLevel:    energy }),
    ...(sleep     !== null && { sleepQuality:   sleep }),
    ...(stress    !== null && { stressLevel:    stress }),
    ...(mobility  !== null && { mobilityFeel:   mobility }),
    ...(selfImage !== null && { selfImageScore: selfImage }),
    ...(notes.trim() !== '' && { clientNotes: notes.trim() }),
  }

  const hasAnything = Object.keys(body).length > 0

  const handleSave = (): void => {
    if (!hasAnything) return
    createSnapshot.mutate(
      { clientId, ...body },
      { onSuccess: () => onClose() },
    )
  }

  const loading = createSnapshot.isPending

  return (
    <BottomSheet open={open} onClose={onClose} title="Take a Snapshot" maxHeight="88vh">
      <div className="space-y-6 pb-2">
        <p className="text-xs text-ink-subtle -mt-1">
          {isFirst
            ? 'Capture your starting baseline. Fill in whatever you have — everything is optional.'
            : 'Record where you are now. Fill in whatever you have — everything is optional.'}
        </p>

        {/* Body composition */}
        <section className="space-y-3">
          <p className="section-label">Body</p>
          <NumberRow label="Weight"     unit="lbs" value={weight}    onChange={setWeight}    placeholder="—" />
          <NumberRow label="Body fat"   unit="%"   value={bodyFat}   onChange={setBodyFat}   placeholder="—" />
          <NumberRow label="Resting HR" unit="bpm" value={restingHr} onChange={setRestingHr} placeholder="—" />
        </section>

        {/* Performance */}
        <section className="space-y-3">
          <p className="section-label">Performance</p>
          <NumberRow label="Max push-ups" unit="reps" value={pushUps} onChange={setPushUps} placeholder="—" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">Mile time</span>
            <MinSecField seconds={mileSecs} onChange={setMileSecs} />
          </div>
        </section>

        {/* Subjective — omitted unless the slider is moved */}
        <section className="space-y-5">
          <div>
            <p className="section-label">How you feel</p>
            <p className="text-[11px] text-ink-faint mt-0.5">
              Move a slider to record it — untouched ones aren&apos;t saved.
            </p>
          </div>
          <ScoreSlider label="Energy"     value={energy    ?? 5} onChange={setEnergy}    dimmed={energy    === null} lowLabel="Exhausted" highLabel="Full energy" />
          <ScoreSlider label="Sleep"      value={sleep     ?? 5} onChange={setSleep}     dimmed={sleep     === null} lowLabel="Terrible"  highLabel="Excellent" />
          <ScoreSlider label="Stress"     value={stress    ?? 5} onChange={setStress}    dimmed={stress    === null} lowLabel="Calm"      highLabel="Very stressed" />
          <ScoreSlider label="Mobility"   value={mobility  ?? 5} onChange={setMobility}  dimmed={mobility  === null} lowLabel="Very stiff" highLabel="Full range" />
          <ScoreSlider label="Self-image" value={selfImage ?? 5} onChange={setSelfImage} dimmed={selfImage === null} lowLabel="Negative"  highLabel="Positive" />
        </section>

        {/* Notes */}
        <div>
          <label className="block text-xs text-ink-subtle mb-1.5">
            Notes <span className="text-ink-faint">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth noting…"
            rows={2}
            className="w-full field resize-none text-sm"
          />
        </div>

        {createSnapshot.isError && (
          <p className="text-sm text-red-400">
            Could not save the snapshot. Check your connection and try again.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={loading || !hasAnything}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-white bg-command-blue',
            interactions.button.base,
            interactions.button.press,
            (loading || !hasAnything) && 'opacity-50',
          )}
        >
          {loading ? <Spinner size="sm" /> : hasAnything ? 'Save snapshot' : 'Enter a measurement'}
        </button>
      </div>
    </BottomSheet>
  )
}

// ── Number row ──────────────────────────────────────────────────────────────

function NumberRow({ label, unit, value, onChange, placeholder }: {
  label:       string
  unit:        string
  value:       string
  onChange:    (v: string) => void
  placeholder: string
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field w-24 text-right text-sm"
        />
        <span className="text-xs text-ink-faint w-8">{unit}</span>
      </div>
    </div>
  )
}
