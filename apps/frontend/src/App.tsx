// ------------------------------------------------------------
// App.tsx — Root component and route definitions
//
// PHASE 4 ADDITIONS:
//   - /onboard route — shown once after registration when
//     trainer.onboardedAt is null. Sets trainerMode.
//   - OnboardingGate — redirects to /onboard if authenticated
//     but not yet onboarded. Sits between ProtectedRoute and Layout.
//   - /clients/:id route added for client profile page.
//
// ROUTE STRUCTURE:
//   /login              → LoginPage (public)
//   /onboard            → OnboardingPage (protected, pre-onboarding only)
//   /                   → Dashboard (protected, post-onboarding)
//   /clients            → Client list
//   /clients/:id        → Client profile
//   /exercises          → Exercise library
//   /sessions           → Session list
//   /templates          → Template list
// ------------------------------------------------------------

import { Navigate, Routes, Route }         from 'react-router-dom'
import { AuthProvider, ProtectedRoute }    from '@/components/auth/AuthProvider'
import { useAuthStore }                    from '@/store/authStore'
import Layout                              from '@/components/layout/Layout'
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
                </Layout>
              </OnboardingGate>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
