import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore }                      from '@/store/authStore'
import type { TrainerResponse }              from '@trainer-app/shared'

const mockTrainer: TrainerResponse = {
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

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken:     null,
      trainer:         null,
      isInitializing:  true,
      isAuthenticated: false,
    })
  })

  it('starts with null token, null trainer, initializing, not authenticated', () => {
    const s = useAuthStore.getState()
    expect(s.accessToken).toBeNull()
    expect(s.trainer).toBeNull()
    expect(s.isInitializing).toBe(true)
    expect(s.isAuthenticated).toBe(false)
  })

  describe('setAuth', () => {
    it('stores the token and trainer, marks authenticated and done initializing', () => {
      useAuthStore.getState().setAuth('tok-abc', mockTrainer)
      const s = useAuthStore.getState()
      expect(s.accessToken).toBe('tok-abc')
      expect(s.trainer).toEqual(mockTrainer)
      expect(s.isAuthenticated).toBe(true)
      expect(s.isInitializing).toBe(false)
    })
  })

  describe('clearAuth', () => {
    it('wipes token, trainer, and authenticated flag without starting initializing again', () => {
      useAuthStore.getState().setAuth('tok-abc', mockTrainer)
      useAuthStore.getState().clearAuth()
      const s = useAuthStore.getState()
      expect(s.accessToken).toBeNull()
      expect(s.trainer).toBeNull()
      expect(s.isAuthenticated).toBe(false)
      expect(s.isInitializing).toBe(false)
    })
  })

  describe('setTrainer', () => {
    it('updates the trainer profile without touching the access token', () => {
      useAuthStore.getState().setAuth('tok-abc', mockTrainer)
      const updated = { ...mockTrainer, name: 'Updated Name' }
      useAuthStore.getState().setTrainer(updated)
      const s = useAuthStore.getState()
      expect(s.accessToken).toBe('tok-abc')
      expect(s.trainer?.name).toBe('Updated Name')
    })
  })

  describe('setInitializing', () => {
    it('can be toggled independently', () => {
      useAuthStore.getState().setInitializing(false)
      expect(useAuthStore.getState().isInitializing).toBe(false)
      useAuthStore.getState().setInitializing(true)
      expect(useAuthStore.getState().isInitializing).toBe(true)
    })
  })
})
