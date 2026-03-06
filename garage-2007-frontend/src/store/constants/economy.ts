// src/store/constants/economy.ts
// Economic constants from GBD v1.1.

export const BASE_COSTS = {
  clickUpgrade: 100,
  apprentice:   500,
  mechanic:     5_000,
  master:       50_000,
  brigadier:    500_000,
  director:     5_000_000,
  workSpeed:    500,
} as const

export const WORKER_INCOME = {
  apprentice: 2,
  mechanic:   20,
  master:     200,
  brigadier:  2_000,
  director:   20_000,
} as const

export const WORKER_LIMITS = {
  apprentice: 3,
  mechanic:   5,
  master:     3,
  brigadier:  2,
  director:   1,
} as const

export const COST_MULTIPLIER = 1.15
export const CLICK_UPGRADE_MAX_LEVEL = 200
export const WORK_SPEED_BONUS_PER_LEVEL = 0.1

/** GDD 4.1: шанс критического клика */
export const CRITICAL_CLICK_CHANCE = 0.05
/** GDD 4.1: множитель критического клика */
export const CRITICAL_CLICK_MULTIPLIER = 2
