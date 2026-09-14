// ------------------------------------------------------------
// components/session/SaveAsTemplateButton.tsx
//
// "Save as template" for any session that has exercises — a planned session
// in the plan builder, or a completed one in the review panel / history page
// ("that was a good workout, keep it"). Owns the name prompt and the mutation
// so the three surfaces cannot drift: one component, one request
// (POST /templates/from-session), which deep-copies the plan server-side.
//
// Renders nothing for a session with no exercises: the server refuses those,
// and an empty template is the silent failure this replaces.
// ------------------------------------------------------------

import { useState }                       from 'react'
import { cn }                             from '@/lib/cn'
import { interactions }                   from '@/lib/interactions'
import { Spinner }                        from '@/components/ui/Spinner'
import { NamePromptModal }                from '@/components/ui/NamePromptModal'
import { useCreateTemplateFromSession }   from '@/lib/queries/templates'
import { toast }                          from '@/store/toastStore'

interface SaveAsTemplateButtonProps {
  session: {
    id:                string
    name?:             string | null
    sessionExercises?: readonly unknown[]
  }
  className?: string
}

export function SaveAsTemplateButton({ session, className }: SaveAsTemplateButtonProps): React.JSX.Element | null {
  const [promptOpen, setPromptOpen] = useState(false)
  const createFromSession = useCreateTemplateFromSession()

  if (!(session.sessionExercises ?? []).length) return null

  const handleConfirm = async (name: string): Promise<void> => {
    setPromptOpen(false)
    try {
      await createFromSession.mutateAsync({ sessionId: session.id, name })
      toast.success('Template saved!')
    } catch {
      toast.error('Failed to save template')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPromptOpen(true)}
        disabled={createFromSession.isPending}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium',
          'border border-surface-border text-gray-400',
          'hover:border-command-blue/40 hover:text-command-blue',
          interactions.button.base,
          interactions.button.press,
          className,
        )}
      >
        {createFromSession.isPending ? <Spinner size="sm" /> : (
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
            <path d="M3 3h7l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 3v4h6V3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        Save as template
      </button>

      <NamePromptModal
        open={promptOpen}
        title="Name this template"
        placeholder="e.g. Push Day A, Full Body Strength…"
        initialValue={session.name ?? ''}
        confirmLabel="Save template"
        saving={createFromSession.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setPromptOpen(false)}
      />
    </>
  )
}
