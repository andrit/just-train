/**
 * ExerciseTypeBadge — the exercise-type visual system's presentational layer.
 *
 * Renders a workout type as an icon + label pill, coloured from the one
 * source of truth (`EXERCISE_TYPE_THEME`). The five glyphs are deliberately
 * distinct SHAPES so the type is identifiable without colour — the secondary
 * encoding that lets the validated palette sit in the CVD 6–8 band safely.
 *
 * `ExerciseTypeIcon` is the icon alone, for compact spots (session headers)
 * that already show the label as text.
 */

import { cn } from '@/lib/cn'
import { exerciseTypeTheme } from '@/lib/exerciseTypeTheme'

// ── Glyphs ──────────────────────────────────────────────────────────────────

function Svg({ className, children }: { className?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// Dumbbell
function ResistanceGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <line x1="6" y1="7" x2="6" y2="17" />
      <line x1="18" y1="7" x2="18" y2="17" />
      <line x1="3" y1="9.5" x2="3" y2="14.5" />
      <line x1="21" y1="9.5" x2="21" y2="14.5" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </Svg>
  )
}

// Heartbeat / pulse line
function CardioGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M2 12h4l2-5 4 10 2-5h8" />
    </Svg>
  )
}

// Bodyweight figure (star-jump)
function CalisthenicsGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="12" cy="5" r="2.25" />
      <path d="M12 7.5v6M12 9.5 6.5 12M12 9.5 17.5 12M12 13.5l-3 6M12 13.5l3 6" />
    </Svg>
  )
}

// Outward arrows on a baseline — "stretch"
function StretchingGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M9 7 4 12l5 5M15 7l5 5-5 5M4 12h16" />
    </Svg>
  )
}

// Snowflake — cool down
function CooldownGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <path d="M12 2v20M4 6l16 12M20 6 4 18" />
    </Svg>
  )
}

const GLYPHS: Record<string, (p: { className?: string }) => React.JSX.Element> = {
  resistance:   ResistanceGlyph,
  cardio:       CardioGlyph,
  calisthenics: CalisthenicsGlyph,
  stretching:   StretchingGlyph,
  cooldown:     CooldownGlyph,
}

// ── Public ──────────────────────────────────────────────────────────────────

export function ExerciseTypeIcon({ type, className }: { type: string; className?: string }): React.JSX.Element {
  const Glyph = GLYPHS[type] ?? CooldownGlyph
  return <Glyph className={className} />
}

export function ExerciseTypeBadge({ type, className }: { type: string; className?: string }): React.JSX.Element {
  const theme = exerciseTypeTheme(type)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full border',
        'text-xs font-medium leading-none',
        theme.text,
        theme.border,
        theme.tint,
        className,
      )}
    >
      <ExerciseTypeIcon type={type} className="w-3.5 h-3.5" />
      {theme.label}
    </span>
  )
}
