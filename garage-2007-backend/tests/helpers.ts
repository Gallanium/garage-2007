import crypto from 'node:crypto'

// ── Constants ────────────────────────────────────────────────────────────────

export const TEST_BOT_TOKEN = process.env.BOT_TOKEN!
export const TEST_JWT_SECRET = process.env.JWT_SECRET!
export const TEST_WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!

// ── Telegram initData helpers ────────────────────────────────────────────────

interface TestTelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

/**
 * Creates a valid Telegram initData string with correct HMAC-SHA256 signature.
 * Mirrors the validation logic from BACKEND_MVP.md section 6.1.
 */
export function createValidInitData(
  user: TestTelegramUser,
  botToken: string = TEST_BOT_TOKEN,
  overrides?: { authDate?: number; queryId?: string },
): string {
  const authDate = overrides?.authDate ?? Math.floor(Date.now() / 1000)
  const queryId = overrides?.queryId ?? 'test_query_id_123'

  const params = new URLSearchParams()
  params.set('query_id', queryId)
  params.set('user', JSON.stringify(user))
  params.set('auth_date', String(authDate))

  // Build data-check-string (sorted by key, joined by \n)
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  // HMAC chain per Telegram spec
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  params.set('hash', hash)
  return params.toString()
}

/**
 * Creates an expired initData (auth_date > 300 seconds ago).
 */
export function createExpiredInitData(
  user: TestTelegramUser,
  botToken: string = TEST_BOT_TOKEN,
): string {
  return createValidInitData(user, botToken, {
    authDate: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
  })
}

/**
 * Creates initData with an invalid hash.
 */
export function createInvalidInitData(user: TestTelegramUser): string {
  const params = new URLSearchParams()
  params.set('query_id', 'test_query_id_123')
  params.set('user', JSON.stringify(user))
  params.set('auth_date', String(Math.floor(Date.now() / 1000)))
  params.set('hash', 'invalid_hash_value_that_will_not_match')
  return params.toString()
}

// ── Test user factory ────────────────────────────────────────────────────────

export const DEFAULT_TELEGRAM_USER: TestTelegramUser = {
  id: 123456789,
  first_name: 'TestUser',
  username: 'testuser',
  language_code: 'ru',
  is_premium: false,
}

export function createTelegramUser(overrides?: Partial<TestTelegramUser>): TestTelegramUser {
  return { ...DEFAULT_TELEGRAM_USER, ...overrides }
}

// ── DB record factories ─────────────────────────────────────────────────────

export interface TestDbUser {
  id: number
  telegramId: bigint
  username: string | null
  firstName: string | null
  lastName: string | null
  isPremium: boolean
  languageCode: string | null
  createdAt: Date
  updatedAt: Date
}

export function createTestDbUser(overrides?: Partial<TestDbUser>): TestDbUser {
  return {
    id: 1,
    telegramId: BigInt(123456789),
    username: 'testuser',
    firstName: 'TestUser',
    lastName: null,
    isPremium: false,
    languageCode: 'ru',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export interface TestGameSave {
  id: number
  userId: number
  balance: number
  nuts: number
  garageLevel: number
  totalClicks: number
  totalEarned: number
  milestonesPurchased: number[]
  clickPowerLevel: number
  clickPowerCost: number
  workSpeedLevel: number
  workSpeedCost: number
  apprenticeCount: number
  apprenticeCost: number
  mechanicCount: number
  mechanicCost: number
  masterCount: number
  masterCost: number
  brigadierCount: number
  brigadierCost: number
  directorCount: number
  directorCost: number
  sessionCount: number
  lastSessionDate: string
  peakClickIncome: number
  totalPlayTimeSeconds: number
  bestStreak: number
  achievements: Record<string, unknown>
  dailyRewards: Record<string, unknown>
  rewardedVideo: Record<string, unknown>
  boosts: Record<string, unknown>
  events: Record<string, unknown>
  decorationsOwned: string[]
  decorationsActive: string[]
  gameDataSnapshot: unknown
  lastSyncAt: Date
  version: number
  updatedAt: Date
}

export function createTestGameSave(overrides?: Partial<TestGameSave>): TestGameSave {
  return {
    id: 1,
    userId: 1,
    balance: 10_000,
    nuts: 50,
    garageLevel: 1,
    totalClicks: 0,
    totalEarned: 0,
    milestonesPurchased: [],
    clickPowerLevel: 0,
    clickPowerCost: 100,
    workSpeedLevel: 0,
    workSpeedCost: 500,
    apprenticeCount: 0,
    apprenticeCost: 500,
    mechanicCount: 0,
    mechanicCost: 5_000,
    masterCount: 0,
    masterCost: 50_000,
    brigadierCount: 0,
    brigadierCost: 500_000,
    directorCount: 0,
    directorCost: 5_000_000,
    sessionCount: 1,
    lastSessionDate: '2026-03-16',
    peakClickIncome: 0,
    totalPlayTimeSeconds: 0,
    bestStreak: 0,
    achievements: {},
    dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 },
    rewardedVideo: { lastWatchedTimestamp: 0, totalWatches: 0, isWatching: false },
    boosts: { active: [] },
    events: { activeEvent: null, cooldownEnd: 0 },
    decorationsOwned: [],
    decorationsActive: [],
    gameDataSnapshot: null,
    lastSyncAt: new Date(),
    version: 7,
    updatedAt: new Date(),
    ...overrides,
  }
}

// ── JWT helper ───────────────────────────────────────────────────────────────

/**
 * Creates a test JWT token. In real app this would use jsonwebtoken,
 * but for tests we import the app's own jwt utility.
 * This is a placeholder that tests should override with the actual implementation.
 */
export function createAuthHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// ── Webhook payload helpers ──────────────────────────────────────────────────

export function createPreCheckoutPayload(userId: number, packId: string) {
  return {
    update_id: 1,
    pre_checkout_query: {
      id: 'pre_checkout_123',
      from: { id: userId, is_bot: false, first_name: 'Test' },
      currency: 'XTR',
      total_amount: 50,
      invoice_payload: JSON.stringify({ packId, idempotencyKey: 'test-uuid-1' }),
    },
  }
}

export function createSuccessfulPaymentPayload(
  userId: number,
  packId: string,
  telegramPaymentChargeId: string = 'charge_123',
) {
  return {
    update_id: 2,
    message: {
      message_id: 1,
      from: { id: userId, is_bot: false, first_name: 'Test' },
      chat: { id: userId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      successful_payment: {
        currency: 'XTR',
        total_amount: 50,
        invoice_payload: JSON.stringify({ packId, idempotencyKey: 'test-uuid-1' }),
        telegram_payment_charge_id: telegramPaymentChargeId,
        provider_payment_charge_id: 'provider_123',
      },
    },
  }
}

// ── NUTS_PACKS (mirrored from spec for test assertions) ──────────────────────

export const NUTS_PACKS = {
  nuts_100:  { stars: 50,  nuts: 100,  label: '100 гаек'  },
  nuts_500:  { stars: 200, nuts: 500,  label: '500 гаек'  },
  nuts_1500: { stars: 500, nuts: 1500, label: '1500 гаек' },
} as const
