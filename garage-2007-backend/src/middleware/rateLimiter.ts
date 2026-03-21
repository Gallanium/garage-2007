import rateLimit from 'express-rate-limit'
import type { Store } from 'express-rate-limit'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const rateLimitMessage = { success: false, error: 'RATE_LIMITED', message: 'Too many requests' }

/** Extract userId from authenticated request for per-user rate limiting */
function userKeyGenerator(req: Request): string {
  const user = req.user
  return user ? `user:${user.id}` : req.ip ?? 'unknown'
}

function rateLimitHandler(req: Request, res: Response): void {
  logger.warn({ userId: req.user?.id, ip: req.ip, path: req.path }, 'rate_limited')
  res.status(429).json(rateLimitMessage)
}

/**
 * Optional package names for Redis-backed rate limiting.
 * Stored as variables to prevent TypeScript from resolving them at compile time.
 */
const RATE_LIMIT_REDIS_PKG = 'rate-limit-redis'
const REDIS_PKG = 'redis'

/**
 * Create a rate-limit store. If REDIS_URL is configured, attempts to
 * dynamically import rate-limit-redis (optional peer dependency).
 * Falls back to the built-in MemoryStore when Redis is unavailable
 * or the package is not installed.
 *
 * To enable Redis-backed distributed rate limiting:
 *   1. npm install rate-limit-redis redis
 *   2. Set REDIS_URL in environment (e.g. redis://localhost:6379)
 */
async function createStore(): Promise<Store | undefined> {
  if (!env.REDIS_URL) return undefined

  let rateLimitRedis: Record<string, unknown> | undefined
  let redis: Record<string, unknown> | undefined

  try {
    rateLimitRedis = await import(RATE_LIMIT_REDIS_PKG) as Record<string, unknown>
  } catch {
    // rate-limit-redis not installed
  }
  try {
    redis = await import(REDIS_PKG) as Record<string, unknown>
  } catch {
    // redis not installed
  }

  if (!rateLimitRedis || !redis) {
    logger.warn(
      'rate_limiter: REDIS_URL is set but rate-limit-redis or redis is not installed. '
      + 'Falling back to MemoryStore. Install with: npm i rate-limit-redis redis',
    )
    return undefined
  }

  try {
    const RedisStoreClass = rateLimitRedis['RedisStore'] as new (opts: {
      sendCommand: (...args: string[]) => Promise<unknown>
    }) => Store
    const createClientFn = redis['createClient'] as (opts: {
      url: string
    }) => { connect: () => Promise<void>; sendCommand: (...args: string[]) => Promise<unknown> }

    const client = createClientFn({ url: env.REDIS_URL })
    await client.connect()

    logger.info('rate_limiter: using RedisStore for distributed rate limiting')
    return new RedisStoreClass({
      sendCommand: (...args: string[]) => client.sendCommand(...args),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn(
      { error: message },
      'rate_limiter: failed to initialize RedisStore, falling back to MemoryStore',
    )
    return undefined
  }
}

/** Shared store instance (undefined = use default MemoryStore) */
const sharedStore = await createStore()

/** Build store option — spread into each rateLimit() call */
function storeOption(): { store: Store } | Record<string, never> {
  return sharedStore ? { store: sharedStore } : {}
}

// Auth: IP-based (runs before authentication)
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  ...storeOption(),
})

// Authenticated endpoints: per-userId
export const stateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  ...storeOption(),
})

export const syncLimiter = rateLimit({
  windowMs: 60_000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  ...storeOption(),
})

export const actionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  ...storeOption(),
})

export const purchaseLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  handler: rateLimitHandler,
  ...storeOption(),
})

export const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  ...storeOption(),
})
