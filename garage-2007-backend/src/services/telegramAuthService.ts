import crypto from 'node:crypto'
import type { ReplayCache } from '../utils/replayCache.js'
import { createReplayCache, _resetReplayCacheInstance } from '../utils/replayCache.js'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

// ── initData replay protection ──────────────────────────────────────────────
// TTL matches auth freshness window (1 hour) to close the replay gap.

const REPLAY_TTL_MS = 3_600_000

let replayCache: ReplayCache | null = null

/** Clear the replay cache (for testing only) */
export async function _resetReplayCache(): Promise<void> {
  await replayCache?.clear()
  replayCache = null
  _resetReplayCacheInstance()
}

export async function validateInitData(initData: string, botToken: string): Promise<TelegramUser | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  // Freshness check: 1 hour.
  // Telegram initData auth_date is set once when the Mini App opens and never refreshes.
  // A 2-minute window was too aggressive — after 2 min of gameplay, any re-auth
  // (e.g., after page reload or webview restart) would fail with INVALID_INIT_DATA,
  // creating an unrecoverable death spiral (stale initData → 401 → retry → rate limit).
  // HMAC validation already ensures authenticity; this check is defense-in-depth.
  const INIT_DATA_MAX_AGE_SECONDS = 3600
  const authDate = Number(params.get('auth_date'))
  if (Number.isNaN(authDate) || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SECONDS) return null

  // Sort and build data-check-string
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // HMAC chain
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  // Timing-safe comparison
  try {
    // SAFETY: never allow dev bypass in production, regardless of env vars
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only bypass: accept mock initData when explicitly enabled.
      // Must run BEFORE timingSafeEqual because mock hashes (non-hex, wrong length)
      // cause timingSafeEqual to throw TypeError, bypassing any code after it.
      if (process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true') {
        const userParam = params.get('user')
        if (userParam) {
          try {
            const user = JSON.parse(userParam) as TelegramUser
            if (user.id && user.first_name) {
              console.warn('[AUTH] DEV BYPASS: accepting unverified initData for user', user.id)
              return user
            }
          } catch { /* fall through to normal validation */ }
        }
      }
    }

    if (!crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'))) {
      return null
    }
  } catch {
    return null
  }

  // Replay protection: reject if the same initData was already used within TTL
  if (!replayCache) replayCache = await createReplayCache()

  const initDataHash = crypto.createHash('sha256').update(initData).digest('hex')
  const isNew = await replayCache.setIfAbsent(initDataHash, REPLAY_TTL_MS)
  if (!isNew) {
    return null
  }

  const userJson = params.get('user')
  if (!userJson) return null

  try {
    return JSON.parse(userJson) as TelegramUser
  } catch {
    return null
  }
}
