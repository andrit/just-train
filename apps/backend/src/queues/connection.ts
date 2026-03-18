// ------------------------------------------------------------
// queues/connection.ts — BullMQ connection config (v1.7.5)
//
// BullMQ v5 accepts a connection URL string directly via
// { url } — no need for a separate ioredis instance.
// This avoids the duplicate ioredis version conflict that
// occurs when ioredis is also listed as a direct dependency.
//
// The connection config is returned as a plain object and
// passed to Queue/Worker/QueueScheduler constructors.
// ------------------------------------------------------------

export interface RedisConnection {
  url: string
  enableOfflineQueue:  boolean
  maxRetriesPerRequest: null
  enableReadyCheck:    boolean
  tls?:                Record<string, never>
}

let _config: RedisConnection | null = null

export function getRedisConnection(): RedisConnection {
  if (_config) return _config

  const url = process.env.UPSTASH_REDIS_URL
  if (!url) {
    throw new Error('UPSTASH_REDIS_URL is not set — required for job queue')
  }

  _config = {
    url,
    enableOfflineQueue:   false,
    maxRetriesPerRequest: null,   // Required by BullMQ
    enableReadyCheck:     false,  // Avoids Upstash handshake issues
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  }

  return _config
}

export async function closeRedisConnection(): Promise<void> {
  // With URL-based connections BullMQ manages the lifecycle
  _config = null
}
