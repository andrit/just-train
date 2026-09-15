// ------------------------------------------------------------
// security/mass-assignment.test.ts — a caller can never set privileged fields
// on themselves (or on rows they create) through a request body.
//
// Routes spread the parsed body into the DB write (`.set({ ...body })`), so
// the input schemas ARE the allow-list. Zod objects strip unknown keys by
// default; this test pins that behaviour for the fields that matter and fails
// if any privileged key is ever added to an input schema.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import {
  CreateTrainerSchema, UpdateTrainerSchema, OnboardTrainerSchema,
  CreateClientSchema, UpdateClientSchema, CreateSessionSchema,
} from '@trainer-app/shared'

// Fields a user must never be able to write about themselves or smuggle onto a row.
const PRIVILEGED = {
  role:               'admin',
  subscriptionTier:   'studio',
  subscriptionStatus: 'active',
  emailVerified:      true,
  trainerId:          '99999999-9999-9999-9999-999999999999',
  isSelf:             true,
  id:                 '99999999-9999-9999-9999-999999999999',
  passwordHash:       '$argon2id$x',
}

function assertStripped(name: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } }, valid: Record<string, unknown>) {
  const result = schema.safeParse({ ...valid, ...PRIVILEGED })
  expect(result.success, `${name} rejected an otherwise-valid body`).toBe(true)
  for (const key of Object.keys(PRIVILEGED)) {
    expect(result.data as object, `${name} let "${key}" through`).not.toHaveProperty(key)
  }
}

describe('mass-assignment — privileged fields never survive input parsing', () => {
  it('CreateTrainerSchema (register)', () => {
    assertStripped('CreateTrainerSchema', CreateTrainerSchema, { name: 'A', email: 'a@b.co', password: 'correct-horse-battery' })
  })
  it('UpdateTrainerSchema (PATCH /auth/me)', () => {
    assertStripped('UpdateTrainerSchema', UpdateTrainerSchema, { name: 'A' })
  })
  it('OnboardTrainerSchema (POST /auth/onboard)', () => {
    assertStripped('OnboardTrainerSchema', OnboardTrainerSchema, { trainerMode: 'athlete' })
  })
  it('CreateClientSchema / UpdateClientSchema', () => {
    assertStripped('CreateClientSchema', CreateClientSchema, { name: 'C' })
    assertStripped('UpdateClientSchema', UpdateClientSchema, { name: 'C' })
  })
  it('CreateSessionSchema', () => {
    assertStripped('CreateSessionSchema', CreateSessionSchema, { clientId: '22222222-2222-2222-2222-222222222222', date: '2026-09-15' })
  })
})
