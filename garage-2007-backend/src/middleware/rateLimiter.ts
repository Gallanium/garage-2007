import rateLimit from 'express-rate-limit'
import type { Request } from 'express'

const rateLimitMessage = { success: false, error: 'RATE_LIMITED', message: 'Too many requests' }

/** Extract userId from authenticated request for per-user rate limiting */
function userKeyGenerator(req: Request): string {
  const user = req.user
  return user ? `user:${user.id}` : req.ip ?? 'unknown'
}

// Auth: IP-based (runs before authentication)
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
})

// Authenticated endpoints: per-userId
export const stateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: rateLimitMessage,
})

export const syncLimiter = rateLimit({
  windowMs: 60_000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: rateLimitMessage,
})

export const actionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: rateLimitMessage,
})

export const purchaseLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: rateLimitMessage,
})
