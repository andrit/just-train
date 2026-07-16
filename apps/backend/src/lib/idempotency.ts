// ------------------------------------------------------------
// lib/idempotency.ts — Idempotent replay of offline-queued writes
//
// The offline queue replays POST/PATCH mutations on reconnect. If the
// server processed a write but its HTTP response was lost, the client
// treats it as failed and replays it — inserting a duplicate. The client
// sends an `Idempotency-Key` header (a per-operation UUID, generated
// before the first attempt and reused on every replay). These two hooks
// make the server dedup on it:
//
//   preHandler (idempotencyPreHandler):
//     - No header, or a non-mutating method → no-op (backward compatible:
//       old clients and GETs are untouched).
//     - Atomically CLAIM the key (insert-or-nothing on the PK).
//         · claim succeeded → this is the ORIGINAL; mark the request so
//           onSend persists the response, then fall through to the handler.
//         · claim conflicted → a row already exists (a REPLAY):
//             - original still in flight (no stored status) → 409, retry.
//             - original completed → replay the stored status + body
//               verbatim and DO NOT run the handler.
//
//   onSend (idempotencyOnSend):
//     - Only for the ORIGINAL request: persist the final status + serialized
//       body under the key so future replays can return it. Storing the body
//       is required, not cosmetic — offline child writes embed the server-
//       generated parent id from this response (see design/offline-contract.md,
//       "flush order: workouts → sessionExercises → sets").
//
// Register both on any router whose routes are offline-queued, AFTER the
// authenticate hook (so request.trainer is available for the audit column).
// ------------------------------------------------------------

import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { db, idempotencyKeys } from '../db'

// Only a successful response is safe to replay. A non-2xx (validation 4xx, or a
// transient 5xx/429) frees the key so a retry genuinely re-runs — otherwise a
// transient error would be cached and returned forever, poisoning the key.
function isReplayable(status: number): boolean {
  return status >= 200 && status < 300
}

const MUTATING = new Set(['POST', 'PATCH', 'DELETE'])

// Set on the request only when THIS request claimed the key (is the original).
declare module 'fastify' {
  interface FastifyRequest {
    idempotencyClaim?: { key: string }
  }
}

export async function idempotencyPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers['idempotency-key']
  const key = Array.isArray(header) ? header[0] : header
  if (!key || !MUTATING.has(request.method)) return

  // request.trainer is set by the authenticate hook (registered before this one).
  const trainerId = request.trainer?.trainerId ?? null

  // Atomic claim — insert-or-nothing on the primary key. Wins the race exactly once.
  const claimed = await db
    .insert(idempotencyKeys)
    .values({ key, trainerId, method: request.method, path: request.url })
    .onConflictDoNothing({ target: idempotencyKeys.key })
    .returning({ key: idempotencyKeys.key })

  if (claimed.length > 0) {
    // Original request — let it run; onSend will persist the response.
    request.idempotencyClaim = { key }
    return
  }

  // Replay — a row already exists for this key.
  const [existing] = await db
    .select({
      responseStatus: idempotencyKeys.responseStatus,
      responseBody:   idempotencyKeys.responseBody,
    })
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1)

  // Row vanished between conflict and read (extremely unlikely) — let it proceed.
  if (!existing) return

  if (existing.responseStatus == null) {
    // Original still processing — the client should retry shortly.
    await reply.code(409).send({
      error: 'A request with this Idempotency-Key is still being processed. Retry shortly.',
      code:  'IDEMPOTENCY_IN_PROGRESS',
    })
    return
  }

  // Completed — replay the stored response verbatim; the handler must not run.
  if (existing.responseBody == null) {
    await reply.code(existing.responseStatus).send()
    return
  }
  await reply
    .code(existing.responseStatus)
    .header('content-type', 'application/json; charset=utf-8')
    .send(existing.responseBody)
}

export async function idempotencyOnSend(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): Promise<unknown> {
  const claim = request.idempotencyClaim
  if (!claim) return payload  // not the original keyed request (replay, 409, or unkeyed)

  // Awaited so the outcome is durable before the client could possibly retry.
  // Any failure here degrades to "no dedup on the next replay" (the handler
  // re-runs) — never a 500.
  try {
    if (isReplayable(reply.statusCode)) {
      // Success — persist the response so replays return it verbatim.
      const body =
        typeof payload === 'string' ? payload
        : payload == null           ? null
        : Buffer.isBuffer(payload)  ? payload.toString('utf-8')
        : String(payload)
      await db
        .update(idempotencyKeys)
        .set({ responseStatus: reply.statusCode, responseBody: body })
        .where(eq(idempotencyKeys.key, claim.key))
    } else {
      // Error — release the claim so a retry can genuinely re-run the mutation.
      await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, claim.key))
    }
  } catch {
    // Intentionally swallowed — see above.
  }

  return payload
}
