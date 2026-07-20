// ------------------------------------------------------------
// lib/idempotency.test.ts — unit tests for the offline-replay dedup hooks
//
// db is mocked (same pattern as the route tests). We drive the two hooks
// directly with fake request/reply objects and assert the claim/replay
// branching and the response-capture on onSend.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Terminal mock fns we reconfigure per test.
const insertReturning = vi.fn()   // db.insert(...).values(...).onConflictDoNothing(...).returning()
const selectLimit     = vi.fn()   // db.select(...).from(...).where(...).limit()
const updateWhere     = vi.fn()   // db.update(...).set(...).where()
const deleteWhere     = vi.fn()   // db.delete(...).where()

vi.mock('../../db', () => {
  const insertChain = {
    values:              vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning:           (...a: unknown[]) => insertReturning(...a),
  }
  const selectChain = {
    from:  vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: (...a: unknown[]) => selectLimit(...a),
  }
  const updateChain = {
    set:   vi.fn().mockReturnThis(),
    where: (...a: unknown[]) => updateWhere(...a),
  }
  const deleteChain = {
    where: (...a: unknown[]) => deleteWhere(...a),
  }
  return {
    db: {
      insert: vi.fn(() => insertChain),
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
      delete: vi.fn(() => deleteChain),
    },
    idempotencyKeys: { key: 'key' },
  }
})

import { idempotencyPreHandler, idempotencyOnSend } from '../../lib/idempotency'

function makeReq(over: Record<string, unknown> = {}): any {
  return {
    headers: {},
    method:  'POST',
    url:     '/sessions/a/sets',
    trainer: { trainerId: 't-1' },
    ...over,
  }
}

function makeReply() {
  const reply: any = {
    statusCode: 200,
    sent:       false,
    body:       undefined,
    headers:    {} as Record<string, string>,
    code(c: number) { this.statusCode = c; return this },
    header(k: string, v: string) { this.headers[k] = v; return this },
    send(b?: unknown) { this.sent = true; this.body = b; return this },
  }
  return reply
}

describe('idempotencyPreHandler', () => {
  beforeEach(() => {
    insertReturning.mockReset()
    selectLimit.mockReset()
    updateWhere.mockReset()
  })

  it('no-ops when the Idempotency-Key header is absent', async () => {
    const req = makeReq()
    const reply = makeReply()
    await idempotencyPreHandler(req, reply)
    expect(insertReturning).not.toHaveBeenCalled()
    expect(reply.sent).toBe(false)
    expect(req.idempotencyClaim).toBeUndefined()
  })

  it('no-ops for a non-mutating method even with a key', async () => {
    const req = makeReq({ method: 'GET', headers: { 'idempotency-key': 'k1' } })
    const reply = makeReply()
    await idempotencyPreHandler(req, reply)
    expect(insertReturning).not.toHaveBeenCalled()
    expect(reply.sent).toBe(false)
  })

  it('claims the key and marks the request as the original', async () => {
    insertReturning.mockResolvedValueOnce([{ key: 'k1' }])
    const req = makeReq({ headers: { 'idempotency-key': 'k1' } })
    const reply = makeReply()
    await idempotencyPreHandler(req, reply)
    expect(req.idempotencyClaim).toEqual({ key: 'k1' })
    expect(reply.sent).toBe(false)          // handler will run
  })

  it('replays a completed response verbatim without running the handler', async () => {
    insertReturning.mockResolvedValueOnce([])                       // conflict
    selectLimit.mockResolvedValueOnce([{ responseStatus: 201, responseBody: '{"id":"x"}' }])
    const req = makeReq({ headers: { 'idempotency-key': 'k1' } })
    const reply = makeReply()
    await idempotencyPreHandler(req, reply)
    expect(req.idempotencyClaim).toBeUndefined()
    expect(reply.statusCode).toBe(201)
    expect(reply.headers['content-type']).toContain('application/json')
    expect(reply.body).toBe('{"id":"x"}')
  })

  it('replays a stored 204 with no body', async () => {
    insertReturning.mockResolvedValueOnce([])
    selectLimit.mockResolvedValueOnce([{ responseStatus: 204, responseBody: null }])
    const req = makeReq({ method: 'DELETE', headers: { 'idempotency-key': 'k1' } })
    const reply = makeReply()
    await idempotencyPreHandler(req, reply)
    expect(reply.statusCode).toBe(204)
    expect(reply.body).toBeUndefined()
  })

  it('returns 409 while the original is still in flight', async () => {
    insertReturning.mockResolvedValueOnce([])
    selectLimit.mockResolvedValueOnce([{ responseStatus: null, responseBody: null }])
    const req = makeReq({ headers: { 'idempotency-key': 'k1' } })
    const reply = makeReply()
    await idempotencyPreHandler(req, reply)
    expect(reply.statusCode).toBe(409)
    expect(reply.body).toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' })
  })
})

describe('idempotencyOnSend', () => {
  beforeEach(() => {
    updateWhere.mockReset(); updateWhere.mockResolvedValue(undefined)
    deleteWhere.mockReset(); deleteWhere.mockResolvedValue(undefined)
  })

  it('persists a 2xx response for the original keyed request', async () => {
    const req = makeReq()
    req.idempotencyClaim = { key: 'k1' }
    const reply = makeReply()
    reply.statusCode = 201
    const out = await idempotencyOnSend(req, reply, '{"id":"x"}')
    expect(updateWhere).toHaveBeenCalledTimes(1)
    expect(deleteWhere).not.toHaveBeenCalled()
    expect(out).toBe('{"id":"x"}')          // payload passed through unchanged
  })

  it('frees the key on a non-2xx response so a retry re-runs', async () => {
    const req = makeReq()
    req.idempotencyClaim = { key: 'k1' }
    const reply = makeReply()
    reply.statusCode = 500
    await idempotencyOnSend(req, reply, '{"error":"boom"}')
    expect(deleteWhere).toHaveBeenCalledTimes(1)
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it('does nothing when the request is not the original (replay/unkeyed)', async () => {
    const req = makeReq()                    // no idempotencyClaim
    const reply = makeReply()
    const out = await idempotencyOnSend(req, reply, '{"id":"x"}')
    expect(updateWhere).not.toHaveBeenCalled()
    expect(deleteWhere).not.toHaveBeenCalled()
    expect(out).toBe('{"id":"x"}')
  })

  it('swallows a persistence failure (degrades to no-dedup, never a 500)', async () => {
    updateWhere.mockRejectedValueOnce(new Error('db down'))
    const req = makeReq()
    req.idempotencyClaim = { key: 'k1' }
    const reply = makeReply()
    reply.statusCode = 201
    await expect(idempotencyOnSend(req, reply, 'payload')).resolves.toBe('payload')
  })
})
