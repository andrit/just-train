import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter }        from 'react-router-dom'
import { useState }            from 'react'
import { cn }                  from '@/lib/cn'
import { interactions }        from '@/lib/interactions'
import { CTA_LABEL_OPTIONS }   from '@/lib/widgets'

export default {
  title: 'Preferences',
} satisfies Meta

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      aria-label={label} onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
        checked ? 'bg-brand-highlight' : 'bg-surface-border',
        interactions.button.base,
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm',
        'transition-transform duration-200 ease-out',
        checked ? 'translate-x-5' : 'translate-x-0',
      )} />
    </button>
  )
}

export const ToggleSwitch: StoryObj = {
  name: 'Toggle / On and Off',
  render: () => {
    function Demo() {
      const [on, setOn] = useState(true)
      return (
        <div className="p-6 flex items-center gap-4">
          <Toggle checked={on} onChange={setOn} label="Demo toggle" />
          <span className="text-sm text-gray-400">{on ? 'On' : 'Off'}</span>
        </div>
      )
    }
    return <Demo />
  },
}

// ── Color scheme picker ───────────────────────────────────────────────────────

const SCHEME_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  amber: { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   dot: 'bg-amber-400'   },
  red:   { bg: 'bg-red-500/20',     border: 'border-red-500/40',     dot: 'bg-red-400'     },
  blue:  { bg: 'bg-sky-500/20',     border: 'border-sky-500/40',     dot: 'bg-sky-400'     },
  green: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
}

export const ColorSchemePicker: StoryObj = {
  name: 'Alert / Color scheme picker',
  render: () => {
    function Demo() {
      const [scheme, setScheme] = useState('amber')
      return (
        <div className="p-6 space-y-3">
          <p className="text-xs text-gray-500">
            Selected: <span className="text-brand-highlight">{scheme}</span>
          </p>
          <div className="flex gap-2">
            {Object.entries(SCHEME_COLORS).map(([s, c]) => (
              <button
                key={s} type="button" onClick={() => setScheme(s)}
                aria-pressed={scheme === s}
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center',
                  'transition-all duration-150',
                  c.bg,
                  scheme === s ? cn(c.border, 'scale-110') : 'border-surface-border hover:scale-105',
                  interactions.button.base, interactions.button.press,
                )}
              >
                <div className={cn('w-3 h-3 rounded-full', c.dot)} />
              </button>
            ))}
          </div>
        </div>
      )
    }
    return <Demo />
  },
}

// ── Tone picker ───────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: 'clinical',   label: 'Clinical',   example: '"2 clients inactive"'     },
  { value: 'motivating', label: 'Motivating', example: '"Time to check in"'       },
  { value: 'firm',       label: 'Firm',       example: '"Action required"'        },
]

export const TonePicker: StoryObj = {
  name: 'Alert / Tone picker',
  render: () => {
    function Demo() {
      const [tone, setTone] = useState('clinical')
      return (
        <div className="p-6 max-w-sm space-y-2">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value} type="button"
              onClick={() => setTone(opt.value)}
              aria-pressed={tone === opt.value}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left',
                'transition-all duration-150',
                tone === opt.value
                  ? 'border-brand-highlight/50 bg-brand-highlight/5'
                  : 'border-surface-border bg-surface hover:border-gray-500',
                interactions.button.base, interactions.button.press,
              )}
            >
              <span className={cn('text-sm font-medium', tone === opt.value ? 'text-white' : 'text-gray-300')}>
                {opt.label}
              </span>
              <span className="text-xs text-gray-500 font-mono">{opt.example}</span>
            </button>
          ))}
        </div>
      )
    }
    return <Demo />
  },
}

// ── CTA label picker ──────────────────────────────────────────────────────────

export const CTALabelPicker: StoryObj = {
  name: 'Dashboard / CTA label picker',
  render: () => {
    function Demo() {
      const [cta, setCta] = useState('Start Training')
      return (
        <div className="p-6 max-w-xs space-y-3">
          <p className="text-xs text-gray-500 mb-4">
            Selected: <span className="text-brand-highlight font-medium">{cta}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CTA_LABEL_OPTIONS.map((label) => (
              <button
                key={label} type="button"
                onClick={() => setCta(label)}
                aria-pressed={cta === label}
                className={cn(
                  'px-3 py-2 rounded-xl border text-sm text-left transition-all duration-150',
                  cta === label
                    ? 'border-brand-highlight/50 bg-brand-highlight/10 text-white'
                    : 'border-surface-border bg-surface text-gray-400 hover:border-gray-500 hover:text-gray-300',
                  interactions.button.base, interactions.button.press,
                )}
              >
                {cta === label && <span className="mr-1 text-brand-highlight" aria-hidden>✓</span>}
                {label}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return <Demo />
  },
}

// ── Widget reorder row ────────────────────────────────────────────────────────

export const WidgetRow: StoryObj = {
  name: 'Dashboard / Widget reorder row',
  render: () => (
    <div className="p-6 max-w-sm space-y-2">
      {[
        { label: 'At-Risk Clients',  desc: 'Clients with no session in 14+ days', dragging: false, enabled: true  },
        { label: 'My Training',      desc: 'Quick access to your training profile', dragging: true,  enabled: true  },
        { label: 'Active Clients',   desc: 'Clients with a session this month',    dragging: false, enabled: true  },
        { label: 'Volume This Week', desc: 'Total weight lifted',                  dragging: false, enabled: false },
      ].map(({ label, desc, dragging, enabled }) => (
        <div
          key={label}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl border transition-all duration-150',
            dragging
              ? 'border-brand-highlight/30 bg-brand-highlight/5 shadow-lg scale-[1.02]'
              : enabled
              ? 'border-surface-border bg-surface'
              : 'border-surface-border/50 bg-brand-primary opacity-50',
          )}
        >
          {/* Hamburger handle */}
          <div className="flex flex-col gap-[3px] p-1.5 rounded-lg text-gray-600 cursor-grab">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-3.5 h-px bg-current rounded-full" />
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium', enabled ? 'text-gray-200' : 'text-gray-500')}>{label}</p>
            <p className="text-xs text-gray-600 truncate">{desc}</p>
          </div>
          {!enabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-surface-border text-gray-600 uppercase tracking-wider">
              Phase 7
            </span>
          )}
        </div>
      ))}
      <p className="text-xs text-gray-600 text-center pt-1">
        Middle row shown in dragging state
      </p>
    </div>
  ),
}

// ── Full preferences layout preview ──────────────────────────────────────────

export const FullPreferencesPreview: StoryObj = {
  name: 'Full page preview',
  decorators: [
    (Story: React.ComponentType) => (
      <MemoryRouter>
        <div className="max-w-xl mx-auto">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => {
    // Dynamically import to avoid query hook issues in Storybook
    const PreferencesPage = require('@/pages/PreferencesPage').default
    return <PreferencesPage />
  },
}
