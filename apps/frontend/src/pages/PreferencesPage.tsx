// ------------------------------------------------------------
// pages/PreferencesPage.tsx — Trainer preferences (v1.4.5)
//
// Sections:
//   Profile     — name, weight unit
//   Training    — mode display
//   Dashboard   — CTA label, widget order (draggable list)
//   Alerts      — alertsEnabled toggle, color scheme, tone
//
// Every preference saves immediately on change — no Save button.
// Visual feedback via flash-success on each saved field.
// Widget order updates via drag-to-reorder (hamburger handle)
// and is synced to trainer.widgetProgression on drop.
// ------------------------------------------------------------

import { useState, useRef, useCallback }  from 'react'
import { cn }                              from '@/lib/cn'
import { interactions }                    from '@/lib/interactions'
import { usePreferences }                  from '@/hooks/usePreferences'
import { useUXEvent }                      from '@/hooks/useUXEvent'
import { useReorderList }                  from '@/hooks/useReorderList'
import { useAuthStore }                    from '@/store/authStore'
import { apiClient }                       from '@/lib/api'
import {
  CTA_LABEL_OPTIONS,
  getWidgetsForMode,
  WIDGET_META,
  type WidgetId,
} from '@/lib/widgets'
import { Input }   from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import type { TrainerResponse } from '@trainer-app/shared'

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title:        string
  description?: string
  children:     React.ReactNode
}): React.JSX.Element {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wide text-white">{title}</h2>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

// ── Preference row wrapper ────────────────────────────────────────────────────

function PrefRow({
  label,
  hint,
  children,
  saving,
}: {
  label:    string
  hint?:    string
  children: React.ReactNode
  saving?:  boolean
}): React.JSX.Element {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-200">{label}</p>
          {hint && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Spinner size="sm" className="text-gray-600" />}
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked:  boolean
  onChange: (v: boolean) => void
  label:    string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex w-11 h-6 rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
        checked ? 'bg-brand-highlight' : 'bg-surface-border',
        interactions.button.base,
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm',
          'transition-transform duration-200 ease-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

// ── Color scheme picker ───────────────────────────────────────────────────────

const SCHEME_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  amber: { bg: 'bg-amber-500/20',   border: 'border-amber-500/40',   dot: 'bg-amber-400'   },
  red:   { bg: 'bg-red-500/20',     border: 'border-red-500/40',     dot: 'bg-red-400'     },
  blue:  { bg: 'bg-sky-500/20',     border: 'border-sky-500/40',     dot: 'bg-sky-400'     },
  green: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
}

function ColorSchemePicker({
  value,
  onChange,
}: {
  value:    string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="flex gap-2">
      {Object.entries(SCHEME_COLORS).map(([scheme, classes]) => (
        <button
          key={scheme}
          type="button"
          onClick={() => onChange(scheme)}
          aria-label={`${scheme} color scheme`}
          aria-pressed={value === scheme}
          className={cn(
            'w-8 h-8 rounded-full border-2 flex items-center justify-center',
            'transition-all duration-150',
            classes.bg,
            value === scheme
              ? cn(classes.border, 'scale-110 ring-2 ring-offset-1 ring-offset-brand-secondary', classes.dot.replace('bg-', 'ring-'))
              : 'border-surface-border hover:scale-105',
            interactions.button.base,
            interactions.button.press,
          )}
        >
          <div className={cn('w-3 h-3 rounded-full', classes.dot)} />
        </button>
      ))}
    </div>
  )
}

// ── Tone picker ───────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: 'clinical',    label: 'Clinical',    example: '"2 clients inactive"' },
  { value: 'motivating',  label: 'Motivating',  example: '"Time to check in"'   },
  { value: 'firm',        label: 'Firm',        example: '"Action required"'     },
]

