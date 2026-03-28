import { logger } from './logger.js'

// ── Replay Cache Interface ─────────────────────────────────────────────────

export interface ReplayCache {
  /** Returns true if key was NEW (set succeeded), false if already existed */
  setIfAbsent(hash: string, ttlMs: number): Promise<boolean>
  has(hash: string): Promise<boolean>
  set(hash: string, ttlMs: number): Promise<void>
  clear(): Promise<void>
}

// ── In-Memory Implementation (default fallback) ────────────────────────────

export class InMemoryReplayCache implements ReplayCache {
  private map = new Map<string, number>()
  private interval: ReturnType<typeof setInterval>

  constructor(cleanupIntervalMs = 300_000) {
    this.interval = setInterval(() => {
      const now = Date.now()
      for (const [hash, expiry] of this.map) {
        if (expiry <= now) this.map.delete(hash)
      }
    }, cleanupIntervalMs)
    this.interval.unref()
  }

  async setIfAbsent(hash: string, ttlMs: number): Promise<boolean> {
    const expiry = this.map.get(hash)
    if (expiry !== undefined && expiry > Date.now()) return false
    this.map.set(hash, Date.now() + ttlMs)
    return true
  }

  async has(hash: string): Promise<boolean> {
    const expiry = this.map.get(hash)
    if (expiry === undefined) return false
    if (expiry <= Date.now()) {
      this.map.delete(hash)
      return false
    }
    return true
  }

  async set(hash: string, ttlMs: number): Promise<void> {
    this.map.set(hash, Date.now() + ttlMs)
  }

  async clear(): Promise<void> {
    this.map.clear()
  }
}

// ── Redis Implementation ───────────────────────────────────────────────────

class RedisReplayCache implements ReplayCache {
  private redis: { set: (key: string, value: string, options: { NX: true; EX: number }) => Promise<string | null>; get: (key: string) => Promise<string | null>; flushDb: () => Promise<string> }
  private prefix = 'replay:'

  constructor(redis: unknown) {
    this.redis = redis as typeof this.redis
  }

  async setIfAbsent(hash: string, ttlMs: number): Promise<boolean> {
    const ttlSeconds = Math.ceil(ttlMs / 1000)
    const result = await this.redis.set(this.prefix + hash, '1', { NX: true, EX: ttlSeconds })
    return result !== null  // SET NX returns null if key already existed
  }

  async has(hash: string): Promise<boolean> {
    const val = await this.redis.get(this.prefix + hash)
    return val !== null
  }

  async set(hash: string, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.ceil(ttlMs / 1000)
    await this.redis.set(this.prefix + hash, '1', { NX: true, EX: ttlSeconds })
  }

  async clear(): Promise<void> {
    // Only used in tests
    await this.redis.flushDb()
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

const REDIS_PKG = 'redis'

let instance: ReplayCache | null = null

export async function createReplayCache(): Promise<ReplayCache> {
  if (instance) return instance

  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    try {
      const redis = await import(REDIS_PKG) as Record<string, unknown>
      const createClientFn = redis['createClient'] as (opts: { url: string }) => {
        connect: () => Promise<void>
        set: (key: string, value: string, options: { NX: true; EX: number }) => Promise<string | null>
        get: (key: string) => Promise<string | null>
        flushDb: () => Promise<string>
      }
      const client = createClientFn({ url: redisUrl })
      await client.connect()
      instance = new RedisReplayCache(client)
      logger.info('Replay cache: using Redis')
      return instance
    } catch (err) {
      logger.warn({ err }, 'Replay cache: Redis unavailable, falling back to in-memory')
    }
  }

  instance = new InMemoryReplayCache()
  logger.info('Replay cache: using in-memory')
  return instance
}

/** Reset singleton (for testing) */
export function _resetReplayCacheInstance(): void {
  instance = null
}
