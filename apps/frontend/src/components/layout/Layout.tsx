// ------------------------------------------------------------
// components/layout/Layout.tsx — App shell with navigation
// Updated Phase 3.5: cn(), React.JSX.Element, typed nav items
// ------------------------------------------------------------

import { NavLink }         from 'react-router-dom'
import { cn }              from '@/lib/cn'
import { useSessionStore } from '@/store/sessionStore'
import { useOverlayStore } from '@/store/overlayStore'
import { useAuthStore }    from '@/store/authStore'
import { useSyncStatus }   from '@/hooks/useSyncStatus'
import { OfflineBanner }   from '@/components/shell/OfflineBanner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  path:  string
  label: string
  icon:  string
  end?:  boolean
}

interface LayoutProps {
  children: React.ReactNode
}

// ── Nav items ─────────────────────────────────────────────────────────────────

// Main nav items — shown in sidebar (desktop) and bottom tab bar (mobile)
// Preferences is excluded here on desktop — it lives in the user badge area instead.
// On mobile it appears in the bottom nav as the gear icon (last item).
const NAV_ITEMS: NavItem[] = [
  { path: '/',          label: 'Dashboard', icon: '⌂',  end: true },
  { path: '/sessions',  label: 'Sessions',  icon: '🏋️' },
  { path: '/clients',   label: 'Clients',   icon: '👥' },
  { path: '/exercises', label: 'Exercises', icon: '💪' },
  { path: '/templates', label: 'Templates', icon: '📄' },
]

// Mobile-only nav — includes Preferences as the gear icon
const MOBILE_NAV_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  { path: '/preferences', label: 'Prefs', icon: '⚙' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const { pending: pendingSyncCount } = useSyncStatus()
  const trainer          = useAuthStore((s) => s.trainer)
  const { state: overlayState } = useOverlayStore()
  const navHidden = overlayState === 'expanded'

  const initials = trainer?.name
    ? trainer.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="flex flex-col min-h-screen md:flex-row">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden md:flex md:flex-col md:w-56 md:min-h-screen bg-brand-accent border-r border-surface-border">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-surface-border flex items-center gap-2">
          <span className="font-display text-2xl tracking-wider uppercase">
            <span className="text-white">Trainer</span>
            <span className="text-brand-highlight">App</span>
          </span>
          {pendingSyncCount > 0 && (
            <span className="text-xs bg-amber-500 text-black rounded-full px-2 py-0.5 font-medium">
              {pendingSyncCount}
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
                  isActive
                    ? 'bg-brand-highlight text-white'
                    : 'text-gray-400 hover:bg-brand-primary/50 hover:text-gray-100',
                )
              }
            >
              <span className="text-base w-5 text-center" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User badge */}
        {trainer != null && (
          <div className="px-4 py-4 border-t border-surface-border">
            <div className="flex items-center gap-3 mb-3">
              <div
                aria-hidden
                className="w-8 h-8 rounded-full bg-brand-highlight/20 border border-brand-highlight/30 flex items-center justify-center shrink-0"
              >
                <span className="text-xs font-bold text-brand-highlight">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{trainer.name}</p>
                <p className="text-xs text-gray-500 truncate">{trainer.email}</p>
              </div>
            </div>
            <NavLink
              to="/preferences"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium w-full',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
                  isActive
                    ? 'bg-brand-highlight text-white'
                    : 'text-gray-500 hover:bg-brand-primary/50 hover:text-gray-300',
                )
              }
            >
              <span className="text-sm" aria-hidden>⚙</span>
              Preferences
            </NavLink>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 pb-20 md:pb-0 min-h-screen overflow-y-auto">
        <OfflineBanner />
        {children}
      </main>

      {/* ── Bottom tab bar (mobile) ───────────────────────────────────── */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 bg-brand-accent/95 backdrop-blur-sm border-t border-surface-border flex justify-around items-center safe-area-padding z-50",
          "transition-transform duration-300",
          navHidden && "translate-y-full",
        )}
        aria-label="Main navigation"
      >
        {MOBILE_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2.5 px-3',
                'text-xs font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
                isActive ? 'text-brand-highlight' : 'text-gray-500',
              )
            }
          >
            <span className="text-xl leading-none" aria-hidden>{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  )
}
