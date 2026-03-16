/**
 * Input — a styled text input with label, error, and hint support.
 *
 * Uses `forwardRef` for React Hook Form compatibility.
 * Uses `useId` to generate unique IDs so label/error/hint associations
 * are stable across renders and SSR-safe.
 */

import { forwardRef, useId } from 'react'
import { cn }                from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Text label rendered above the input. */
  label?: string
  /** Error message. When set, the input gets `aria-invalid` and red styling. */
  error?: string
  /** Subtle helper text below the input. Only shown when `error` is absent. */
  hint?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className, id, ...props }, ref) {
    const generatedId  = useId()
    const inputId      = id ?? generatedId
    const errorId      = `${inputId}-error`
    const hintId       = `${inputId}-hint`
    const hasError     = error != null && error.length > 0
    const hasHint      = !hasError && hint != null && hint.length > 0
    const describedBy  = hasError ? errorId : hasHint ? hintId : undefined

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

        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          aria-required={props.required}
          className={cn(
            'field',
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
