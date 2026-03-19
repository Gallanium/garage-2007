// shared/types/actions.ts
// Game action types for server-authoritative action processing.

import type { BoostType, UpgradeType, WorkerType } from './game.js'

export interface PurchaseUpgradePayload {
  upgradeType: UpgradeType
}

export interface HireWorkerPayload {
  workerType: WorkerType
}

export interface PurchaseMilestonePayload {
  level: number
}

export interface PurchaseDecorationPayload {
  decorationId: string
}

export interface ToggleDecorationPayload {
  decorationId: string
}

export interface ActivateBoostPayload {
  boostType: BoostType
}

export interface ReplaceBoostPayload {
  boostType: BoostType
}

export interface ClaimAchievementPayload {
  achievementId: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClaimDailyRewardPayload {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WatchRewardedVideoPayload {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TriggerEventPayload {}

export type GameActionType =
  | 'purchase_upgrade'
  | 'hire_worker'
  | 'purchase_milestone'
  | 'purchase_decoration'
  | 'toggle_decoration'
  | 'activate_boost'
  | 'replace_boost'
  | 'claim_achievement'
  | 'claim_daily_reward'
  | 'watch_rewarded_video'
  | 'trigger_event'

export type GameActionPayload =
  | { type: 'purchase_upgrade'; payload: PurchaseUpgradePayload }
  | { type: 'hire_worker'; payload: HireWorkerPayload }
  | { type: 'purchase_milestone'; payload: PurchaseMilestonePayload }
  | { type: 'purchase_decoration'; payload: PurchaseDecorationPayload }
  | { type: 'toggle_decoration'; payload: ToggleDecorationPayload }
  | { type: 'activate_boost'; payload: ActivateBoostPayload }
  | { type: 'replace_boost'; payload: ReplaceBoostPayload }
  | { type: 'claim_achievement'; payload: ClaimAchievementPayload }
  | { type: 'claim_daily_reward'; payload: ClaimDailyRewardPayload }
  | { type: 'watch_rewarded_video'; payload: WatchRewardedVideoPayload }
  | { type: 'trigger_event'; payload: TriggerEventPayload }

export interface GameActionRequest {
  type: GameActionType
  payload: Record<string, unknown>
  idempotencyKey?: string
}

export interface SyncRequest {
  clicksSinceLastSync: number
  clientTimestamp: number
}

export interface GameStateResponse {
  gameState: Record<string, unknown> | null
  offlineEarnings?: { amount: number; timeAway: number }
  serverTime: number
}

export interface ActionResponse {
  success: boolean
  gameState?: Record<string, unknown>
  actionResult?: Record<string, unknown>
  error?: string
  message?: string
}
