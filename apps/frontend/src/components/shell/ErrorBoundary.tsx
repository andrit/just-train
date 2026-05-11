// ------------------------------------------------------------
// components/shell/ErrorBoundary.tsx
//
// React class-based error boundary — hooks cannot catch render errors.
//
// Two variants exported:
//   ErrorBoundary        — generic, full-page fallback
//   SessionErrorBoundary — wraps LiveSessionContent; keeps the session
//                          pill alive and offers a "Re-open session" path
// ------------------------------------------------------------

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

// ── Generic error boundary ────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error:    Error | null
}

interface ErrorBoundaryProps {
  children:  ReactNode
  fallback?: ReactNode
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console in dev; wire to a logging service in production
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-primary px-6 text-center">
        <p className="text-4xl mb-4" aria-hidden>⚠️</p>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-400 mb-6 max-w-xs">
          An unexpected error occurred. Your data is safe — refresh the page to continue.
        </p>
        {import.meta.env.DEV && this.state.error && (
          <pre className="text-left text-xs text-red-400 bg-surface rounded-lg p-4 max-w-sm overflow-auto mb-6">
            {this.state.error.message}
          </pre>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-surface border border-surface-border text-gray-300 hover:text-white transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/' }}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-command-blue text-white hover:bg-command-blue/90 transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    )
  }
}

// ── Session-specific error boundary ──────────────────────────────────────────
// Wraps LiveSessionContent. If the session UI crashes, the overlay minimises
// to a pill rather than taking down the whole app. The trainer can attempt to
// re-open the session from the pill.

interface SessionErrorBoundaryProps {
  children:  ReactNode
  onMinimise?: () => void
}

export class SessionErrorBoundary extends Component<SessionErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: SessionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SessionErrorBoundary]', error, info.componentStack)
    // Minimise the overlay so the pill stays visible and the rest of the
    // app remains usable while the session is in the error state
    this.props.onMinimise?.()
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center">
        <p className="text-3xl mb-3" aria-hidden>⚡</p>
        <h2 className="font-display text-xl uppercase tracking-wide text-white mb-2">
          Session error
        </h2>
        <p className="text-sm text-gray-400 mb-5 max-w-xs">
          The session UI crashed. Your logged sets are safe on the server.
          Try re-opening the session.
        </p>
        {import.meta.env.DEV && this.state.error && (
          <pre className="text-left text-xs text-red-400 bg-surface rounded-lg p-4 max-w-sm overflow-auto mb-5">
            {this.state.error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={this.handleReset}
          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-command-blue text-white hover:bg-command-blue/90 transition-colors"
        >
          Re-open session
        </button>
      </div>
    )
  }
}
