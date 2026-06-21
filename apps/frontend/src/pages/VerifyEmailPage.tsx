// ------------------------------------------------------------
// pages/VerifyEmailPage.tsx — Email verification landing page (Phase 10.5)
//
// PUBLIC route — user may not be logged in when they click the link.
// Reads ?token from the query string, calls GET /auth/verify-email,
// and shows one of three states: loading, success, or error.
// ------------------------------------------------------------

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

type State = 'loading' | 'success' | 'error'

export default function VerifyEmailPage(): React.JSX.Element {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const [state, setState]   = useState<State>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setMessage('Invalid verification link.')
      setState('error')
      return
    }

    const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

    fetch(`${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.ok) {
          setState('success')
        } else {
          setMessage(data.error ?? 'Verification failed.')
          setState('error')
        }
      })
      .catch(() => {
        setMessage('Could not reach the server. Please try again.')
        setState('error')
      })
  }, [searchParams])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {/* Logo / wordmark */}
        <p className="font-display text-2xl uppercase tracking-widest text-white mb-10">
          TrainerApp
        </p>

        {state === 'loading' && (
          <div>
            <div className="w-8 h-8 border-2 border-command-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Verifying your email…</p>
          </div>
        )}

        {state === 'success' && (
          <div>
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-display text-xl uppercase tracking-widest text-white mb-2">
              Email verified
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              Your email address has been confirmed.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-lg bg-command-blue text-white font-display text-sm uppercase tracking-widest hover:bg-command-blue/90 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {state === 'error' && (
          <div>
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="font-display text-xl uppercase tracking-widest text-white mb-2">
              Link invalid
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              {message || 'This verification link is expired or has already been used.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-3 rounded-lg border border-surface-border text-gray-300 font-display text-sm uppercase tracking-widest hover:border-gray-500 transition-colors"
            >
              Back to Login
            </button>
            <p className="text-gray-600 text-xs mt-4">
              Log in, then request a new link from your dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
