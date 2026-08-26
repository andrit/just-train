// ------------------------------------------------------------
// components/session/AddBlockSheet.tsx
//
// Thin wrapper retained for compatibility.
// In the flat session model there are no workout blocks —
// exercise is added directly to the session via AddExerciseSheet.
// ------------------------------------------------------------

import { AddExerciseSheet } from './AddExerciseSheet'

interface AddBlockSheetProps {
  open:      boolean
  sessionId: string
  /** Optional: lets the sheet show what "use last time" will actually prefill. */
  clientId?: string
  onClose:   () => void
}

export function AddBlockSheet({
  open, sessionId, clientId, onClose,
}: AddBlockSheetProps): React.JSX.Element {
  return (
    <AddExerciseSheet
      open={open}
      sessionId={sessionId}
      workoutType="resistance"
      clientId={clientId}
      onClose={onClose}
    />
  )
}
