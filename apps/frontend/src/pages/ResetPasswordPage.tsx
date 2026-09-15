// pages/ResetPasswordPage.tsx — redeem the emailed token (account plan B6). Public.
// On success every device was signed out server-side, so the only next step
// is the sign-in page.

import { useState }                      from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError }                      from '@/lib/api'
import { useResetPassword }              from '@/lib/queries/account'
import { Input }                         from '@/components/ui/Input'
import { Button }                        from '@/components/ui/Button'
import { toast }                         from '@/store/toastStore'

const MIN_LENGTH = 8

export default function ResetPasswordPage(): React.JSX.Element {
  const [params]  = useSearchParams()
  const navigate  = useNavigate()
  const token     = params.get('token') ?? ''
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const reset = useResetPassword()

  const mismatch  = confirm.length > 0 && next !== confirm
  const tooShort  = next.length > 0 && next.length < MIN_LENGTH
  const canSubmit = token.length > 0 && next.length >= MIN_LENGTH && next === confirm && !reset.isPending

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await reset.mutateAsync({ token, newPassword: next })
      toast.success('Password updated — sign in with your new password')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? err.message : 'Could not reset the password. Try again.')
    }
  }

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl uppercase tracking-widest text-white">Choose a new password</h1>
          <p className="text-gray-500 mt-2 text-sm">Every device will be signed out.</p>
        </div>

        {!token ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-red-400">This link is missing its token.</p>
            <Link to="/forgot-password" className="inline-block text-sm text-gray-400 hover:text-gray-200 underline underline-offset-2">Request a new link</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
            {error && (
              <p className="text-sm text-red-400">
                {error}{' '}
                <Link to="/forgot-password" className="underline underline-offset-2">Get a new link →</Link>
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={reset.isPending}>
              Set new password
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
