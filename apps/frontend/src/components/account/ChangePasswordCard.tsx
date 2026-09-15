// ------------------------------------------------------------
// components/account/ChangePasswordCard.tsx
//
// Preferences → Account → Change password. Three fields, one submit. The
// server re-proves the current password and signs out every other device;
// the copy says so before the user commits, because "why did my phone log
// out?" is the support ticket this otherwise generates.
// ------------------------------------------------------------

import { useState }           from 'react'
import { ApiError }           from '@/lib/api'
import { useChangePassword }  from '@/lib/queries/account'
import { Input }              from '@/components/ui/Input'
import { Button }             from '@/components/ui/Button'
import { toast }              from '@/store/toastStore'

const MIN_LENGTH = 8

export function ChangePasswordCard(): React.JSX.Element {
  const [current, setCurrent] = useState('')
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const change = useChangePassword()

  const mismatch  = confirm.length > 0 && next !== confirm
  const tooShort  = next.length > 0 && next.length < MIN_LENGTH
  const canSubmit = current.length > 0 && next.length >= MIN_LENGTH && next === confirm && !change.isPending

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next })
      toast.success('Password changed — other devices were signed out')
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      // 400 carries the reason (wrong current password, reused password); anything
      // else is a generic failure the user can retry.
      setError(err instanceof ApiError && err.status === 400 ? err.message : 'Could not change password. Try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-gray-200 mb-1">Change password</p>
        <p className="text-xs text-gray-500">
          You stay signed in here. Every other device is signed out.
        </p>
      </div>

      <Input
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={tooShort ? `At least ${MIN_LENGTH} characters` : undefined}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? 'Passwords do not match' : undefined}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" disabled={!canSubmit} loading={change.isPending}>
        Update password
      </Button>
    </form>
  )
}
