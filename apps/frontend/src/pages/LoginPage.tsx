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

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQueryClient }    from '@tanstack/react-query'
import { apiClient, ApiError } from '@/lib/api'
import { useAuthStore }      from '@/store/authStore'
import { Input }             from '@/components/ui/Input'
import { Button }            from '@/components/ui/Button'
import { cn }                from '@/lib/cn'
import type { AuthResponse } from '@trainer-app/shared'
import { toast } from '@/store/toastStore'

type Mode = 'login' | 'register'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export default function LoginPage(): React.JSX.Element {
  const [mode, setMode]       = useState<Mode>('login')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [nameError, setNameError]         = useState<string | null>(null)
  const [emailError, setEmailError]       = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [serverError, setServerError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Lockout (423 / 429 with retryAfterSeconds): hold the button and count down
  // rather than let the user keep hitting a wall.
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  useEffect(() => {
    if (lockedUntil === null) return
    const id = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [lockedUntil])
  const lockSecondsLeft = lockedUntil === null ? 0 : Math.max(0, Math.ceil((lockedUntil - nowTs) / 1000))
  const isLocked = lockSecondsLeft > 0

  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()
  const qc          = useQueryClient()

  const clearFieldErrors = (): void => {
    setNameError(null)
    setEmailError(null)
    setPasswordError(null)
    setServerError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (isLocked) return
    clearFieldErrors()

    // Auth always requires network (offline-contract.md)
    if (!navigator.onLine) {
      setServerError("You're offline — please connect to log in")
      return
    }

    // Explicit validation — browser 'required' attr unreliable on installed PWAs
    let hasError = false
    if (mode === 'register' && !name.trim()) { setNameError('Name is required'); hasError = true }
    if (!email.trim()) { setEmailError('Email is required'); hasError = true }
    if (!password || password.length < 8) { setPasswordError('Password must be at least 8 characters'); hasError = true }
    if (hasError) return

    setLoading(true)

    try {
      let data: AuthResponse

      if (mode === 'login') {
        data = await apiClient.post<AuthResponse>('/auth/login', { email, password })
      } else {
        data = await apiClient.post<AuthResponse>('/auth/register', { name, email, password })
      }

      // Clear stale cache from any previous session before setting new auth
      qc.clear()
      setAuth(data.accessToken, data.trainer)
      if (data.restored) toast.success('Welcome back — your account has been restored')
      navigate('/', { replace: true })
    } catch (err: unknown) {
      let msg = 'Something went wrong — please try again'
      if (err instanceof Error && err.message) {
        msg = err.message
      }
      // ApiError carries the HTTP status — surface it if the message is generic
      if ('status' in (err as Record<string, unknown>) && msg === 'Unauthorized') {
        msg = 'Invalid email or password'
      }
      if (err instanceof ApiError && (err.status === 423 || err.status === 429)) {
        const retry = typeof err.body?.retryAfterSeconds === 'number' ? err.body.retryAfterSeconds : 60
        setLockedUntil(Date.now() + retry * 1000)
        msg = err.status === 423
          ? 'Too many failed attempts — sign-in for this email is paused.'
          : 'Too many attempts from this network — sign-in is paused.'
      }
      setServerError(msg)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode): void => {
    setMode(next)
    clearFieldErrors()
  }

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl tracking-wider uppercase">
            <span className="text-white">Trainer</span>
            <span className="text-command-blue">App</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl bg-iron-grey/20 border border-iron-grey/30 p-1 mb-6">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize',
                mode === m
                  ? 'bg-command-blue text-white shadow-sm'
                  : 'text-command-blue hover:text-command-blue/80',
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
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null) }}
              placeholder="Your name"
              autoComplete="name"
              error={nameError ?? undefined}
              required
            />
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null) }}
            placeholder="you@example.com"
            autoComplete="email"
            error={emailError ?? undefined}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => { setPass(e.target.value); if (passwordError) setPasswordError(null) }}
            placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            error={passwordError ?? undefined}
            minLength={8}
            required
          />

          {/* Server error */}
          {serverError != null && serverError.length > 0 && (
            <div
              role="alert"
              className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
            >
              {serverError}
              {isLocked && (
                <span className="block mt-1 text-xs text-red-300/80">
                  Try again in {formatCountdown(lockSecondsLeft)}. Already-signed-in devices are not affected.
                </span>
              )}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            disabled={isLocked}
            className="w-full mt-2"
            size="lg"
          >
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>

          {mode === 'login' && (
            <p className="text-xs text-center mt-3">
              <Link to="/forgot-password" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Forgot your password?</Link>
            </p>
          )}

          {mode === 'register' && (
            <p className="text-xs text-gray-600 text-center mt-3">
              By creating an account you agree to our{' '}
              <Link to="/terms" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-gray-400 hover:text-gray-200 underline underline-offset-2">Privacy Policy</Link>.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
