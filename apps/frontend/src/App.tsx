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

import { lazy, Suspense }                  from 'react'
import { Navigate, Routes, Route }         from 'react-router-dom'
import { AuthProvider, ProtectedRoute }    from '@/components/auth/AuthProvider'
import { useAuthStore }                    from '@/store/authStore'
import { usePreferences }                  from '@/hooks/usePreferences'
import Layout                              from '@/components/layout/Layout'
import { AppShell }                        from '@/components/shell/AppShell'
import { Spinner }                         from '@/components/ui/Spinner'

// Route-level code splitting — each page loads only when first navigated to.
// AuthProvider and Layout are kept eager since they render on every route.
const LoginPage           = lazy(() => import('@/pages/LoginPage'))
const OnboardingPage      = lazy(() => import('@/pages/OnboardingPage'))
const VerifyEmailPage     = lazy(() => import('@/pages/VerifyEmailPage'))
const PrivacyPage         = lazy(() => import('@/pages/PrivacyPage'))
const TermsPage           = lazy(() => import('@/pages/TermsPage'))
const DashboardPage       = lazy(() => import('@/pages/DashboardPage'))
const ClientsPage         = lazy(() => import('@/pages/ClientsPage'))
const ClientProfilePage   = lazy(() => import('@/pages/ClientProfilePage'))
const ExercisesPage       = lazy(() => import('@/pages/ExercisesPage'))
const SessionsPage        = lazy(() => import('@/pages/SessionsPage'))
const TemplatesPage       = lazy(() => import('@/pages/TemplatesPage'))
const PreferencesPage     = lazy(() => import('@/pages/PreferencesPage'))
const SessionLauncherPage = lazy(() => import('@/pages/SessionLauncherPage'))
const LiveSessionPage     = lazy(() => import('@/pages/LiveSessionPage'))
const SessionSummaryPage  = lazy(() => import('@/pages/SessionSummaryPage'))
const SessionHistoryPage  = lazy(() => import('@/pages/SessionHistoryPage'))
const MyTrainingPage      = lazy(() => import('@/pages/MyTrainingPage'))
const NotFoundPage        = lazy(() => import('@/pages/NotFoundPage'))

function PageFallback(): React.JSX.Element {
  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Spinner size="lg" className="text-command-blue" />
    </div>
  )
}

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

// ── Athlete route guard ────────────────────────────────────────────────────────
// Policy P1 (user-flow.md): athletes who navigate directly to /clients or
// /clients/:id are redirected to / rather than seeing a 403 or trainer UI.

function AthleteRouteGuard({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { trainerMode } = usePreferences()

  if (trainerMode === 'athlete') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public */}
        <Route path="/login"        element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/privacy"      element={<PrivacyPage />} />
        <Route path="/terms"        element={<TermsPage />} />

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
                      <Route path="/clients"                 element={<AthleteRouteGuard><ClientsPage /></AthleteRouteGuard>} />
                      <Route path="/clients/:id"             element={<AthleteRouteGuard><ClientProfilePage /></AthleteRouteGuard>} />
                      <Route path="/my-training"             element={<MyTrainingPage />} />
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
      </Suspense>
    </AuthProvider>
  )
}
