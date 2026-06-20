import { http, HttpResponse } from 'msw'

const BASE = '/api/v1'

// Minimal trainer fixture — only the fields tests actually assert on.
export const trainerFixture = {
  id:                   'trainer-uuid-1',
  name:                 'Alex Smith',
  email:                'alex@example.com',
  role:                 'trainer',
  weightUnitPreference: 'kg',
  emailVerified:        false,
  lastLoginAt:          null,
  subscriptionTier:     'free',
  subscriptionStatus:   'active',
  onboardedAt:          '2024-01-01T00:00:00Z',
  trainerMode:          'trainer',
  reportsSentCount:     0,
  lastActiveAt:         null,
  ctaLabel:             'Start Training',
  alertsEnabled:        true,
  widgetProgression:    null,
  alertColorScheme:     'amber',
  alertTone:            'motivating',
  sessionLayout:        'vertical',
  weeklySessionTarget:  4,
  show1rmEstimate:      true,
  autoReportEnabled:    false,
  timezone:             'America/New_York',
  prNotifyType:         '1rm',
  restDurationSeconds:  90,
  photoSharingPreference: 'private',
  createdAt:            '2024-01-01T00:00:00Z',
  updatedAt:            '2024-01-01T00:00:00Z',
}

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ accessToken: 'test-access-token', trainer: trainerFixture })
  ),

  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ accessToken: 'refreshed-access-token', trainer: trainerFixture })
  ),

  http.post(`${BASE}/auth/logout`, () =>
    new HttpResponse(null, { status: 204 })
  ),

  // Clients
  http.get(`${BASE}/clients`, () =>
    HttpResponse.json({ clients: [], total: 0 })
  ),

  // Exercises
  http.get(`${BASE}/exercises`, () =>
    HttpResponse.json({ exercises: [], total: 0 })
  ),

  // Sessions
  http.get(`${BASE}/sessions`, () =>
    HttpResponse.json({ sessions: [], total: 0 })
  ),
]
