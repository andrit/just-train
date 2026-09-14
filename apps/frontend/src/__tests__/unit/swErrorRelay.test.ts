import { describe, it, expect, vi } from 'vitest'

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

import * as Sentry from '@sentry/react'
import { isSwErrorMessage, swErrorToError, reportSwError } from '@/lib/swErrorRelay'

describe('swErrorRelay', () => {
  it('recognises only SW_ERROR messages with a string message', () => {
    expect(isSwErrorMessage({ type: 'SW_ERROR', kind: 'error', message: 'x' })).toBe(true)
    expect(isSwErrorMessage({ type: 'FLUSH_QUEUE' })).toBe(false)
    expect(isSwErrorMessage({ type: 'SW_ERROR' })).toBe(false)
    expect(isSwErrorMessage(null)).toBe(false)
    expect(isSwErrorMessage('SW_ERROR')).toBe(false)
  })

  it('rebuilds an Error carrying the worker stack and a kind-specific name', () => {
    const err = swErrorToError({ type: 'SW_ERROR', kind: 'unhandledrejection', message: 'boom', stack: 'Error: boom\n    at sw.js:1:1' })
    expect(err.message).toBe('boom')
    expect(err.name).toBe('ServiceWorkerRejection')
    expect(err.stack).toBe('Error: boom\n    at sw.js:1:1')
    expect(swErrorToError({ type: 'SW_ERROR', kind: 'error', message: 'x' }).name).toBe('ServiceWorkerError')
  })

  it('reports with the service-worker tag and location extras', () => {
    reportSwError({ type: 'SW_ERROR', kind: 'error', message: 'boom', filename: 'sw.js', lineno: 12 })
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [err, ctx] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, { tags: unknown; extra: unknown }]
    expect(err.message).toBe('boom')
    expect(ctx.tags).toEqual({ source: 'service-worker' })
    expect(ctx.extra).toEqual({ filename: 'sw.js', lineno: 12 })
  })
})
