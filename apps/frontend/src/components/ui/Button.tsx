/**
 * Button — the primary interactive control.
 *
 * Supports four visual variants, three sizes, a loading state that
 * shows a spinner and prevents double-submission, and an optional
 * leading icon slot. Uses forwardRef so it composes with form libraries
 * and parent ref callbacks.
 */

import { forwardRef } from 'react'
import { cn }         from '@/lib/cn'
import { Spinner }    from './Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize    = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button. Defaults to `"primary"`. */
  variant?: ButtonVariant
  /** Size of the button. Defaults to `"md"`. */
  size?: ButtonSize
  /**
   * When true, replaces the icon (if any) with a spinner and disables
   * the button to prevent duplicate submissions.
   */
  loading?: boolean
  /**
   * Optional leading icon. Pass any React node — typically an SVG icon
   * or an emoji span. Hidden when `loading` is true.
   */
  icon?: React.ReactNode
}

// ── Style maps ────────────────────────────────────────────────────────────────

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-command-blue text-white border-transparent hover:bg-command-blue/90',
  secondary:
    'bg-surface-raised text-gray-200 border-surface-border hover:bg-surface-border',
  ghost:
    'bg-transparent text-gray-400 border-transparent hover:text-gray-100 hover:bg-surface-raised',
  danger:
    'bg-ember-red/15 text-ember-red border-ember-red/20 hover:bg-ember-red/25',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7  px-3   text-xs  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
  lg: 'h-11 px-6   text-base gap-2',
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant  = 'primary',
      size     = 'md',
      loading  = false,
      icon,
      children,
      disabled,
      className,
      type = 'button',
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        data-loading={loading || undefined}
        className={cn(
          // Base
          'inline-flex items-center justify-center font-medium rounded-lg border',
          'transition-colors duration-150 focus-visible:outline-none',
          'focus-visible:ring-2 focus-visible:ring-command-blue focus-visible:ring-offset-2',
          'focus-visible:ring-offset-iron-grey',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variant + size
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" className="text-current" aria-hidden />
        ) : icon != null ? (
          <span className="shrink-0 leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}

        {children != null && (
          <span className="leading-none">{children}</span>
        )}
      </button>
    )
  },
)
