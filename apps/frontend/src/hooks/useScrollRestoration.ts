// ------------------------------------------------------------
// hooks/useScrollRestoration.ts — Exact scroll position save/restore (v1.5.1)
//
// Stores scroll position before navigating away and restores it
// on return. Works with React Router's location.state to pass
// the scroll key between pages.
//
// USAGE (on the page you want to restore):
//   const { saveScroll } = useScrollRestoration('client-profile-jordan')
//
//   // Before navigating away:
//   <button onClick={() => {
//     saveScroll()
//     navigate(`/session/${id}/history`, { state: { scrollKey: 'client-profile-jordan' } })
//   }}>
//
// USAGE (on the page you're returning from):
//   useRestoreScroll()   ← call once at top of the destination page
//
// HOW IT WORKS:
//   saveScroll() writes window.scrollY to sessionStorage under a key.
//   On return, useRestoreScroll() reads location.state.scrollKey,
//   finds the saved Y, and restores it after the page renders.
//   sessionStorage survives navigation but not tab close.
// ------------------------------------------------------------

import { useCallback, useEffect }  from 'react'
import { useLocation } from 'react-router-dom'

const STORAGE_PREFIX = 'scroll_restore_'

// ── Save scroll before navigating away ───────────────────────────────────────

export function useScrollRestoration(key: string): {
  saveScroll: () => void
} {
  const saveScroll = useCallback((): void => {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, String(window.scrollY))
  }, [key])

  return { saveScroll }
}

// ── Restore scroll on return ─────────────────────────────────────────────────

export function useRestoreScroll(): void {
  const location = useLocation()

  useEffect(() => {
    const scrollKey = (location.state as { scrollKey?: string } | null)?.scrollKey
    if (!scrollKey) return

    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${scrollKey}`)
    if (!stored) return

    const y = parseInt(stored, 10)
    if (isNaN(y)) return

    // Attempt scroll immediately after paint, then retry a few times to
    // handle async data loading (e.g. timeline tab content renders after fetch).
    // Once we reach the target Y we stop retrying.
    let attempts = 0
    const MAX_ATTEMPTS = 8
    const INTERVAL_MS  = 80

    const tryScroll = (): void => {
      window.scrollTo({ top: y, behavior: 'instant' })
      attempts++

      if (Math.abs(window.scrollY - y) < 10 || attempts >= MAX_ATTEMPTS) {
        // Close enough or gave up — clean up
        sessionStorage.removeItem(`${STORAGE_PREFIX}${scrollKey}`)
        return
      }

      // Content may not have rendered yet — retry
      setTimeout(tryScroll, INTERVAL_MS)
    }

    requestAnimationFrame(tryScroll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])
}
