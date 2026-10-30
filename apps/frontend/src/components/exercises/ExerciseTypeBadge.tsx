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

// Barbell — long bar with grouped plates at each end
function ResistanceGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="7" y1="8.5" x2="7" y2="15.5" />
      <line x1="5" y1="10" x2="5" y2="14" />
      <line x1="17" y1="8.5" x2="17" y2="15.5" />
      <line x1="19" y1="10" x2="19" y2="14" />
    </Svg>
  )
}

// Bicycle — two wheels + frame
function CardioGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="5.5" cy="15.5" r="3.5" />
      <circle cx="18.5" cy="15.5" r="3.5" />
      <path d="M5.5 15.5 10 8h4l4.5 7.5" />
      <path d="M10 8 11.5 15.5 5.5 15.5" />
      <path d="M14 8 11.5 15.5" />
    </Svg>
  )
}

// Jumping jack — arms up and out, legs spread
function CalisthenicsGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 6.5 12 13" />
      <path d="M12 8 6.5 4.5" />
      <path d="M12 8 17.5 4.5" />
      <path d="M12 13 7.5 20" />
      <path d="M12 13 16.5 20" />
    </Svg>
  )
}

// Person doing a split — upright torso, legs spread wide and low
function StretchingGlyph({ className }: { className?: string }): React.JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8 12 14.5" />
      <path d="M12 11 8 10" />
      <path d="M12 11 16 10" />
      <path d="M12 14.5 4 17.5" />
      <path d="M12 14.5 20 17.5" />
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

export function ExerciseTypeBadge({
  type,
  showIcon = true,
  className,
}: {
  type: string
  /** Show the glyph before the label. Off where the icon already appears nearby (e.g. card art). */
  showIcon?: boolean
  className?: string
}): React.JSX.Element {
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
      {showIcon && <ExerciseTypeIcon type={type} className="w-3.5 h-3.5" />}
      {theme.label}
    </span>
  )
}
