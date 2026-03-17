import { z } from 'zod'

export const syncSchema = z.object({
  clicksSinceLastSync: z.number().int().min(0).max(600),
  clientTimestamp: z.number().int().positive(),
}).strict()

export const actionSchema = z.object({
  type: z.enum([
    'purchase_upgrade',
    'hire_worker',
    'purchase_milestone',
    'purchase_decoration',
    'toggle_decoration',
    'activate_boost',
    'replace_boost',
    'claim_achievement',
    'claim_daily_reward',
    'watch_rewarded_video',
    'trigger_event',
  ]),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().uuid().optional(),
}).strict()

// Per-action payload schemas
export const purchaseUpgradePayload = z.object({
  upgradeType: z.enum(['clickPower', 'workSpeed']),
}).strict()

export const hireWorkerPayload = z.object({
  workerType: z.enum(['apprentice', 'mechanic', 'master', 'brigadier', 'director']),
}).strict()

export const purchaseMilestonePayload = z.object({
  level: z.number().int().positive(),
}).strict()

export const purchaseDecorationPayload = z.object({
  decorationId: z.string().min(1),
}).strict()

export const toggleDecorationPayload = z.object({
  decorationId: z.string().min(1),
}).strict()

export const activateBoostPayload = z.object({
  boostType: z.string().min(1),
}).strict()

export const replaceBoostPayload = z.object({
  boostType: z.string().min(1),
}).strict()

export const claimAchievementPayload = z.object({
  achievementId: z.string().min(1),
}).strict()

export const claimDailyRewardPayload = z.object({}).strict()

export const watchRewardedVideoPayload = z.object({}).strict()

export const triggerEventPayload = z.object({}).strict()
