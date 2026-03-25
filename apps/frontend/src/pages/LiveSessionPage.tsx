// ------------------------------------------------------------
// pages/LiveSessionPage.tsx — /session/:id (v2.0.0)
//
// URL-addressable fallback for the live session screen.
// Used when navigating directly to /session/:id (deep link,
// PWA launch from session URL, or back-compat navigation).
//
// In normal SPA flow, the session runs inside ActiveSessionOverlay.
// This page delegates to LiveSessionContent using the route param.
// ------------------------------------------------------------

import { useParams, useNavigate } from 'react-router-dom'
import { useEffect }               from 'react'
import { useSessionStore }         from '@/store/sessionStore'
import { useOverlayStore }         from '@/store/overlayStore'
import LiveSessionContent          from '@/components/shell/LiveSessionContent'

export default function LiveSessionPage(): React.JSX.Element {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { activeSessions } = useSessionStore()
  const { expand, state }  = useOverlayStore()

  // If the overlay is already expanded with this session, redirect home
  // so we don't have two session UIs at once
  useEffect(() => {
    if (!id) return
    // Find which client owns this session
    const ownerClientId = Object.values(activeSessions).find(
      s => s.sessionId === id
    )?.clientId

    if (ownerClientId && state !== 'expanded') {
      expand(ownerClientId)
    }
  }, [id, activeSessions, state, expand])

  if (!id) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Invalid session.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 text-sm text-brand-highlight hover:underline">
          Go home
        </button>
      </div>
    )
  }

  return <LiveSessionContent sessionId={id} />
}
