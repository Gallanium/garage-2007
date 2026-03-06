// src/store/constants/dailyRewards.ts
import type { BoostType, BoostDefinition } from '../types'

// ── Daily rewards ─────────────────────────────────────────────────────────────

export const DAILY_REWARDS = [5, 5, 5, 5, 5, 5, 50] as const
export const DAILY_REWARDS_TOTAL = DAILY_REWARDS.reduce((s, r) => s + r, 0) // 80
export const DAILY_STREAK_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

// ── Rewarded video ────────────────────────────────────────────────────────────

export const REWARDED_VIDEO_NUTS = 5
export const REWARDED_VIDEO_COOLDOWN_MS = 60 * 60 * 1000
export const REWARDED_VIDEO_FAKE_DURATION_MS = 3000

// ── Boosts ────────────────────────────────────────────────────────────────────

export const BOOSTS: Record<BoostType, BoostDefinition> = {
  income_2x: {
    label: 'Двойной доход',
    costNuts: 50,
    durationMs: 60 * 60 * 1000,
    multiplier: 2,
    description: '×2 к доходу на 1 час',
  },
  income_3x: {
    label: 'Тройной доход',
    costNuts: 80,
    durationMs: 30 * 60 * 1000,
    multiplier: 3,
    description: '×3 к доходу на 30 мин',
  },
  turbo: {
    label: 'Турбо-клик',
    costNuts: 30,
    durationMs: 15 * 60 * 1000,
    multiplier: 5,
    description: '×5 к клику на 15 мин',
  },
} as const

export const MAX_ACTIVE_BOOSTS = 3
