// ------------------------------------------------------------
// pages/OnboardingPage.tsx — Mode selection (Phase 4)
//
// Shown once after registration when trainer.onboardedAt is null.
// Calls POST /api/v1/auth/onboard to set trainerMode and onboardedAt.
// On success, authStore trainer is updated and App.tsx routes to the
// correct dashboard based on the chosen mode.
//
// DESIGN:
//   Split-screen choice on desktop, stacked cards on mobile.
//   Bold, deliberate — this is a meaningful moment in the product.
//   The choice should feel weighty, not like a settings toggle.
// ------------------------------------------------------------

import { useState }       from 'react'
import { useNavigate }    from 'react-router-dom'
import { useAuthStore }   from '@/store/authStore'
import { apiClient }      from '@/lib/api'
import { cn }             from '@/lib/cn'
import type { TrainerResponse } from '@trainer-app/shared'

type Mode = 'athlete' | 'trainer'

// ── SVG Icons ────────────────────────────────────────────────────────────────

function AthleteIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden>
      {/* Single figure in motion — running stride */}
      <circle cx="60" cy="22" r="10" fill="currentColor" opacity="0.9" />
      {/* Torso */}
      <path d="M60 32 L54 58 L60 56 L66 58 Z" fill="currentColor" opacity="0.85" />
      {/* Left arm forward */}
      <path d="M56 38 L40 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      {/* Right arm back */}
      <path d="M64 38 L78 46" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      {/* Left leg forward */}
      <path d="M56 56 L46 78 L38 92" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {/* Right leg back */}
      <path d="M64 56 L72 74 L82 86" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {/* Motion lines */}
      <path d="M28 54 L20 54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
      <path d="M26 62 L16 62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      <path d="M29 70 L21 70" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  )
}

function TrainerIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 140 120" fill="none" aria-hidden>
      {/* Trainer figure — left, standing upright */}
      <circle cx="44" cy="22" r="9" fill="currentColor" opacity="0.9" />
      <path d="M44 31 L38 56 L44 54 L50 56 Z" fill="currentColor" opacity="0.85" />
      {/* Trainer arm extended toward client */}
      <path d="M50 38 L72 42" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      {/* Trainer other arm */}
      <path d="M38 38 L28 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      {/* Trainer legs — planted, coaching stance */}
      <path d="M40 54 L34 80 L30 95" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <path d="M48 54 L52 80 L56 95" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />

      {/* Client figure — right, in a squat/effort position */}
      <circle cx="98" cy="28" r="9" fill="currentColor" opacity="0.75" />
      <path d="M98 37 L92 58 L98 56 L104 58 Z" fill="currentColor" opacity="0.7" />
      {/* Client arms — holding a bar overhead */}
      <path d="M92 44 L76 42" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.65" />
      <path d="M104 44 L116 38" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" opacity="0.65" />
      {/* Bar */}
      <path d="M74 40 L118 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {/* Weights */}
      <rect x="68" y="34" width="6" height="12" rx="1.5" fill="currentColor" opacity="0.45" />
      <rect x="118" y="30" width="6" height="12" rx="1.5" fill="currentColor" opacity="0.45" />
      {/* Client legs — wide squat */}
      <path d="M94 56 L84 78 L76 92" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <path d="M102 56 L112 78 L120 92" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />

      {/* Connection line — trainer to client, dashed */}
      <path d="M66 46 L72 44" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" opacity="0.35" />
    </svg>
  )
}

// ── Choice Card ───────────────────────────────────────────────────────────────

interface ChoiceCardProps {
  mode:        Mode
  title:       string
  subtitle:    string
  bullets:     string[]
  icon:        React.JSX.Element
  selected:    boolean
  loading:     boolean
  onSelect:    (mode: Mode) => void
}

