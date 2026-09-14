// ------------------------------------------------------------
// lib/sentry.test.ts — the helpers must be inert without a DSN and forward
// exactly the right things with one. Module state (`enabled`) means each case
// gets a fresh import.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/node', () => ({
  init:                     vi.fn(),
  captureException:         vi.fn(),
  setUser:                  vi.fn(),
  setupFastifyErrorHandler: vi.fn(),
  withMonitor:              vi.fn(async (_slug: string, fn: () => Promise<unknown>) => fn()),
}))

async function load(dsn?: string) {
  vi.resetModules()
  if (dsn) process.env.SENTRY_DSN = dsn
  else delete process.env.SENTRY_DSN
  const Sentry = await import('@sentry/node')
  const mod    = await import('../../lib/sentry')
  return { Sentry, mod }
}

describe('lib/sentry', () => {
  const originalDsn = process.env.SENTRY_DSN
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN
    else process.env.SENTRY_DSN = originalDsn
  })

  describe('without SENTRY_DSN', () => {
    it('does not initialise and reports disabled', async () => {
      const { Sentry, mod } = await load()
      mod.initSentry()
      expect(Sentry.init).not.toHaveBeenCalled()
      expect(mod.isSentryEnabled()).toBe(false)
    })

    it('captureError / setSentryUser / attach are inert', async () => {
      const { Sentry, mod } = await load()
      mod.initSentry()
      mod.captureError(new Error('boom'))
      mod.setSentryUser('t-1')
      mod.attachSentryErrorHandler({} as never)
      expect(Sentry.captureException).not.toHaveBeenCalled()
      expect(Sentry.setUser).not.toHaveBeenCalled()
      expect(Sentry.setupFastifyErrorHandler).not.toHaveBeenCalled()
    })

    it('withCronMonitor runs the job directly, no monitor', async () => {
      const { Sentry, mod } = await load()
      mod.initSentry()
      const fn = vi.fn(async () => 42)
      await expect(mod.withCronMonitor('slug', '0 * * * *', fn)).resolves.toBe(42)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(Sentry.withMonitor).not.toHaveBeenCalled()
    })
  })

  describe('with SENTRY_DSN', () => {
    it('initialises once with the DSN and environment', async () => {
      const { Sentry, mod } = await load('https://k@o.ingest.sentry.io/1')
      mod.initSentry()
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
        dsn: 'https://k@o.ingest.sentry.io/1',
        tracesSampleRate: 0.05,
      }))
      expect(mod.isSentryEnabled()).toBe(true)
    })

    it('pins sendDefaultPii off and scrubs body, cookies and query from request context', async () => {
      const { Sentry, mod } = await load('https://k@o.ingest.sentry.io/1')
      mod.initSentry()
      const opts = vi.mocked(Sentry.init).mock.calls[0]?.[0] as { sendDefaultPii: boolean; beforeSend: (e: any) => any }
      expect(opts.sendDefaultPii).toBe(false)
      const scrubbed = opts.beforeSend({
        request: { url: 'https://api/x/sessions?search=secret', data: { weight: 100 }, cookies: { rt: 'x' }, query_string: 'search=secret', headers: { 'user-agent': 'ua' } },
      })
      expect(scrubbed.request).toEqual({ url: 'https://api/x/sessions', headers: { 'user-agent': 'ua' } })
    })

    it('forwards Error instances only, with the route context as an extra', async () => {
      const { Sentry, mod } = await load('https://k@o.ingest.sentry.io/1')
      mod.initSentry()
      const err = new Error('boom')
      mod.captureError(err, 'sessions:create')
      mod.captureError('a string')            // routes sometimes log strings — not an event
      mod.captureError({ err })                // nor objects
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException).toHaveBeenCalledWith(err, { extra: { context: 'sessions:create' } })
    })

    it('tags the trainer and attaches the Fastify handler', async () => {
      const { Sentry, mod } = await load('https://k@o.ingest.sentry.io/1')
      mod.initSentry()
      mod.setSentryUser('t-1')
      const app = {}
      mod.attachSentryErrorHandler(app as never)
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 't-1' })
      expect(Sentry.setupFastifyErrorHandler).toHaveBeenCalledWith(app)
    })

    it('wraps the job in a crontab monitor that mirrors the schedule', async () => {
      const { Sentry, mod } = await load('https://k@o.ingest.sentry.io/1')
      mod.initSentry()
      const fn = vi.fn(async () => 'ok')
      await expect(mod.withCronMonitor('scheduler-hourly', '0 * * * *', fn)).resolves.toBe('ok')
      expect(Sentry.withMonitor).toHaveBeenCalledWith('scheduler-hourly', fn, expect.objectContaining({
        schedule: { type: 'crontab', value: '0 * * * *' },
        timezone: 'UTC',
      }))
    })
  })
})

describe('routeLog(app).error forwards to Sentry', () => {
  it('captures the Error and still logs it', async () => {
    vi.resetModules()
    process.env.SENTRY_DSN = 'https://k@o.ingest.sentry.io/1'
    const Sentry = await import('@sentry/node')
    const { initSentry } = await import('../../lib/sentry')
    const { routeLog }   = await import('../../lib/logger')
    initSentry()

    const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    const err = new Error('route blew up')
    routeLog({ log } as never).error(err)

    expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined)
    expect(log.error).toHaveBeenCalledWith('route blew up')
    delete process.env.SENTRY_DSN
  })
})
