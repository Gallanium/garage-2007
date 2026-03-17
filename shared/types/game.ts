// shared/types/game.ts
// All shared game types. Frontend-only types (GameActions, GameStore) stay in frontend.

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

export type AchievementProgressField =
  | 'garageLevel'
  | 'totalEarned'
  | 'totalClicks'
  | 'totalWorkerCount'
  | 'milestonesCount'

export interface AchievementDefinition {
  id: AchievementId
  category: AchievementCategory
  title: string
  description: string
  icon: string
  targetValue: number
  nutsReward: number
  progressField: AchievementProgressField
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

// ── Events ────────────────────────────────────────────────────────────────────

export type EventCategory = 'positive' | 'negative' | 'neutral'

export interface EventEffect {
  scope: 'income' | 'click' | 'cost'
  multiplier: number
}

export interface EventDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: EventCategory
  effect: EventEffect
  durationMs: number
  weight: number
}

export interface ActiveEvent {
  id: string
  activatedAt: number
  expiresAt: number
  eventSeed: number
}

export interface EventsState {
  activeEvent: ActiveEvent | null
  cooldownEnd: number
}

// ── Decorations ───────────────────────────────────────────────────────────────

export type DecorationCategory = 'tools' | 'wall_decor' | 'lighting' | 'cars' | 'trophies'

export type DecorationSlot =
  | 'workbench_area'
  | 'left_wall'
  | 'back_wall_left'
  | 'back_wall_center'
  | 'back_wall_right'
  | 'floor_main'
  | 'right_shelf_top'
  | 'right_shelf_mid'
  | 'right_shelf_bottom'
  | 'right_shelf_extra'
  | 'right_wall'

export type DecorationCurrency = 'rubles' | 'nuts'

export interface DecorationDefinition {
  id: string
  category: DecorationCategory
  slot: DecorationSlot
  name: string
  icon: string
  description: string
  currency: DecorationCurrency
  cost: number
  unlockLevel: number
  position: { x: number; y: number }
  size: { w: number; h: number }
  color: number
}

export interface DecorationsState {
  owned: string[]
  active: string[]
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
  _milestoneDismissedAt: number
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
  events: EventsState
  decorations: DecorationsState
  /** Clicks accumulated since last server sync (frontend-only counter) */
  _clicksSinceLastSync: number
}

// ── Persistence types ────────────────────────────────────────────────────────

export interface PlayerData {
  balance: number
  nuts: number
  totalClicks: number
  garageLevel: number
  milestonesPurchased: number[]
}

export interface SavedUpgrades {
  clickPower: { level: number; cost: number }
  workSpeed: { level: number; cost: number }
}

export interface SavedWorkers {
  apprentice: { count: number; cost: number }
  mechanic: { count: number; cost: number }
  master: { count: number; cost: number }
  brigadier: { count: number; cost: number }
  director: { count: number; cost: number }
}

export interface PlayerStats {
  totalEarned: number
  sessionCount: number
  lastSessionDate: string
  peakClickIncome: number
  totalPlayTimeSeconds: number
  bestStreak: number
}

export interface SaveData {
  version: number
  timestamp: number
  playerData: PlayerData
  upgrades: SavedUpgrades
  workers: SavedWorkers
  stats: PlayerStats
  achievements?: Record<string, { unlocked: boolean; claimed: boolean; unlockedAt?: number }>
  dailyRewards?: {
    lastClaimTimestamp: number
    currentStreak: number
  }
  rewardedVideo?: {
    lastWatchedTimestamp: number
    totalWatches: number
  }
  boosts?: {
    active: Array<{ type: string; activatedAt: number; expiresAt: number }>
  }
  events?: {
    activeEvent: { id: string; activatedAt: number; expiresAt: number; eventSeed: number } | null
    cooldownEnd: number
  }
  decorations?: {
    owned: string[]
    active: string[]
  }
}
