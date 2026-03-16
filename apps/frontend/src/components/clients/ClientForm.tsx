// ------------------------------------------------------------
// components/clients/ClientForm.tsx
//
// Form used inside the ClientDrawer for both adding and editing.
// When editing, all fields are pre-populated from the client prop.
// ------------------------------------------------------------

import { useState, useEffect }  from 'react'
import { Input }                 from '@/components/ui/Input'
import { Select }                from '@/components/ui/Select'
import { TextArea }              from '@/components/ui/TextArea'
import { Button }                from '@/components/ui/Button'
import { cn }                    from '@/lib/cn'
import type { ClientResponse }   from '@trainer-app/shared'
import type { CreateClientInput } from '@/lib/queries/clients'

// ── Options ───────────────────────────────────────────────────────────────────

const FOCUS_OPTIONS = [
  { value: '',             label: 'Not set' },
  { value: 'resistance',   label: '🏋️  Resistance' },
  { value: 'cardio',       label: '🏃  Cardio' },
  { value: 'calisthenics', label: '💪  Calisthenics' },
  { value: 'mixed',        label: '⚡  Mixed' },
]

const PROGRESSION_OPTIONS = [
  { value: 'assessment',  label: 'Assessment — gathering baseline' },
  { value: 'programming', label: 'Programming — working a plan' },
  { value: 'maintenance', label: 'Maintenance — sustaining progress' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientFormProps {
  /** Existing client when editing. Null when adding. */
  client?:   ClientResponse | null
  loading:   boolean
  error?:    string | null
  onSubmit:  (data: CreateClientInput) => void
  onCancel:  () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientForm({
  client, loading, error, onSubmit, onCancel,
}: ClientFormProps): React.JSX.Element {
  const isEditing = client != null

  const [name,             setName]            = useState(client?.name             ?? '')
  const [email,            setEmail]           = useState(client?.email            ?? '')
  const [phone,            setPhone]           = useState(client?.phone            ?? '')
  const [primaryFocus,     setPrimaryFocus]    = useState(client?.primaryFocus     ?? '')
  const [secondaryFocus,   setSecondaryFocus]  = useState(client?.secondaryFocus   ?? '')
  const [progressionState, setProgressionState]= useState(client?.progressionState ?? 'assessment')
  const [startDate,        setStartDate]       = useState(client?.startDate        ?? '')
  const [notes,            setNotes]           = useState(client?.notes            ?? '')

  // Sync fields if client prop changes (drawer re-opened with different client)
  useEffect(() => {
    setName(client?.name             ?? '')
    setEmail(client?.email           ?? '')
    setPhone(client?.phone           ?? '')
    setPrimaryFocus(client?.primaryFocus     ?? '')
    setSecondaryFocus(client?.secondaryFocus ?? '')
    setProgressionState(client?.progressionState ?? 'assessment')
    setStartDate(client?.startDate   ?? '')
    setNotes(client?.notes           ?? '')
  }, [client?.id])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    onSubmit({
      name:             name.trim(),
      email:            email.trim() || undefined,
      phone:            phone.trim() || undefined,
      primaryFocus:     primaryFocus  || undefined,
      secondaryFocus:   secondaryFocus || undefined,
      progressionState: progressionState,
      startDate:        startDate || undefined,
      notes:            notes.trim() || undefined,
    })
  }

  // Secondary focus options exclude the primary (can't be the same)
  const secondaryOptions = FOCUS_OPTIONS.filter(
    (o) => o.value === '' || o.value !== primaryFocus,
  )

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">

      {/* Error */}
      {error != null && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Section: Identity */}
      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Identity</h3>
        <div className="space-y-3">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jordan Smith"
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            hint="Used for monthly progress reports"
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </section>

      {/* Section: Training */}
      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Training Focus</h3>
        <div className="space-y-3">
          <Select
            label="Primary focus"
            value={primaryFocus}
            onChange={(e) => setPrimaryFocus(e.target.value)}
            options={FOCUS_OPTIONS}
          />
          <Select
            label="Secondary focus"
            value={secondaryFocus}
            onChange={(e) => setSecondaryFocus(e.target.value)}
            options={secondaryOptions}
          />
          <Select
            label="Progression state"
            value={progressionState}
            onChange={(e) => setProgressionState(e.target.value as 'assessment' | 'programming' | 'maintenance')}
            options={PROGRESSION_OPTIONS}
            required
          />
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            hint="When they became your client"
          />
        </div>
      </section>

      {/* Section: Notes */}
      <section>
        <h3 className="text-[11px] uppercase tracking-widest text-gray-500 mb-3">Notes</h3>
        <TextArea
          label="Private trainer notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Training history, injuries, preferences…"
          rows={3}
        />
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
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
          type="submit"
          loading={loading}
          className="flex-1"
        >
          {isEditing ? 'Save Changes' : 'Add Client'}
        </Button>
      </div>

    </form>
  )
}
