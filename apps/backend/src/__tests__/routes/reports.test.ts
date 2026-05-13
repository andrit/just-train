// ------------------------------------------------------------
// routes/reports.test.ts — Report endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildReportTestApp } from '../helpers/buildApp'
import { TEST_TRAINER_ID, TEST_CLIENT_ID } from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        clients:  { findFirst: vi.fn().mockResolvedValue(undefined) },
        trainers: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    clients:  {},
    trainers: {},
  }
})

vi.mock('../../services/report.service', () => ({
  buildReportData: vi.fn().mockResolvedValue(null),
  buildReportHtml: vi.fn().mockReturnValue('<html>report</html>'),
  sendReport:      vi.fn().mockResolvedValue({ id: 'email-id-123' }),
}))

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

const mockReportResult = {
  periodLabel: 'January 2025',
  data: {
    periodStart:  '2025-01-01',
    periodEnd:    '2025-01-31',
    clientEmail:  'client@example.com',
    sessions:     [{ id: 'sess-1' }],
    trainerName:  'Test Trainer',
    clientName:   'Test Client',
    goals:        [],
    challenges:   [],
  },
}

// ── GET /clients/:id/report-preview ──────────────────────────────────────────

describe('GET /clients/:id/report-preview', () => {
  let app: Awaited<ReturnType<typeof buildReportTestApp>>
  beforeAll(async () => { app = await buildReportTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/report-preview`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client not found (buildReportData returns null)', async () => {
    const { buildReportData } = await import('../../services/report.service')
    vi.mocked(buildReportData).mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/report-preview`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns report preview for a valid client', async () => {
    const { buildReportData, buildReportHtml } = await import('../../services/report.service')
    vi.mocked(buildReportData).mockResolvedValueOnce(mockReportResult as never)
    vi.mocked(buildReportHtml).mockReturnValueOnce('<html>report</html>')

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/report-preview`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('html')
    expect(body).toHaveProperty('periodLabel', 'January 2025')
    expect(body).toHaveProperty('sessionCount', 1)
    expect(body).toHaveProperty('clientEmail', 'client@example.com')
  })
})

// ── POST /clients/:id/report ──────────────────────────────────────────────────

describe('POST /clients/:id/report', () => {
  let app: Awaited<ReturnType<typeof buildReportTestApp>>
  beforeAll(async () => { app = await buildReportTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/report`, payload: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client not found (buildReportData returns null)', async () => {
    const { buildReportData } = await import('../../services/report.service')
    vi.mocked(buildReportData).mockResolvedValueOnce(null)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/report`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when client has no email', async () => {
    const { buildReportData } = await import('../../services/report.service')
    vi.mocked(buildReportData).mockResolvedValueOnce({
      ...mockReportResult,
      data: { ...mockReportResult.data, clientEmail: null },
    } as never)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/report`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('error', 'CLIENT_NO_EMAIL')
  })

  it('returns 400 when no sessions in period', async () => {
    const { buildReportData } = await import('../../services/report.service')
    vi.mocked(buildReportData).mockResolvedValueOnce({
      ...mockReportResult,
      data: { ...mockReportResult.data, sessions: [] },
    } as never)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/report`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('error', 'NO_SESSIONS_IN_PERIOD')
  })

  it('sends the report and returns 200', async () => {
    const { buildReportData, sendReport } = await import('../../services/report.service')
    vi.mocked(buildReportData).mockResolvedValueOnce(mockReportResult as never)
    vi.mocked(sendReport).mockResolvedValueOnce({ id: 'email-id-123' } as never)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/report`,
      headers: authHeader(), payload: { trainerNote: 'Great progress!' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('emailId', 'email-id-123')
    expect(body).toHaveProperty('periodLabel', 'January 2025')
  })
})
