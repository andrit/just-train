// ------------------------------------------------------------
// pages/DashboardPage.tsx — Home / launch surface
//
// Home is the starting point, not a dashboard: greeting + the TRAIN card.
// All feedback (KPI stats, challenges, snapshots) lives in My Training,
// one tap away on the nav bar — this keeps Home out of the way of the
// "just train" path.
//
// TRAIN card has three states driven by session store + planned sessions API:
//   1. "Train"           — no active or planned session (opens the launcher)
//   2. "Begin: [name]"   — a planned session exists (API: status=planned)
//   3. "Resume: [name]"  — an in-progress session is live (sessionStore)
// ------------------------------------------------------------

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate }                  from 'react-router-dom'
import { useSelfClient, useMuscleFrequency } from '@/lib/queries/clients'
import { usePlannedSessions }           from '@/lib/queries/sessions'
import { useMode }                      from '@/lib/mode'
import { BodyHeatMap }                  from '@/components/charts/BodyHeatMap'
import { BodyBreakdownSheet }           from '@/components/charts/BodyBreakdownSheet'
import type { BodyRegion }              from '@/components/charts/muscleMapData'
import { useAuthStore }                 from '@/store/authStore'
import { useSessionStore }              from '@/store/sessionStore'
import { useUXEvent }                   from '@/hooks/useUXEvent'
import { useNav }                       from '@/services/navService'
import { apiClient }                    from '@/lib/api'

// ── Email verification banner ─────────────────────────────────────────────────

