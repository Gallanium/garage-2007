import crypto from 'node:crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  // Freshness check: 5 minutes
  const authDate = Number(params.get('auth_date'))
  if (Number.isNaN(authDate) || Date.now() / 1000 - authDate > 300) return null

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

  const userJson = params.get('user')
  if (!userJson) return null

  try {
    return JSON.parse(userJson) as TelegramUser
  } catch {
    return null
  }
}
