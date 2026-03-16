/**
 * Spinner — an animated loading indicator.
 *
 * Announces itself to screen readers via `role="status"` and an
 * accessible label. The SVG itself is aria-hidden since the label
 * on the wrapper covers it.
 */

import { cn } from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  /** Size of the spinner. Defaults to `"md"`. */
  size?: SpinnerSize
  /** Accessible label announced to screen readers. Defaults to `"Loading"`. */
  label?: string
  className?: string
  /** When true, hides the accessible label from the DOM (use when the
   *  parent already communicates the loading state). */
  'aria-hidden'?: boolean
}

// ── Style map ─────────────────────────────────────────────────────────────────

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5   h-5',
  lg: 'w-8   h-8',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Spinner({
  size      = 'md',
  label     = 'Loading',
  className,
  'aria-hidden': ariaHidden,
}: SpinnerProps): React.JSX.Element {
  return (
    <span
      role={ariaHidden ? undefined : 'status'}
      aria-label={ariaHidden ? undefined : label}
      aria-hidden={ariaHidden}
      className="inline-flex"
    >
      <svg
        className={cn('animate-spin', sizeClasses[size], className)}
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </span>
  )
}
