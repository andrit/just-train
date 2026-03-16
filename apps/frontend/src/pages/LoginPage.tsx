// ------------------------------------------------------------
// pages/LoginPage.tsx — Login and register form (Phase 2)
// Updated Phase 3.5: uses shared Input and Button components,
// dark theme consistent with the rest of the app.
//
// DESIGN NOTES:
//   - No localStorage for the token — authStore keeps it in memory
//   - The httpOnly refresh token cookie is handled by the browser
//   - Error messages are intentionally vague (no email enumeration)
// ------------------------------------------------------------

import { useState }          from 'react'
import { useNavigate }       from 'react-router-dom'
import { apiClient }         from '@/lib/api'
import { useAuthStore }      from '@/store/authStore'
import { Input }             from '@/components/ui/Input'
import { Button }            from '@/components/ui/Button'
import { cn }                from '@/lib/cn'
import type { AuthResponse } from '@trainer-app/shared'

type Mode = 'login' | 'register'

export default function LoginPage(): React.JSX.Element {
  const [mode, setMode]     = useState<Mode>('login')
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let data: AuthResponse

      if (mode === 'login') {
        data = await apiClient.post<AuthResponse>('/auth/login', { email, password })
      } else {
        data = await apiClient.post<AuthResponse>('/auth/register', { name, email, password })
      }

      setAuth(data.accessToken, data.trainer)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode): void => {
    setMode(next)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider uppercase">
            <span className="text-white">Trainer</span>
            <span className="text-brand-highlight">App</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl bg-brand-accent/50 border border-surface-border p-1 mb-6">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize',
                mode === m
                  ? 'bg-brand-highlight text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <Input
              label="Full Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPass(e.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />

          {/* Server error */}
          {error != null && (
            <div
              role="alert"
              className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-2"
            size="lg"
          >
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </div>
    </div>
  )
}
