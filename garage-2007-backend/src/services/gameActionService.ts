import { prisma } from '../utils/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { buildGameState } from './gameStateService.js'
import { gsToNumbers } from '../utils/decimal.js'
import { type ActionResult } from './helpers/actionHelpers.js'

// Re-export public API
export { processSync } from './sync/syncService.js'
export type { ActionResult } from './helpers/actionHelpers.js'

// Import all action handlers
import { handlePurchaseUpgrade, handleHireWorker, handlePurchaseMilestone, handlePurchaseDecoration } from './actions/purchaseHandlers.js'
import { handleToggleDecoration } from './actions/decorationHandlers.js'
import { handleActivateBoost, handleReplaceBoost } from './actions/boostHandlers.js'
import { handleClaimAchievement, handleClaimDailyReward, handleWatchRewardedVideo, handleTriggerEvent } from './actions/rewardHandlers.js'

// ── processAction ───────────────────────────────────────────────────────────

export async function processAction(
  userId: number,
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  // Idempotency check: return 200 with current state for duplicate requests
  if (idempotencyKey) {
    const existing = await prisma.balanceLog.findFirst({ where: { idempotencyKey } })
    if (existing) {
      const gs = gsToNumbers(await prisma.gameSave.findUnique({ where: { userId } }))
      if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
      return {
        success: true,
        gameState: buildGameState(gs),
        actionResult: { alreadyProcessed: true },
      }
    }
  }

  switch (type) {
    case 'purchase_upgrade': return handlePurchaseUpgrade(userId, payload, idempotencyKey)
    case 'hire_worker': return handleHireWorker(userId, payload, idempotencyKey)
    case 'purchase_milestone': return handlePurchaseMilestone(userId, payload, idempotencyKey)
    case 'purchase_decoration': return handlePurchaseDecoration(userId, payload, idempotencyKey)
    case 'toggle_decoration': return handleToggleDecoration(userId, payload, idempotencyKey)
    case 'activate_boost': return handleActivateBoost(userId, payload, idempotencyKey)
    case 'replace_boost': return handleReplaceBoost(userId, payload, idempotencyKey)
    case 'claim_achievement': return handleClaimAchievement(userId, payload, idempotencyKey)
    case 'claim_daily_reward': return handleClaimDailyReward(userId, idempotencyKey)
    case 'watch_rewarded_video': return handleWatchRewardedVideo(userId, idempotencyKey)
    case 'trigger_event': return handleTriggerEvent(userId, idempotencyKey)
    default: throw new AppError(400, 'UNKNOWN_ACTION', `Unknown action type: ${type}`)
  }
}
