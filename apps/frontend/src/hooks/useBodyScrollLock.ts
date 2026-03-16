/**
 * useBodyScrollLock — locks the document body scroll while `locked` is true.
 *
 * Used by Modal and Drawer to prevent the background page from scrolling
 * while an overlay is open. Stores and restores the original overflow style
 * so nested locks don't interfere with each other.
 *
 * @param locked - Whether to lock scroll (typically equals `open`)
 *
 * @example
 *   useBodyScrollLock(isOpen)
 */

import { useEffect } from 'react'

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return

    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}
