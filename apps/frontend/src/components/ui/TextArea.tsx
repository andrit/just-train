/**
 * TextArea — a styled multi-line text input with label, error, and hint.
 *
 * Mirrors the Input component's API exactly so the two are interchangeable
 * in forms. Uses `forwardRef` for React Hook Form compatibility and `useId`
 * for stable, SSR-safe label associations.
 */

import { forwardRef, useId } from 'react'
import { cn }                from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Text label rendered above the textarea. */
  label?: string
  /** Error message. When set, the textarea gets `aria-invalid` and red styling. */
  error?: string
  /** Subtle helper text shown below the textarea when no error is present. */
  hint?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, error, hint, className, id, ...props }, ref) {
    const generatedId = useId()
    const inputId     = id ?? generatedId
    const errorId     = `${inputId}-error`
    const hintId      = `${inputId}-hint`
    const hasError    = error != null && error.length > 0
    const hasHint     = !hasError && hint != null && hint.length > 0
    const describedBy = hasError ? errorId : hasHint ? hintId : undefined

    return (
      <div className="w-full">
        {label != null && (
          <label htmlFor={inputId} className="field-label">
            {label}
            {props.required && (
              <span className="text-brand-highlight ml-0.5" aria-hidden>
                *
              </span>
            )}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          aria-required={props.required}
          className={cn(
            'field resize-none',
            hasError && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
            className,
          )}
          {...props}
        />

        {hasError && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-400">
            {error}
          </p>
        )}

        {hasHint && (
          <p id={hintId} className="mt-1.5 text-xs text-gray-500">
            {hint}
          </p>
        )}
      </div>
    )
  },
)
