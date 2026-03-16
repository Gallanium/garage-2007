// src/store/types.ts
// Re-exports shared types + frontend-only types (GameActions, GameStore).

export type {
  WorkerType,
  UpgradeType,
  UpgradeData,
  WorkerData,
  UpgradesState,
  WorkersState,
  AchievementCategory,
  AchievementId,
  AchievementProgressField,
  AchievementDefinition,
  PlayerAchievement,
  DailyRewardsState,
  RewardedVideoState,
  BoostType,
  BoostDefinition,
  ActiveBoost,
  BoostsState,
  EventCategory,
  EventEffect,
  EventDefinition,
  ActiveEvent,
  EventsState,
  DecorationCategory,
  DecorationSlot,
  DecorationCurrency,
  DecorationDefinition,
  DecorationsState,
  GameState,
  PlayerData,
  SavedUpgrades,
  SavedWorkers,
  PlayerStats,
  SaveData,
} from '@shared/types/game.ts'

import type {
  GameState,
  AchievementId,
  WorkerType,
  BoostType,
} from '@shared/types/game.ts'

// ── Frontend-only types ─────────────────────────────────────────────────────

export interface GameActions {
  handleClick: () => boolean
  purchaseClickUpgrade: () => boolean
  purchaseWorkSpeedUpgrade: () => void
  hireWorker: (workerType: WorkerType) => void
  startPassiveIncome: () => () => void
  resetGame: () => void
  saveProgress: () => void
  loadProgress: () => void
  addOfflineEarnings: (amount: number) => void
  clearOfflineEarnings: () => void
  purchaseMilestone: (level: number) => boolean
  checkForMilestone: () => void
  closeMilestoneModal: () => void
  checkAchievements: () => AchievementId[]
  claimAchievement: (achievementId: AchievementId) => boolean
  clearNewAchievementsFlag: () => void
  checkDailyReward: () => void
  claimDailyReward: () => void
  closeDailyRewardsModal: () => void
  openDailyRewardsModal: () => void
  canWatchRewardedVideo: () => boolean
  watchRewardedVideo: () => Promise<boolean>
  activateBoost: (type: BoostType) => boolean
  replaceBoost: (type: BoostType) => boolean
  tickBoosts: () => void
  getActiveMultiplier: (scope: 'income' | 'click') => number
  triggerRandomEvent: () => boolean
  clearEvent: () => void
  tickEvents: () => void
  getEventMultiplier: (scope: 'income' | 'click') => number
  getEventCostMultiplier: () => number
  purchaseDecoration: (id: string) => boolean
  toggleDecoration: (id: string) => void
}

export type GameStore = GameState & GameActions
