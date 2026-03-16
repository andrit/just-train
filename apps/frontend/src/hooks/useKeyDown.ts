/**
 * useKeyDown — attach a keyboard handler while a condition is true.
 *
 * Cleans up the event listener automatically on unmount or when
 * `enabled` changes. Prevents the common bug of forgetting to
 * return the cleanup function from useEffect.
 *
 * @param key     - Key to listen for (e.g. 'Escape', 'Enter')
 * @param handler - Function to call when the key is pressed
 * @param enabled - Only attach the listener when true (default: true)
 *
 * @example
 *   useKeyDown('Escape', onClose, isOpen)
 */

import { useEffect } from 'react'

export function useKeyDown(
  key:     string,
  handler: (event: KeyboardEvent) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: KeyboardEvent): void => {
      if (event.key === key) handler(event)
    }

    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [key, handler, enabled])
}
