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
  PendingClick,
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
  purchaseClickUpgrade: () => Promise<boolean>
  purchaseWorkSpeedUpgrade: () => Promise<boolean>
  hireWorker: (workerType: WorkerType) => Promise<void>
  startPassiveIncome: () => () => void
  resetGame: () => void
  saveProgress: () => void
  loadProgress: () => void
  addOfflineEarnings: (amount: number) => void
  clearOfflineEarnings: () => void
  purchaseMilestone: (level: number) => Promise<boolean>
  checkForMilestone: () => void
  closeMilestoneModal: () => void
  checkAchievements: () => AchievementId[]
  claimAchievement: (achievementId: AchievementId) => Promise<boolean>
  clearNewAchievementsFlag: () => void
  checkDailyReward: () => void
  claimDailyReward: () => Promise<void>
  closeDailyRewardsModal: () => void
  openDailyRewardsModal: () => void
  canWatchRewardedVideo: () => boolean
  watchRewardedVideo: () => Promise<boolean>
  activateBoost: (type: BoostType) => Promise<boolean>
  replaceBoost: (type: BoostType) => Promise<boolean>
  tickBoosts: () => void
  getActiveMultiplier: (scope: 'income' | 'click') => number
  triggerRandomEvent: () => boolean
  clearEvent: () => void
  tickEvents: () => void
  getEventMultiplier: (scope: 'income' | 'click') => number
  getEventCostMultiplier: () => number
  purchaseDecoration: (id: string) => Promise<boolean>
  toggleDecoration: (id: string) => void
  applyServerState: (serverState: Record<string, unknown>) => void
}

export type GameStore = GameState & GameActions
