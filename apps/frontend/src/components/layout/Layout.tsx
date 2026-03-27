// ------------------------------------------------------------
// components/layout/Layout.tsx — App shell with navigation
// Updated v2.7.0: fixed sidebar, mode-aware nav, logout button
// ------------------------------------------------------------

import { NavLink, useNavigate }  from 'react-router-dom'
import { useQueryClient }        from '@tanstack/react-query'
import { cn }              from '@/lib/cn'
import { useOverlayStore } from '@/store/overlayStore'
import { useAuthStore }    from '@/store/authStore'
import { useSyncStatus }   from '@/hooks/useSyncStatus'
import { usePreferences }  from '@/hooks/usePreferences'
import { OfflineBanner }   from '@/components/shell/OfflineBanner'
import { ToastContainer }  from '@/components/ui/ToastContainer'
import { apiClient }       from '@/lib/api'

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

const TRAINER_NAV: NavItem[] = [
  { path: '/',          label: 'Dashboard', icon: '⌂',  end: true },
  { path: '/sessions',  label: 'Sessions',  icon: '🏋️' },
  { path: '/clients',   label: 'Clients',   icon: '👥' },
  { path: '/exercises', label: 'Exercises', icon: '💪' },
  { path: '/templates', label: 'Templates', icon: '📄' },
]

function athleteNav(): NavItem[] {
  return [
    { path: '/',             label: 'Dashboard',   icon: '⌂', end: true },
    { path: '/sessions',     label: 'Sessions',    icon: '🏋️' },
    { path: '/my-training',  label: 'My Training', icon: '💪' },
    { path: '/exercises',    label: 'Exercises',   icon: '🔬' },
    { path: '/templates',    label: 'Templates',   icon: '📄' },
  ]
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const { pending: pendingSyncCount } = useSyncStatus()
  const trainer          = useAuthStore((s) => s.trainer)
  const clearAuth        = useAuthStore((s) => s.clearAuth)
  const { trainerMode }  = usePreferences()
  const { state: overlayState } = useOverlayStore()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const navHidden = overlayState === 'expanded'

  const isAthlete = trainerMode === 'athlete'
  const navItems  = isAthlete ? athleteNav() : TRAINER_NAV

  // Mobile nav always includes Preferences
  const mobileNavItems: NavItem[] = [
    ...navItems,
    { path: '/preferences', label: 'Prefs', icon: '⚙' },
  ]

  const initials = trainer?.name
    ? trainer.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleLogout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {})
    } catch {
      // Even if the server call fails, clear local auth
    } finally {
      qc.clear()          // wipe all cached data so next login starts fresh
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex flex-col min-h-screen md:flex-row">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      {/* fixed: always viewport height, never grows with content */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 bg-brand-accent border-r border-surface-border z-20">

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
          {navItems.map((item) => (
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

        {/* User badge + preferences + logout */}
        {trainer != null && (
          <div className="px-4 py-4 border-t border-surface-border space-y-1">
            <div className="flex items-center gap-3 mb-2">
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
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium w-full',
                'text-gray-500 hover:bg-red-500/10 hover:text-red-400',
                'transition-colors duration-150',
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Log out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 pb-20 md:pb-0 md:ml-56 min-h-screen overflow-y-auto">
        <OfflineBanner />
        {children}
      </main>

      <ToastContainer />

      {/* ── Bottom tab bar (mobile) ───────────────────────────────────── */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 bg-brand-accent/95 backdrop-blur-sm border-t border-surface-border flex justify-around items-center safe-area-padding z-50",
          "transition-transform duration-300",
          navHidden && "translate-y-full",
        )}
        aria-label="Main navigation"
      >
        {mobileNavItems.map((item) => (
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
