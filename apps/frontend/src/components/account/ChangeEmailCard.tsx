// ------------------------------------------------------------
// components/account/ChangeEmailCard.tsx
//
// Preferences → Account → Sign-in email. Shows the current address; a
// pending change (new address awaiting its confirmation link) sits above
// the form with a cancel. The current address keeps working until the
// link is redeemed, and the copy says so — nobody should fear locking
// themselves out with a typo.
// ------------------------------------------------------------

import { useState }                              from 'react'
import { ApiError }                              from '@/lib/api'
import { useChangeEmail, useCancelEmailChange }  from '@/lib/queries/account'
import { useAuthStore }                          from '@/store/authStore'
import { Input }                                 from '@/components/ui/Input'
import { Button }                                from '@/components/ui/Button'
import { toast }                                 from '@/store/toastStore'

export function ChangeEmailCard(): React.JSX.Element {
  const trainer  = useAuthStore((s) => s.trainer)
  const [next,     setNext]     = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const change = useChangeEmail()
  const cancel = useCancelEmailChange()

  const current   = trainer?.email ?? ''
  const pending   = trainer?.pendingEmail ?? null
  const canSubmit = next.trim().length > 0 && password.length > 0 && !change.isPending

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await change.mutateAsync({ newEmail: next.trim(), password })
      toast.success('Confirmation sent — check the new inbox')
      setNext(''); setPassword('')
    } catch (err) {
      // 400 / 409 / 503 carry a reason (wrong password, in use, mail failed).
      setError(err instanceof ApiError && [400, 409, 503].includes(err.status) ? err.message : 'Could not start the change. Try again.')
    }
  }

  const handleCancel = async (): Promise<void> => {
    try { await cancel.mutateAsync() } catch { toast.error('Could not cancel — try again') }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-200 mb-1">Sign-in email</p>
        <p className="text-xs text-gray-500">
          Currently <span className="text-gray-300">{current}</span>. A new address takes over only after you confirm it from its inbox — until then this one keeps working.
        </p>
      </div>

      {pending && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-3">
          <span>Waiting for confirmation from <span className="font-medium">{pending}</span></span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancel.isPending}
            className="shrink-0 underline underline-offset-2 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}

      <Input
        label="New email"
        type="email"
        autoComplete="email"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" disabled={!canSubmit} loading={change.isPending}>
        {pending ? 'Send a new confirmation' : 'Change email'}
      </Button>
    </form>
  )
}
