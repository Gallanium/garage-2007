// src/store/constants/dailyRewards.ts
// ── Daily rewards ─────────────────────────────────────────────────────────────

export const DAILY_REWARDS = [5, 5, 5, 5, 5, 5, 50] as const
export const DAILY_REWARDS_TOTAL = DAILY_REWARDS.reduce((s, r) => s + r, 0) // 80
export const DAILY_STREAK_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

// ── Rewarded video ────────────────────────────────────────────────────────────

export const REWARDED_VIDEO_NUTS = 5
export const REWARDED_VIDEO_COOLDOWN_MS = 60 * 60 * 1000
export const REWARDED_VIDEO_FAKE_DURATION_MS = 3000

