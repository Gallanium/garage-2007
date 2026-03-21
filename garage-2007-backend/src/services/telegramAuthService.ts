import crypto from 'node:crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

// ── initData replay protection ──────────────────────────────────────────────
// In-memory set of recently-used initData hashes. TTL = 120 seconds.
// Prevents the same initData from being accepted twice within the window.

const REPLAY_TTL_MS = 120_000
const usedInitDataHashes = new Map<string, number>()

// Periodic cleanup: remove expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [hash, expiry] of usedInitDataHashes) {
    if (expiry <= now) usedInitDataHashes.delete(hash)
  }
}, 60_000).unref()

/** Clear the replay cache (for testing only) */
export function _resetReplayCache(): void {
  usedInitDataHashes.clear()
}

export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  // Freshness check: 2 minutes
  const authDate = Number(params.get('auth_date'))
  if (Number.isNaN(authDate) || Date.now() / 1000 - authDate > 120) return null

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
    if (!crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'))) {
      return null
    }
  } catch {
    return null
  }

  // Replay protection: reject if the same initData was already used within TTL
  const initDataHash = crypto.createHash('sha256').update(initData).digest('hex')
  const now = Date.now()
  if (usedInitDataHashes.has(initDataHash)) {
    return null
  }
  usedInitDataHashes.set(initDataHash, now + REPLAY_TTL_MS)

  const userJson = params.get('user')
  if (!userJson) return null

  try {
    return JSON.parse(userJson) as TelegramUser
  } catch {
    return null
  }
}
