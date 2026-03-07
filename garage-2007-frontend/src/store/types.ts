// src/store/types.ts
// All interfaces and type aliases for the game store.
// No imports from other store/* files to avoid circular deps.

// ── Workers ──────────────────────────────────────────────────────────────────

export type WorkerType = 'apprentice' | 'mechanic' | 'master' | 'brigadier' | 'director'
export type UpgradeType = 'clickPower' | 'workSpeed'

export interface UpgradeData {
  level: number
  cost: number
  baseCost: number
}

export interface WorkerData {
  count: number
  cost: number
}

export interface UpgradesState {
  clickPower: UpgradeData
  workSpeed: UpgradeData
}

export interface WorkersState {
  apprentice: WorkerData
  mechanic:   WorkerData
  master:     WorkerData
  brigadier:  WorkerData
  director:   WorkerData
}

// ── Achievements ─────────────────────────────────────────────────────────────

export type AchievementCategory = 'progression' | 'earnings' | 'clicks' | 'workers' | 'special'

export type AchievementId =
  | 'garage_level_2' | 'garage_level_5' | 'garage_level_10'
  | 'garage_level_15' | 'garage_level_20'
  | 'earned_10k' | 'earned_1m' | 'earned_1b'
  | 'clicks_100' | 'clicks_1000' | 'clicks_10000'
  | 'workers_1' | 'workers_5' | 'workers_10'
  | 'all_milestones'

export interface AchievementDefinition {
  id: AchievementId
  category: AchievementCategory
  title: string
  description: string
  icon: string
  targetValue: number
  nutsReward: number
  progressGetter: (state: GameState) => number
}

export interface PlayerAchievement {
  unlocked: boolean
  claimed: boolean
  unlockedAt?: number
}

// ── Daily / Video / Boosts ────────────────────────────────────────────────────

export interface DailyRewardsState {
  lastClaimTimestamp: number
  currentStreak: number
}

export interface RewardedVideoState {
  lastWatchedTimestamp: number
  totalWatches: number
  isWatching: boolean
}

export type BoostType = 'income_2x' | 'income_3x' | 'turbo'

export interface BoostDefinition {
  label: string
  costNuts: number
  durationMs: number
  multiplier: number
  description: string
  /** Уровень milestone, необходимый для разблокировки (0 = всегда доступен) */
  unlockLevel: number
}

export interface ActiveBoost {
  type: BoostType
  activatedAt: number
  expiresAt: number
}

export interface BoostsState {
  active: ActiveBoost[]
}

// ── GameState ─────────────────────────────────────────────────────────────────

export interface GameState {
  balance: number
  clickValue: number
  totalClicks: number
  garageLevel: number
  milestonesPurchased: number[]
  showMilestoneModal: boolean
  pendingMilestoneLevel: number | null
  dismissedMilestoneLevel: number | null
  passiveIncomePerSecond: number
  upgrades: UpgradesState
  workers: WorkersState
  nuts: number
  totalEarned: number
  sessionCount: number
  lastSessionDate: string
  isLoaded: boolean
  lastOfflineEarnings: number
  lastOfflineTimeAway: number
  momentaryClickIncome: number
  _clickIncomeThisTick: number
  peakClickIncome: number
  totalPlayTimeSeconds: number
  bestStreak: number
  achievements: Record<AchievementId, PlayerAchievement>
  hasNewAchievements: boolean
  dailyRewards: DailyRewardsState
  showDailyRewardsModal: boolean
  rewardedVideo: RewardedVideoState
  boosts: BoostsState
}

// ── GameActions ───────────────────────────────────────────────────────────────

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
  startBoostTick: () => () => void
}

export type GameStore = GameState & GameActions
