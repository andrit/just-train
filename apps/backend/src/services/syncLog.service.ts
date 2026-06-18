// ------------------------------------------------------------
// services/syncLog.service.ts
//
// Writes audit entries to sync_log after successful mutations.
// Enables conflict detection when the same record is written
// from multiple devices while offline.
//
// All writes are fire-and-forget — a sync_log failure must
// never block the primary response. Call with .catch(() => {}).
//
// Fields:
//   trainerId       — from request.trainer.trainerId
//   deviceId        — from X-Device-ID header (empty string if absent)
//   tableName       — the table that was mutated
//   recordId        — the PK of the affected row
//   operation       — 'insert' | 'update' | 'delete'
//   payload         — full record as JSON string (for conflict inspection)
//   createdLocallyAt — from X-Local-Timestamp header if present (offline replay),
//                      otherwise server time (online write)
//   syncedAt        — always server time (moment the server processed it)
// ------------------------------------------------------------

import { db, syncLog } from '../db'

export type SyncOperation = 'insert' | 'update' | 'delete'

interface LogSyncWriteParams {
  trainerId:        string
  deviceId:         string
  tableName:        string
  recordId:         string
  operation:        SyncOperation
  payload:          Record<string, unknown>
  localTimestamp?:  string | undefined
}

export async function logSyncWrite({
  trainerId,
  deviceId,
  tableName,
  recordId,
  operation,
  payload,
  localTimestamp,
}: LogSyncWriteParams): Promise<void> {
  const now = new Date()
  const createdLocallyAt = localTimestamp ? new Date(localTimestamp) : now

  await db.insert(syncLog).values({
    trainerId,
    deviceId,
    tableName,
    recordId,
    operation,
    payload:          JSON.stringify(payload),
    createdLocallyAt,
    syncedAt:         now,
  })
}
