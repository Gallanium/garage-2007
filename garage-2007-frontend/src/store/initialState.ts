// src/store/initialState.ts
import { BASE_COSTS } from './constants/economy'
import { ACHIEVEMENTS } from './constants/achievements'
import type { GameState, AchievementId, PlayerAchievement } from './types'

export const initialState: GameState = {
  balance: 0,
  clickValue: 1,
  totalClicks: 0,
  garageLevel: 1,
  passiveIncomePerSecond: 0,

  upgrades: {
    clickPower: { level: 0, cost: BASE_COSTS.clickUpgrade, baseCost: BASE_COSTS.clickUpgrade },
    workSpeed:  { level: 0, cost: BASE_COSTS.workSpeed,    baseCost: BASE_COSTS.workSpeed    },
  },

  milestonesPurchased: [],
  showMilestoneModal: false,
  pendingMilestoneLevel: null,
  _milestoneDismissedAt: 0,

  workers: {
    apprentice: { count: 0, cost: BASE_COSTS.apprentice },
    mechanic:   { count: 0, cost: BASE_COSTS.mechanic   },
    master:     { count: 0, cost: BASE_COSTS.master      },
    brigadier:  { count: 0, cost: BASE_COSTS.brigadier  },
    director:   { count: 0, cost: BASE_COSTS.director   },
  },

  nuts: 0,
  totalEarned: 0,
  sessionCount: 0,
  lastSessionDate: new Date().toISOString(),
  isLoaded: false,

  lastOfflineEarnings: 0,
  lastOfflineTimeAway: 0,

  momentaryClickIncome: 0,
  _clickIncomeThisTick: 0,

  peakClickIncome: 0,
  totalPlayTimeSeconds: 0,
  bestStreak: 0,

  achievements: Object.keys(ACHIEVEMENTS).reduce((acc, id) => {
    acc[id as AchievementId] = { unlocked: false, claimed: false }
    return acc
  }, {} as Record<AchievementId, PlayerAchievement>),
  hasNewAchievements: false,

  dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 },
  showDailyRewardsModal: false,

  rewardedVideo: { lastWatchedTimestamp: 0, totalWatches: 0, isWatching: false },
  boosts: { active: [] },
  events: { activeEvent: null, cooldownEnd: 0 },
  decorations: { owned: [], active: [] },
  _pendingClickBuffer: [],
  serverError: false,
}
