// ------------------------------------------------------------
// middleware/authenticate.ts — JWT authentication middleware
//
// This is a Fastify preHandler hook that runs before every
// protected route handler. It:
//   1. Extracts the Bearer token from the Authorization header
//   2. Verifies and decodes the JWT
//   3. Attaches the payload to request.trainer for route handlers
//
// USAGE — apply to a single route:
//   app.get('/clients', { preHandler: [authenticate] }, handler)
//
// USAGE — apply to all routes in a plugin:
//   app.addHook('preHandler', authenticate)
//
// DESIGN NOTE:
//   We attach to request.trainer rather than using fastify-jwt's
//   built-in decorator so we have full control over the payload
//   shape and error messages.
//
// See also: middleware/requireRole.ts for role-based access control.
// ------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, type AccessTokenPayload } from '../services/auth.service'

// Extend the Fastify request type so TypeScript knows about request.trainer
// This declaration is merged into FastifyRequest in all route files automatically.
declare module 'fastify' {
  interface FastifyRequest {
    // Set by authenticate middleware. Undefined on public routes.
    trainer: AccessTokenPayload
  }
}

/**
 * Fastify preHandler — verifies the JWT access token.
 *
 * Responds with 401 if:
 *   - No Authorization header present
 *   - Token format is wrong (not "Bearer <token>")
 *   - Token is expired
 *   - Token signature is invalid
 *   - Token type is not 'access' (prevents refresh tokens being used here)
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization

  if (!authHeader) {
    return reply.status(401).send({ error: 'Authorization header required' })
  }

  if (!authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Authorization header must be "Bearer <token>"' })
  }

  const token = authHeader.slice(7)

  try {
    request.trainer = verifyAccessToken(token)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid token'

    // Distinguish expired tokens so the frontend can attempt a refresh
    // rather than forcing a full re-login
    if (message.includes('expired')) {
      return reply.status(401).send({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }

    return reply.status(401).send({ error: 'Invalid token' })
  }
}
