/**
 * cn — merge Tailwind class names safely.
 *
 * Combines clsx (conditional classes, arrays, objects) with
 * tailwind-merge (resolves conflicting Tailwind utilities so that
 * the last one wins, e.g. `p-4 p-8` → `p-8`).
 *
 * Usage:
 *   cn('px-4 py-2', isActive && 'bg-command-blue', className)
 *   cn({ 'opacity-50': disabled }, 'text-sm')
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge }               from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
