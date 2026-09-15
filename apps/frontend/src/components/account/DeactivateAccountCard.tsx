// ------------------------------------------------------------
// components/account/DeactivateAccountCard.tsx
//
// Preferences → Danger zone. Soft delete: the account is hidden and every
// device signed out; signing in within 30 days restores it; after that the
// data and media are purged. Two deliberate frictions — type the word and
// re-enter the password — because this is the one action that loses data.
// ------------------------------------------------------------

import { useState }              from 'react'
import { ApiError }              from '@/lib/api'
import { useDeactivateAccount }  from '@/lib/queries/account'
import { useSignOut }            from '@/hooks/useSignOut'
import { Input }                 from '@/components/ui/Input'
import { Button }                from '@/components/ui/Button'
import { toast }                 from '@/store/toastStore'

const CONFIRM_WORD = 'DEACTIVATE'

export function DeactivateAccountCard(): React.JSX.Element {
  const [open,     setOpen]     = useState(false)
  const [word,     setWord]     = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const deactivate = useDeactivateAccount()
  const signOut    = useSignOut()

  const canSubmit = word === CONFIRM_WORD && password.length > 0 && !deactivate.isPending

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await deactivate.mutateAsync({ password })
      toast.info('Account deactivated. Sign in within 30 days to restore it.')
      await signOut({ localOnly: true })   // the server already ended every session
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? err.message : 'Could not deactivate. Try again.')
    }
  }

  return (
    <div className="card p-4 space-y-3 border-red-500/30">
      <div>
        <p className="text-sm font-medium text-gray-200 mb-1">Deactivate account</p>
        <p className="text-xs text-gray-500">
          Your account is hidden and every device is signed out. Sign in again within 30 days to
          restore it. After 30 days your training data and photos are permanently deleted.
        </p>
      </div>

      {!open ? (
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>Deactivate my account…</Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={word}
            onChange={(e) => setWord(e.target.value.toUpperCase())}
            autoComplete="off"
          />
          <Input
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => { setOpen(false); setWord(''); setPassword(''); setError(null) }}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" size="sm" disabled={!canSubmit} loading={deactivate.isPending}>
              Deactivate
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
