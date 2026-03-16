// ------------------------------------------------------------
// helpers/factories.ts — Test data factories
//
// Provides builder functions for common test objects.
// Each factory has sensible defaults and accepts overrides.
//
// USAGE:
//   const trainer  = makeTrainer()
//   const client   = makeClient({ isSelf: true })
//   const goal     = makeClientGoal({ achievedAt: new Date() })
//   const snapshot = makeClientSnapshot({ weightLbs: 185 })
// ------------------------------------------------------------

import type { Trainer, Client, RefreshToken, ClientGoal, ClientSnapshot } from '../../db/schema'

// Stable test IDs — using fixed UUIDs makes test output easier to read
export const TEST_TRAINER_ID  = '11111111-1111-1111-1111-111111111111'
export const TEST_CLIENT_ID   = '22222222-2222-2222-2222-222222222222'
export const TEST_TOKEN_ID    = '33333333-3333-3333-3333-333333333333'
export const TEST_DEVICE_ID   = '44444444-4444-4444-4444-444444444444'
export const TEST_UNKNOWN_ID  = '99999999-9999-9999-9999-999999999999'
export const TEST_GOAL_ID     = '55555555-5555-5555-5555-555555555555'
export const TEST_SNAPSHOT_ID = '66666666-6666-6666-6666-666666666666'

// ── Trainer ───────────────────────────────────────────────────────────────────

export function makeTrainer(overrides: Partial<Trainer> = {}): Trainer {
  return {
    id:                   TEST_TRAINER_ID,
    name:                 'Test Trainer',
    email:                'trainer@example.com',
    passwordHash:         '$argon2id$v=19$m=65536,t=3,p=1$test-hash',
    role:                 'trainer',
    weightUnitPreference: 'lbs',
    emailVerified:        false,
    lastLoginAt:          null,
    // Phase 3C
    subscriptionTier:     'free',
    subscriptionStatus:   'trialing',
    onboardedAt:          null,
    // Phase 3D
    trainerMode:          'trainer',
    reportsSentCount:     0,
    lastActiveAt:         null,
    // Phase 4 preferences
    ctaLabel:             'Start Training',
    alertsEnabled:        true,
    widgetProgression:    null,
    alertColorScheme:     'amber',
    alertTone:            'clinical',
    sessionLayout:        'horizontal',
    createdAt:            new Date('2025-01-01T00:00:00Z'),
    updatedAt:            new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id:               TEST_CLIENT_ID,
    trainerId:        TEST_TRAINER_ID,
    name:             'Test Client',
    email:            'client@example.com',
    phone:            null,
    photoUrl:         null,
    dateOfBirth:      null,
    goals:            null,
    notes:            null,
    active:           true,
    // Phase 3C
    primaryFocus:     null,
    secondaryFocus:   null,
    progressionState: 'assessment',
    startDate:        null,
    caloricGoal:      null,
    nutritionNotes:   null,
    isSelf:           false,
    lastActiveAt:     null,
    createdAt:        new Date('2025-01-01T00:00:00Z'),
    updatedAt:        new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

export function makeSelfClient(overrides: Partial<Client> = {}): Client {
  return makeClient({ isSelf: true, name: 'Test Trainer', email: 'trainer@example.com', ...overrides })
}

// ── Client Goal ───────────────────────────────────────────────────────────────

export function makeClientGoal(overrides: Partial<ClientGoal> = {}): ClientGoal {
  return {
    id:               TEST_GOAL_ID,
    clientId:         TEST_CLIENT_ID,
    goal:             'Run a 5K in under 30 minutes',
    progressionState: 'programming',
    setAt:            new Date('2025-01-01T00:00:00Z'),
    achievedAt:       null,
    createdAt:        new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ── Client Snapshot ───────────────────────────────────────────────────────────

export function makeClientSnapshot(overrides: Partial<ClientSnapshot> = {}): ClientSnapshot {
  return {
    id:               TEST_SNAPSHOT_ID,
    clientId:         TEST_CLIENT_ID,
    capturedAt:       new Date('2025-01-01T00:00:00Z'),
    capturedBy:       TEST_TRAINER_ID,
    progressionState: 'assessment',
    weightLbs:        185,
    heightIn:         70,
    bodyFatPct:       null,
    leanMuscleMassLbs: null,
    bmi:              null,
    waistIn:          null, hipsIn: null, chestIn: null,
    bicepsLeftIn: null, bicepsRightIn: null,
    quadsLeftIn: null, quadsRightIn: null,
    calvesLeftIn: null, calvesRightIn: null,
    restingHeartRateBpm: null,
    bloodPressureSystolic: null, bloodPressureDiastolic: null,
    vo2MaxEstimate: null,
    maxPushUps: null, maxPullUps: null, plankDurationSecs: null,
    mileTimeSecs: null, sitAndReachIn: null,
    gripStrengthLeftLbs: null, gripStrengthRightLbs: null,
    energyLevel: 7, sleepQuality: 6, stressLevel: 4,
    mobilityFeel: 7, selfImageScore: 6,
    trainerNotes: null,
    clientNotes:  null,
    createdAt:    new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ── Refresh Token ─────────────────────────────────────────────────────────────

export function makeRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id:          TEST_TOKEN_ID,
    trainerId:   TEST_TRAINER_ID,
    tokenHash:   '$argon2id$v=19$m=65536,t=3,p=1$test-token-hash',
    deviceId:    TEST_DEVICE_ID,
    deviceName:  'Test Browser',
    expiresAt:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt:   null,
    createdAt:   new Date('2025-01-01T00:00:00Z'),
    lastUsedAt:  null,
    ...overrides,
  }
}

// ── Valid request bodies ──────────────────────────────────────────────────────

export const validRegisterBody = {
  name:     'Test Trainer',
  email:    'trainer@example.com',
  password: 'securepassword123',
}

export const validLoginBody = {
  email:    'trainer@example.com',
  password: 'securepassword123',
}

export const validClientBody = {
  name:  'Test Client',
  email: 'client@example.com',
  phone: '555-1234',
  goals: 'Lose weight and build strength',
}

export const validClientBodyWithFocus = {
  ...validClientBody,
  primaryFocus:     'resistance',
  progressionState: 'assessment',
  startDate:        '2025-01-01',
}

export const validGoalBody = {
  goal: 'Run a 5K in under 30 minutes',
}

export const validSnapshotBody = {
  weightLbs:    185,
  heightIn:     70,
  energyLevel:  7,
  sleepQuality: 6,
  stressLevel:  4,
}
