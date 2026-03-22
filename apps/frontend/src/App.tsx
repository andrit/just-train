// ------------------------------------------------------------
// App.tsx — Root component and route definitions (v2.0.0)
//
// SPA ARCHITECTURE:
//   Tabs (URL routes):  /  /clients  /exercises  /sessions  /templates
//   Panels (location.state): clientProfile, sessionSummary, sessionHistory
//   Overlays (store): live session (Spotify model)
//   Sheets (store): sessionLauncher
//
// AppShell sits inside Layout and manages panels + overlays.
// All navigation goes through navService (React Router now,
// RxJS observable stream in v2.3.0).
//
// URL ROUTES (kept for deep-linking + PWA fallback):
//   /login              → LoginPage (public)
//   /onboard            → OnboardingPage (protected, pre-onboarding)
//   /                   → Dashboard
//   /clients            → Client list (profiles open as panels)
//   /clients/:id        → ClientProfilePage (URL fallback only)
//   /exercises          → Exercise library
//   /sessions           → Session history list
//   /session/new        → SessionLauncherPage (URL fallback)
//   /session/:id        → LiveSessionPage (URL fallback)
//   /session/:id/summary → SessionSummaryPage
//   /session/:id/history → SessionHistoryPage
//   /templates          → Template list
// ------------------------------------------------------------

import { Navigate, Routes, Route }         from 'react-router-dom'
import { AuthProvider, ProtectedRoute }    from '@/components/auth/AuthProvider'
import { useAuthStore }                    from '@/store/authStore'
import Layout                              from '@/components/layout/Layout'
import { AppShell }                        from '@/components/shell/AppShell'
import LoginPage                           from '@/pages/LoginPage'
import OnboardingPage                      from '@/pages/OnboardingPage'
import DashboardPage                       from '@/pages/DashboardPage'
import ClientsPage                         from '@/pages/ClientsPage'
import ClientProfilePage                   from '@/pages/ClientProfilePage'
import ExercisesPage                       from '@/pages/ExercisesPage'
import SessionsPage                        from '@/pages/SessionsPage'
import TemplatesPage                       from '@/pages/TemplatesPage'
import PreferencesPage                     from '@/pages/PreferencesPage'
import SessionLauncherPage                 from '@/pages/SessionLauncherPage'
import LiveSessionPage                     from '@/pages/LiveSessionPage'
import SessionSummaryPage                  from '@/pages/SessionSummaryPage'
import SessionHistoryPage                  from '@/pages/SessionHistoryPage'
import NotFoundPage                        from '@/pages/NotFoundPage'

// ── Onboarding gate ───────────────────────────────────────────────────────────
// Sits between ProtectedRoute and Layout.
// If the trainer hasn't completed onboarding (onboardedAt is null),
// redirect to /onboard regardless of what route they tried to access.
// Once onboarded, /onboard itself redirects back to /.

function OnboardingGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const trainer = useAuthStore((s) => s.trainer)

  // Not yet onboarded — send to the mode selection screen
  if (trainer && !trainer.onboardedAt) {
    return <Navigate to="/onboard" replace />
  }

  return <>{children}</>
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Onboarding — protected but pre-layout */}
        <Route
          path="/onboard"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Main app — protected + onboarded */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <OnboardingGate>
                <Layout>
                  <AppShell>
                    <Routes>
                      <Route path="/"                        element={<DashboardPage />} />
                      <Route path="/clients"                 element={<ClientsPage />} />
                      <Route path="/clients/:id"             element={<ClientProfilePage />} />
                      <Route path="/exercises"               element={<ExercisesPage />} />
                      <Route path="/sessions"                element={<SessionsPage />} />
                      <Route path="/session/new"             element={<SessionLauncherPage />} />
                      <Route path="/session/:id"             element={<LiveSessionPage />} />
                      <Route path="/session/:id/summary"     element={<SessionSummaryPage />} />
                      <Route path="/session/:id/history"     element={<SessionHistoryPage />} />
                      <Route path="/templates"               element={<TemplatesPage />} />
                      <Route path="/preferences"             element={<PreferencesPage />} />
                      <Route path="*"                        element={<NotFoundPage />} />
                    </Routes>
                  </AppShell>
                </Layout>
              </OnboardingGate>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
