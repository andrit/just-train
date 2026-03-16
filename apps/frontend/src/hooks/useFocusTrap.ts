/**
 * useFocusTrap — trap Tab/Shift+Tab focus inside a container element.
 *
 * When `active`, keyboard focus cycles through only the focusable
 * descendants of the ref'd container. Essential for modals and drawers
 * so keyboard/screen-reader users can't accidentally navigate behind
 * the overlay.
 *
 * Also restores focus to the previously focused element when deactivated,
 * so users return to where they triggered the overlay.
 *
 * @param containerRef - Ref pointing to the overlay's root element
 * @param active       - Whether trapping is active (equals `open`)
 *
 * @example
 *   const panelRef = useRef<HTMLDivElement>(null)
 *   useFocusTrap(panelRef, isOpen)
 */

import { useEffect, useRef } from 'react'

/** CSS selector for all natively focusable elements */
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details > summary',
].join(', ')

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean,
): void {
  // Store the element that was focused before the trap activated
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    // Save the currently focused element so we can restore it on close
    previousFocusRef.current = document.activeElement as HTMLElement

    // Move focus into the container on open (first focusable element)
    const container = containerRef.current
    if (container) {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTORS)
      firstFocusable?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      ).filter((el) => !el.closest('[aria-hidden="true"]'))

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstEl = focusableElements[0]
      const lastEl  = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === firstEl) {
          event.preventDefault()
          lastEl?.focus()
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === lastEl) {
          event.preventDefault()
          firstEl?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the previously focused element when trap deactivates
      previousFocusRef.current?.focus()
    }
  }, [active, containerRef])
}