function TonePicker({
  value,
  onChange,
}: {
  value:    string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2 w-full mt-2">
      {TONE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left',
            'transition-all duration-150',
            value === opt.value
              ? 'border-brand-highlight/50 bg-brand-highlight/5'
              : 'border-surface-border bg-surface hover:border-gray-500',
            interactions.button.base,
            interactions.button.press,
          )}
        >
          <span className={cn('text-sm font-medium', value === opt.value ? 'text-white' : 'text-gray-300')}>
            {opt.label}
          </span>
          <span className="text-xs text-gray-500 font-mono">{opt.example}</span>
        </button>
      ))}
    </div>
  )
}

// ── Widget row (draggable) ────────────────────────────────────────────────────

function WidgetRow({
  widgetId,
  enabled,
  isDragging,
  dragHandleProps,
}: {
  widgetId:        WidgetId
  enabled:         boolean
  isDragging:      boolean
  dragHandleProps: ReturnType<ReturnType<typeof useReorderList>['dragHandleProps']>
}): React.JSX.Element {
  const meta = WIDGET_META[widgetId]
  const isComingSoon = meta.availableFrom > 4

  return (
    <div
      data-reorder-item
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-all duration-150',
        isDragging
          ? 'border-brand-highlight/30 bg-brand-highlight/5 shadow-lg shadow-black/20 scale-[1.02]'
          : enabled
          ? 'border-surface-border bg-surface'
          : 'border-surface-border/50 bg-brand-primary opacity-50',
      )}
    >
      {/* Drag handle — hamburger icon */}
      <div
        {...dragHandleProps}
        className={cn(
          'flex flex-col gap-[3px] p-1.5 rounded-lg shrink-0',
          'text-gray-600 hover:text-gray-400 hover:bg-surface-raised',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-highlight',
        )}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-3.5 h-px bg-current rounded-full" />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', enabled ? 'text-gray-200' : 'text-gray-500')}>
          {meta.label}
        </p>
        <p className="text-xs text-gray-600 truncate">{meta.description}</p>
      </div>

      {/* Coming soon badge or availability indicator */}
      {isComingSoon && (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-surface-border text-gray-600 uppercase tracking-wider">
          Phase {meta.availableFrom}
        </span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PreferencesPage(): React.JSX.Element {
  const trainer    = useAuthStore((s) => s.trainer)
  const setTrainer = useAuthStore((s) => s.setTrainer)
  const { fire }   = useUXEvent()

  const {
    ctaLabel,
    alertsEnabled,
    alertColorScheme,
    alertTone,
    widgetOrder,
    trainerMode,
    updatePreference,
    updateWidgetOrder,
  } = usePreferences()

  // Saving state per field
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const save = useCallback(async (
    key:   string,
    value: unknown,
    fieldRef?: HTMLElement | null,
  ): Promise<void> => {
    setSaving((s) => ({ ...s, [key]: true }))
    try {
      await updatePreference(key as any, value as any)
      if (fieldRef) fire('update', { target: fieldRef })
    } finally {
      setSaving((s) => ({ ...s, [key]: false }))
    }
  }, [updatePreference, fire])

  // Name editing
  const [nameValue,   setNameValue]   = useState(trainer?.name ?? '')
  const [nameSaving,  setNameSaving]  = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const saveName = async (): Promise<void> => {
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === trainer?.name) return
    setNameSaving(true)
    try {
      const updated = await apiClient.patch<TrainerResponse>('/auth/me', { name: trimmed })
      setTrainer(updated)
      fire('update', { target: nameRef.current ?? undefined, entity: 'profile' })
    } finally {
      setNameSaving(false)
    }
  }

  // Widget reorder
  const widgetEntries = getWidgetsForMode(widgetOrder, trainerMode)
  const enabledWidgets = widgetEntries.filter((w) => w.enabled).map((w) => w.id)

  const { items: orderedWidgets, dragHandleProps, draggingIndex } = useReorderList({
    items:     enabledWidgets,
    onReorder: updateWidgetOrder,
  })

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto pb-24">

      {/* Header */}
      <div className="mb-8 animate-slide-up">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white">
          Preferences
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Changes save automatically
        </p>
      </div>

      <div className="space-y-8">

        {/* ── Profile ──────────────────────────────────────────────────────── */}
        <Section title="Profile">
          <div className="card p-4 space-y-4">
            <div>
              <Input
                ref={nameRef}
                label="Name"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === 'Enter') nameRef.current?.blur() }}
              />
              {nameSaving && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Spinner size="sm" /> Saving…
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-surface-border">
              <div>
                <p className="text-sm font-medium text-gray-200">Weight unit</p>
                <p className="text-xs text-gray-500">Used as default across all sessions</p>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg bg-brand-primary border border-surface-border">
                {(['lbs', 'kg'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => save('weightUnitPreference', unit)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                      trainer?.weightUnitPreference === unit
                        ? 'bg-brand-highlight text-white'
                        : 'text-gray-500 hover:text-gray-300',
                      interactions.button.base,
                      interactions.button.press,
                    )}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Training Mode ─────────────────────────────────────────────────── */}
        <Section
          title="Training Mode"
          description="Your mode determines which features are shown. Athletes see a personal training interface. Trainers see the full client roster."
        >
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200 capitalize">{trainerMode} Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {trainerMode === 'athlete'
                    ? 'Personal training — no client roster'
                    : 'Client management + personal training'}
                </p>
              </div>
              <span className={cn(
                'text-xs px-2 py-1 rounded border uppercase tracking-wider font-medium',
                trainerMode === 'athlete'
                  ? 'border-sky-500/30 text-sky-400 bg-sky-500/10'
                  : 'border-brand-highlight/30 text-brand-highlight/80 bg-brand-highlight/10',
              )}>
                {trainerMode}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              To change mode, contact support or re-run onboarding. Mode switching UI coming in a future update.
            </p>
          </div>
        </Section>

        {/* ── Dashboard ────────────────────────────────────────────────────── */}
        <Section
          title="Dashboard"
          description="Personalize your training call-to-action and arrange which widgets appear on your dashboard."
        >
          {/* CTA label */}
          <div className="card p-4">
            <p className="text-sm font-medium text-gray-200 mb-3">Training button label</p>
            <div className="grid grid-cols-2 gap-2">
              {CTA_LABEL_OPTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => save('ctaLabel', label)}
                  aria-pressed={ctaLabel === label}
                  className={cn(
                    'px-3 py-2 rounded-xl border text-sm text-left transition-all duration-150',
                    ctaLabel === label
                      ? 'border-brand-highlight/50 bg-brand-highlight/10 text-white'
                      : 'border-surface-border bg-surface text-gray-400 hover:border-gray-500 hover:text-gray-300',
                    interactions.button.base,
                    interactions.button.press,
                  )}
                >
                  {ctaLabel === label && (
                    <span className="mr-1.5 text-brand-highlight" aria-hidden>✓</span>
                  )}
                  {label}
                </button>
              ))}
            </div>
            {saving.ctaLabel && (
              <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                <Spinner size="sm" /> Saving…
              </p>
            )}
          </div>

          {/* Session layout */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Session layout</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  How workout blocks are arranged during a live session
                </p>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg bg-brand-primary border border-surface-border">
                {(['horizontal', 'vertical'] as const).map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => save('sessionLayout', layout)}
                    aria-pressed={trainer?.sessionLayout === layout}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 capitalize',
                      (trainer?.sessionLayout ?? 'horizontal') === layout
                        ? 'bg-brand-highlight text-white'
                        : 'text-gray-500 hover:text-gray-300',
                      interactions.button.base,
                      interactions.button.press,
                    )}
                  >
                    {layout}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly session target */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Weekly session target</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Used for your consistency score
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => save('weeklySessionTarget', Math.max(1, (trainer?.weeklySessionTarget ?? 3) - 1))}
                  className="w-7 h-7 rounded-lg border border-surface-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center"
                >−</button>
                <span className="font-mono text-white w-4 text-center">
                  {trainer?.weeklySessionTarget ?? 3}
                </span>
                <button
                  type="button"
                  onClick={() => save('weeklySessionTarget', Math.min(14, (trainer?.weeklySessionTarget ?? 3) + 1))}
                  className="w-7 h-7 rounded-lg border border-surface-border text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center"
                >+</button>
              </div>
            </div>
          </div>

          {/* 1RM estimates — athlete mode only */}
          {(trainer?.trainerMode ?? 'trainer') === 'athlete' && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">1RM estimates</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Show Epley estimated max lift on KPI cards
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={trainer?.show1rmEstimate ?? false}
                  onClick={() => save('show1rmEstimate', !(trainer?.show1rmEstimate ?? false))}
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors duration-200',
                    (trainer?.show1rmEstimate ?? false) ? 'bg-brand-highlight' : 'bg-surface-border',
                    interactions.button.base,
                    interactions.button.press,
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
                    (trainer?.show1rmEstimate ?? false) ? 'translate-x-5' : 'translate-x-0.5',
                  )} />
                </button>
              </div>
            </div>
          )}

          {/* Widget order */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-200">Widget order</p>
              <p className="text-xs text-gray-600">Drag to reorder</p>
            </div>

            <div className="space-y-2" role="list" aria-label="Dashboard widgets">
              {orderedWidgets.map((widgetId, index) => (
                <div key={widgetId} role="listitem">
                  <WidgetRow
                    widgetId={widgetId}
                    enabled={true}
                    isDragging={index === draggingIndex}
                    dragHandleProps={dragHandleProps(index)}
                  />
                </div>
              ))}

              {/* Disabled widgets — not in progression, shown greyed out */}
              {widgetEntries
                .filter((w) => !w.enabled)
                .map(({ id }) => (
                  <div key={id} role="listitem">
                    <WidgetRow
                      widgetId={id}
                      enabled={false}
                      isDragging={false}
                      dragHandleProps={dragHandleProps(-1)}
                    />
                  </div>
                ))}
            </div>

            <p className="text-xs text-gray-700 mt-3">
              Greyed-out widgets aren't in your current order. They'll become available in future updates.
            </p>
          </div>
        </Section>

        {/* ── Alerts ───────────────────────────────────────────────────────── */}
        <Section
          title="Alerts"
          description="Control how the at-risk client alert looks and sounds."
        >
          <PrefRow
            label="At-risk alerts"
            hint="Shows clients with no session in 14+ days on every app open. Turn off to stop seeing alerts."
            saving={saving.alertsEnabled}
          >
            <Toggle
              checked={alertsEnabled}
              onChange={(v) => save('alertsEnabled', v)}
              label="Toggle at-risk alerts"
            />
          </PrefRow>

          {alertsEnabled && (
            <>
              <div className="card p-4">
                <p className="text-sm font-medium text-gray-200 mb-3">Alert color</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {alertColorScheme.charAt(0).toUpperCase() + alertColorScheme.slice(1)}
                  </p>
                  <ColorSchemePicker
                    value={alertColorScheme}
                    onChange={(v) => save('alertColorScheme', v)}
                  />
                </div>
                {saving.alertColorScheme && (
                  <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                    <Spinner size="sm" /> Saving…
                  </p>
                )}
              </div>

              <div className="card p-4">
                <p className="text-sm font-medium text-gray-200 mb-1">Message tone</p>
                <p className="text-xs text-gray-500 mb-3">
                  How the at-risk alert reads to you
                </p>
                <TonePicker
                  value={alertTone}
                  onChange={(v) => save('alertTone', v)}
                />
                {saving.alertTone && (
                  <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                    <Spinner size="sm" /> Saving…
                  </p>
                )}
              </div>
            </>
          )}
        </Section>

      </div>
    </div>
  )
}
