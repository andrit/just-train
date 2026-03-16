// ------------------------------------------------------------
// middleware/requireRole.ts — Role-based access control
//
// Used AFTER authenticate — requires authenticate to have already
// run and set request.trainer.
//
// USAGE — restrict a route to admins only:
//   app.delete('/trainers/:id', {
//     preHandler: [authenticate, requireRole('admin')]
//   }, handler)
//
// CURRENT ROLES:
//   trainer — standard access (default for all trainers)
//   admin   — elevated access (manage other trainers, billing)
//
// NOTE: Admin routes don't exist yet in Phase 2. This middleware
// is scaffolded now so gating future admin routes is a one-liner.
// The 'admin' role is already in the DB schema and the JWT payload.
// ------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from 'fastify'
import type { TrainerRole } from '@trainer-app/shared'

/**
 * Returns a Fastify preHandler that allows only the specified roles.
 * Must be used after the authenticate middleware.
 *
 * @param roles - One or more roles that are permitted
 *
 * @example
 * // Only admins can access this route
 * { preHandler: [authenticate, requireRole('admin')] }
 *
 * @example
 * // Both trainers and admins can access
 * { preHandler: [authenticate, requireRole('trainer', 'admin')] }
 */
export function requireRole(...roles: TrainerRole[]) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // authenticate must have run first — if trainer is missing, it's a wiring error
    if (!request.trainer) {
      return reply.status(500).send({ error: 'authenticate middleware must run before requireRole' })
    }

    if (!roles.includes(request.trainer.role)) {
      return reply.status(403).send({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      })
    }
  }
}
