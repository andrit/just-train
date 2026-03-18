// ------------------------------------------------------------
// queues/connection.ts — Shared Redis connection for BullMQ (v1.7.5)
//
// Uses Upstash Redis via ioredis.
//
// UPSTASH NOTES:
//   - Use REDIS_URL starting with rediss:// (TLS required by Upstash)
//   - maxRetriesPerRequest: null is required by BullMQ
//   - enableReadyCheck: false avoids connection issues with Upstash
//
// The connection is created once and shared — BullMQ internally
// creates additional connections for blocking commands (workers).
// ------------------------------------------------------------

import IORedis from 'ioredis'

let _connection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (_connection) return _connection

  const url = process.env.UPSTASH_REDIS_URL
  if (!url) {
    throw new Error('UPSTASH_REDIS_URL is not set — required for job queue')
  }

  _connection = new IORedis(url, {
    maxRetriesPerRequest: null,    // Required by BullMQ
    enableReadyCheck:     false,   // Avoids Upstash handshake issues
    tls:                  url.startsWith('rediss://') ? {} : undefined,
  })

  _connection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message)
  })

  return _connection
}

export async function closeRedisConnection(): Promise<void> {
  if (_connection) {
    await _connection.quit()
    _connection = null
  }
}
