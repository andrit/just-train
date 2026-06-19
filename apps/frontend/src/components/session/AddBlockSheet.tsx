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
  onClose:   () => void
}

export function AddBlockSheet({
  open, sessionId, onClose,
}: AddBlockSheetProps): React.JSX.Element {
  return (
    <AddExerciseSheet
      open={open}
      sessionId={sessionId}
      workoutType="resistance"
      onClose={onClose}
    />
  )
}
