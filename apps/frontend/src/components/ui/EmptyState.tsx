/**
 * EmptyState — a centred placeholder shown when a list or view has no content.
 *
 * Accepts an icon (emoji or any node), a required title, an optional
 * descriptive message, and an optional action slot for a call-to-action button.
 */

import { cn } from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /**
   * Visual icon — accepts a string (emoji) or any React node (SVG etc).
   * Defaults to `"📋"`.
   */
  icon?: React.ReactNode
  /** Short, descriptive headline. */
  title: string
  /** Optional supporting copy below the title. Keep to 1–2 sentences. */
  message?: string
  /** Optional CTA slot — typically a `<Button>` to create the first item. */
  action?: React.ReactNode
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EmptyState({
  icon = '📋',
  title,
  message,
  action,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col items-center justify-center',
        'py-16 px-6 text-center',
        className,
      )}
    >
      <span
        className="block text-5xl mb-4 opacity-30 select-none"
        aria-hidden
      >
        {icon}
      </span>

      <h3 className="font-display text-lg text-gray-300 mb-2">
        {title}
      </h3>

      {message != null && (
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
          {message}
        </p>
      )}

      {action != null && (
        <div className="mt-2">{action}</div>
      )}
    </section>
  )
}