function ChoiceCard({
  mode, title, subtitle, bullets, icon,
  selected, loading, onSelect,
}: ChoiceCardProps): React.JSX.Element {
  const isLoading = loading && selected

  return (
    <button
      type="button"
      onClick={() => !loading && onSelect(mode)}
      disabled={loading}
      aria-pressed={selected}
      className={cn(
        // Base
        'relative flex flex-col items-center text-center w-full',
        'rounded-2xl border-2 p-8 md:p-10',
        'transition-all duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
        // Default state
        'bg-brand-secondary border-surface-border',
        'hover:border-command-blue/40 hover:bg-surface',
        // Selected state
        selected && [
          'border-command-blue bg-brand-secondary',
          'shadow-[0_0_40px_-8px] shadow-command-blue/25',
        ],
        // Loading
        loading && !selected && 'opacity-40 cursor-not-allowed',
      )}
    >
      {/* Icon area */}
      <div
        className={cn(
          'mb-6 w-28 h-28 md:w-36 md:h-36 flex items-center justify-center rounded-2xl transition-colors duration-300',
          selected
            ? 'text-command-blue bg-command-blue/10'
            : 'text-gray-400 bg-brand-accent/30',
        )}
      >
        {isLoading
          ? (
            <svg className="w-10 h-10 animate-spin text-command-blue" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )
          : icon
        }
      </div>

      {/* Text */}
      <h2
        className={cn(
          'font-display text-3xl md:text-4xl tracking-wide uppercase mb-2 transition-colors duration-300',
          selected ? 'text-white' : 'text-gray-200',
        )}
      >
        {title}
      </h2>

      <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-xs">
        {subtitle}
      </p>

      {/* Bullet points */}
      <ul className="space-y-2 text-left w-full max-w-xs">
        {bullets.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm">
            <span
              className={cn(
                'mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300',
                selected ? 'bg-command-blue/20 text-command-blue' : 'bg-surface-border text-gray-500',
              )}
              aria-hidden
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-2 h-2">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </span>
            <span className={selected ? 'text-gray-300' : 'text-gray-500'}>
              {point}
            </span>
          </li>
        ))}
      </ul>

      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-command-blue flex items-center justify-center animate-fade-in">
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" aria-hidden>
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage(): React.JSX.Element {
  const [selected, setSelected] = useState<Mode | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const navigate    = useNavigate()
  const setTrainer  = useAuthStore((s) => s.setTrainer)

  const handleSelect = async (mode: Mode): Promise<void> => {
    if (loading) return
    setSelected(mode)
    setError(null)
    setLoading(true)

    try {
      const updated = await apiClient.post<TrainerResponse>('/auth/onboard', { trainerMode: mode })
      setTrainer(updated)
      navigate('/', { replace: true })
    } catch {
      setError('Something went wrong — please try again')
      setSelected(null)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-primary flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-center pt-10 pb-6 px-6">
        <div className="text-center">
          <span className="font-display text-3xl tracking-widest uppercase">
            <span className="text-white">Trainer</span>
            <span className="text-command-blue">App</span>
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">

        <div className="w-full max-w-2xl">

          {/* Heading */}
          <div className="text-center mb-10 animate-slide-up">
            <h1 className="font-display text-4xl md:text-5xl text-white uppercase tracking-wide mb-3">
              How will you use
              <span className="text-command-blue block">TrainerApp?</span>
            </h1>
            <p className="text-gray-400 text-sm">
              Choose your path — you can always change this in settings later.
            </p>
          </div>

          {/* Error */}
          {error != null && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 text-center animate-fade-in"
            >
              {error}
            </div>
          )}

          {/* Choice cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChoiceCard
              mode="athlete"
              title="Athlete"
              subtitle="Track your own training, progress, and performance — built for you."
              bullets={[
                'Personal session logging',
                'Your own progress timeline',
                'Monthly self-report',
                'No clients required',
              ]}
              icon={<AthleteIcon className="w-full h-full p-2" />}
              selected={selected === 'athlete'}
              loading={loading}
              onSelect={handleSelect}
            />

            <ChoiceCard
              mode="trainer"
              title="Trainer"
              subtitle="Manage clients, track their progress, and deliver monthly reports."
              bullets={[
                'Full client roster',
                'Per-client progress tracking',
                'Monthly client reports',
                'Your own training included',
              ]}
              icon={<TrainerIcon className="w-full h-full p-2" />}
              selected={selected === 'trainer'}
              loading={loading}
              onSelect={handleSelect}
            />
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-600 mt-8">
            Selecting <span className="text-gray-500">Trainer</span> gives you a personal training section too — your own progress is always tracked.
          </p>

        </div>
      </main>
    </div>
  )
}
