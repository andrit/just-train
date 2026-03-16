/**
 * Select — a styled native `<select>` with label, error, typed options, and
 * an optional placeholder (empty first option).
 *
 * Prefers the native `<select>` over a custom dropdown for three reasons:
 *   1. Mobile — native selects use the OS picker (much better UX on phones)
 *   2. Accessibility — native selects have full keyboard/screen-reader support
 *   3. Simplicity — no floating positioning, focus management, or ARIA roles
 *
 * A custom combobox can be introduced later (Phase 5+) for searchable selects.
 */

import { forwardRef, useId } from 'react'
import { cn }                from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
  /** Renders the option as disabled. */
  disabled?: boolean
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  /** Text label rendered above the select. */
  label?: string
  /** Error message. When set, the select gets `aria-invalid` and red styling. */
  error?: string
  /** The list of options to render. */
  options: SelectOption[]
  /**
   * If provided, renders an initial empty option with this text.
   * Its value is always `""` — useful as a "please choose…" prompt.
   */
  placeholder?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, error, options, placeholder, className, id, ...props },
    ref,
  ) {
    const generatedId = useId()
    const inputId     = id ?? generatedId
    const errorId     = `${inputId}-error`
    const hasError    = error != null && error.length > 0

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

        <select
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          aria-required={props.required}
          className={cn(
            'field appearance-none cursor-pointer',
            hasError && 'border-red-500',
            className,
          )}
          {...props}
        >
          {placeholder != null && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {hasError && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  },
)
