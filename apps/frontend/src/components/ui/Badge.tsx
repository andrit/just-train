/**
 * Badge — a small inline label for status, category, or count.
 *
 * Uses a `<span>` so it flows naturally within text or flex containers.
 * Five semantic colour variants map to common status meanings.
 */

import { cn } from '@/lib/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps {
  /** Semantic colour variant. Defaults to `"default"`. */
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

// ── Style map ─────────────────────────────────────────────────────────────────

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-raised text-gray-300 border-surface-border',
  success: 'bg-green-500/15  text-green-400  border-green-500/20',
  warning: 'bg-amber-500/15  text-amber-400  border-amber-500/20',
  danger:  'bg-red-500/15    text-red-400    border-red-500/20',
  info:    'bg-sky-500/15    text-sky-400    border-sky-500/20',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        'text-xs font-medium leading-none',
        'px-2 py-1 rounded-full border',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