function EmailVerificationBanner(): React.JSX.Element | null {
  const trainer                   = useAuthStore((s) => s.trainer)
  const [dismissed, setDismissed] = useState(false)
  const [sent, setSent]           = useState(false)
  const [cooldown, setCooldown]   = useState(0)
  const [sending, setSending]     = useState(false)

  const startCooldown = useCallback(() => {
    setCooldown(60)
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0 }
        return c - 1
      })
    }, 1000)
  }, [])

  async function handleSend() {
    if (sending || cooldown > 0) return
    setSending(true)
    try {
      await apiClient('/auth/send-verification', { method: 'POST' })
      setSent(true)
      startCooldown()
    } catch {
      // silent — banner remains, user can retry
    } finally {
      setSending(false)
    }
  }

  if (!trainer || trainer.emailVerified || dismissed) return null

  return (
    <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3 animate-slide-up">
      <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 text-xs font-medium">
          {sent ? 'Verification email sent — check your inbox.' : 'Please verify your email address.'}
        </p>
        {!sent && (
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || cooldown > 0}
            className="mt-1 text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300 disabled:opacity-50 disabled:no-underline"
          >
            {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send verification email'}
          </button>
        )}
        {sent && cooldown > 0 && (
          <p className="mt-1 text-xs text-amber-600">Resend available in {cooldown}s</p>
        )}
        {sent && cooldown === 0 && (
          <button
            type="button"
            onClick={handleSend}
            className="mt-1 text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            Resend
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-ink-faint hover:text-ink-muted shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── TRAIN card — three states ─────────────────────────────────────────────────

interface TrainCardProps {
  selfClientId: string | undefined
  onStart:      () => void
}

function TrainCard({ selfClientId, onStart }: TrainCardProps): React.JSX.Element {
  const navigate = useNavigate()
  const hasSession = useSessionStore((s) => s.hasSession)
  const getSession = useSessionStore((s) => s.getSession)
  const { openSessionLauncher } = useNav()

  const { data: plannedData } = usePlannedSessions(selfClientId)
  const firstPlanned = plannedData?.[0] ?? null

  const activeSession = selfClientId ? getSession(selfClientId) : null
  const isActive      = selfClientId ? hasSession(selfClientId) : false

  if (isActive && activeSession) {
    return (
      <div className="rounded-lg border border-signal-yellow/30 bg-signal-yellow/10 px-4 py-4">
        <p className="font-display text-xs uppercase tracking-widest text-signal-yellow mb-1">Live session</p>
        <p className="text-ink text-sm font-medium mb-3 truncate">
          Resume: {activeSession.clientName}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/session/${activeSession.sessionId}`)}
            className="flex-1 rounded-md bg-signal-yellow text-on-signal text-sm font-semibold py-2 hover:bg-signal-yellow/90 transition-colors"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={() => {/* end session will be wired in live session UI */}}
            className="rounded-md border border-signal-yellow/30 text-signal-yellow text-sm px-3 py-2 hover:bg-signal-yellow/10 transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  if (firstPlanned) {
    const label = firstPlanned.name ?? 'Planned session'
    return (
      <div className="rounded-lg border border-command-blue/30 bg-command-blue/10 px-4 py-4">
        <p className="font-display text-xs uppercase tracking-widest text-command-blue mb-1">Planned</p>
        <p className="text-ink text-sm font-medium mb-3 truncate">
          Begin: {label}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openSessionLauncher(selfClientId)}
            className="flex-1 rounded-md bg-command-blue text-white text-sm font-semibold py-2 hover:bg-command-blue/90 shadow-pressable transition-colors"
          >
            Start
          </button>
          <button
            type="button"
            onClick={onStart}
            className="rounded-md border border-surface-border text-ink-muted text-sm px-3 py-2 hover:bg-surface-raised transition-colors"
            aria-label="Start blank instead"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => openSessionLauncher(selfClientId)}
      className={[
        'w-full rounded-lg border border-command-blue/30 bg-command-blue/10 px-4 py-5',
        'hover:bg-command-blue/15 active:scale-[0.98] transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      ].join(' ')}
    >
      <span className="block font-display text-base uppercase tracking-widest text-command-blue">
        Train
      </span>
      <span className="block text-xs text-ink-subtle mt-0.5">
        Start a session — type inferred from exercises
      </span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const trainer = useAuthStore((s) => s.trainer)
  const { fire } = useUXEvent()
  const mode     = useMode()
  const { openSessionLauncher } = useNav()

  useEffect(() => { fire('page_enter') }, [fire])

  const { data: selfClient } = useSelfClient()
  const { data: muscleFreq }            = useMuscleFrequency(selfClient?.id ?? null)
  const [bodyOpen, setBodyOpen]         = useState(false)
  const [bodyRegion, setBodyRegion]     = useState<BodyRegion | null>(null)

  // Whole-figure tap → full map; a region tap → the sheet scoped to that region.
  const openBody = (region: BodyRegion | null): void => { setBodyRegion(region); setBodyOpen(true) }

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    const name = trainer?.name?.split(' ')[0] ?? ''
    if (hour < 12) return `Good morning${name ? `, ${name}` : ''}`
    if (hour < 17) return `Good afternoon${name ? `, ${name}` : ''}`
    return `Good evening${name ? `, ${name}` : ''}`
  }, [trainer?.name])

  // No full-page spinner while data loads: Home renders its shell immediately
  // (greeting from the auth store, the body figure all-cold, the Train card) and
  // fills in as useSelfClient → useMuscleFrequency land. Progressive render — this
  // kills the second spinner that used to follow the cold-load skeleton. See #19.
  return (
    // Home is a single no-scroll screen: greeting (top) · body figure (fills the
    // middle) · Train (bottom, just above the nav). The min-height reserves the
    // bottom tab-bar space on mobile (≈ nav-clear) and is the one value to tune
    // on-device if anything scrolls; the sidebar layout (md) just uses the viewport.
    <div className="flex flex-col px-4 max-w-2xl mx-auto min-h-[calc(100dvh-6.5rem)] md:min-h-screen md:px-6 md:py-6">

      <div className="shrink-0">
        <EmailVerificationBanner />

        {/* Greeting */}
        <div className="mb-3 animate-slide-up">
          <p className="text-ink-subtle text-sm mb-0.5">{greeting}</p>
          <h1 className="font-display text-3xl md:text-4xl uppercase tracking-wide text-ink">
            {mode.labels.dashboardTitle}
          </h1>
        </div>
      </div>

      {/* Body heat-map — fills the space between greeting and Train. Shows the
          figure (all-cold while loading / for a new athlete) and colors in as
          the last-30-days frequency lands. */}
      <button
        type="button"
        onClick={() => openBody(null)}
        aria-label="View full body breakdown — muscles trained in the last 30 days"
        className="flex-1 min-h-0 flex flex-col p-3 w-full rounded-lg border border-surface-border bg-surface/50 shadow-sm animate-slide-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ animationDelay: '50ms' }}
      >
        <BodyHeatMap
          counts={muscleFreq?.counts ?? []}
          className="flex-1 min-h-0"
          onRegionTap={(region) => openBody(region)}
        />
        <span className="shrink-0 text-center text-[10px] uppercase tracking-widest text-ink-faint mt-2">
          Tap a muscle · or all&nbsp;›
        </span>
      </button>

      <BodyBreakdownSheet
        open={bodyOpen}
        onClose={() => setBodyOpen(false)}
        counts={muscleFreq?.counts ?? []}
        scopeRegion={bodyRegion}
        clientId={selfClient?.id}
      />

      {/* ── Launch ── Train, pinned just above the nav. Planning + all feedback
          live elsewhere (launcher / My Training). */}
      <div className="shrink-0 pb-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <TrainCard
          selfClientId={selfClient?.id}
          onStart={() => openSessionLauncher(selfClient?.id)}
        />
      </div>

    </div>
  )
}
