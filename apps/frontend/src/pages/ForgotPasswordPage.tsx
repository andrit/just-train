// pages/ForgotPasswordPage.tsx — request a reset link (account plan B6). Public.
// The server answers the same way whether or not the email exists, and so
// does this page: the confirmation copy never confirms an account.

import { useState }          from 'react'
import { Link }              from 'react-router-dom'
import { useForgotPassword } from '@/lib/queries/account'
import { Input }             from '@/components/ui/Input'
import { Button }            from '@/components/ui/Button'

export default function ForgotPasswordPage(): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [sent,  setSent]  = useState(false)
  const forgot = useForgotPassword()

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!email.trim()) return
    try { await forgot.mutateAsync({ email: email.trim() }) } catch { /* same outcome either way */ }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl uppercase tracking-widest text-white">Reset password</h1>
          <p className="text-gray-500 mt-2 text-sm">
            {sent ? 'Check your inbox' : "Enter your email and we'll send a link"}
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-gray-300">
              If an account exists for <span className="text-white">{email.trim()}</span>, a reset link is on its way.
              It works for one hour.
            </p>
            <p className="text-xs text-gray-500">Nothing arrived? Check spam, or try again in a minute.</p>
            <Link to="/login" className="inline-block text-sm text-gray-400 hover:text-gray-200 underline underline-offset-2">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" size="lg" className="w-full" loading={forgot.isPending} disabled={!email.trim()}>
              Send reset link
            </Button>
            <p className="text-xs text-center">
              <Link to="/login" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
