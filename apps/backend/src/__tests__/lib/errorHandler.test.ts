// lib/errorHandler.test.ts — the two Zod error paths produce ErrorResponseSchema shapes

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { z } from 'zod'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { attachErrorHandler } from '../../lib/errorHandler'

function buildApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  attachErrorHandler(app)

  app.post('/echo', {
    schema: {
      body:     z.object({ email: z.string().email(), age: z.number().int().min(0) }),
      response: { 200: z.object({ ok: z.boolean() }), 400: z.object({ error: z.string(), code: z.string().optional(), details: z.unknown().optional() }) },
    },
  }, async () => ({ ok: true }))

  app.get('/broken', {
    schema: { response: { 200: z.object({ createdAt: z.string() }) } },
  }, async () => ({ createdAt: new Date() as unknown as string }))

  app.get('/boom', async () => { throw new Error('kaboom') })

  return app
}

let app: ReturnType<typeof buildApp>
beforeAll(async () => { app = buildApp(); await app.ready() })
afterAll(async () => { await app.close() })

describe('validation failures', () => {
  it('answer 400 with a stable shape and per-field issues', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo', payload: { email: 'nope', age: -1 } })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.code).toBe('VALIDATION')
    const paths = (body.details as Array<{ path: string; message: string }>).map((d) => d.path).sort()
    expect(paths).toEqual(['age', 'email'])
  })

  it('still answer 200 when valid (the handler is not in the happy path)', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo', payload: { email: 'a@b.co', age: 3 } })
    expect(res.statusCode).toBe(200)
  })
})

describe('response serialisation failures', () => {
  it('answer 500 with RESPONSE_SCHEMA and, outside production, which field failed', async () => {
    const res = await app.inject({ method: 'GET', url: '/broken' })
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.error).toBe('Response failed validation')
    expect(body.code).toBe('RESPONSE_SCHEMA')
    expect(JSON.stringify(body.details)).toContain('createdAt')
  })
})

describe('everything else', () => {
  it('an unhandled throw is a plain 500 without the message', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom' })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'Internal Server Error' })
  })
})
