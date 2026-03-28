import { prisma } from '../../utils/prisma.js'
import { AppError } from '../../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../../utils/occ.js'
import { gsToNumbers } from '../../utils/decimal.js'
import { buildGameState } from '../gameStateService.js'
import { BOOST_DEFINITIONS } from '@shared/constants/boosts.js'
import { activateBoostPayload, replaceBoostPayload } from '../../validation/gameSchemas.js'
import type { BoostType } from '@shared/types/game.js'
import {
  parseBoosts,
  checkIdempotencyInTx,
  type ParsedBoosts,
  type ActionResult,
} from '../helpers/actionHelpers.js'

// ── 6. activate_boost ───────────────────────────────────────────────────────

export async function handleActivateBoost(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { boostType } = activateBoostPayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    const def = BOOST_DEFINITIONS[boostType as BoostType]
    if (!def) throw new AppError(400, 'BOOST_NOT_FOUND', 'Boost type not found')

    if (def.unlockLevel > 0 && !gs.milestonesPurchased.includes(def.unlockLevel)) {
      throw new AppError(400, 'BOOST_LOCKED', 'Boost not unlocked (milestone required)')
    }
    if (gs.nuts < def.costNuts) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough nuts for this boost')
    }

    const boosts = parseBoosts(gs.boosts)
    if (boosts.active.length > 0) {
      throw new AppError(400, 'BOOST_ALREADY_ACTIVE', 'A boost is already active')
    }

    const now = Date.now()
    const newNuts = gs.nuts - def.costNuts
    if (newNuts < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')
    const newBoosts: ParsedBoosts = {
      active: [
        ...boosts.active,
        { type: boostType, activatedAt: now, expiresAt: now + def.durationMs },
      ],
    }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      nuts: newNuts,
      boosts: newBoosts as object,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'activate_boost', currency: 'nuts',
        amount: -def.costNuts, balanceBefore: gs.nuts, balanceAfter: newNuts,
        metadata: { boostType, expiresAt: now + def.durationMs }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: {
        boostType,
        activatedAt: now,
        expiresAt: now + def.durationMs,
        costNuts: def.costNuts,
      },
    }
  }))
}

// ── 7. replace_boost ────────────────────────────────────────────────────────

export async function handleReplaceBoost(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { boostType } = replaceBoostPayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    const def = BOOST_DEFINITIONS[boostType as BoostType]
    if (!def) throw new AppError(400, 'BOOST_NOT_FOUND', 'Boost type not found')

    if (def.unlockLevel > 0 && !gs.milestonesPurchased.includes(def.unlockLevel)) {
      throw new AppError(400, 'BOOST_LOCKED', 'Boost not unlocked (milestone required)')
    }
    if (gs.nuts < def.costNuts) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough nuts for this boost')
    }

    const now = Date.now()
    const newNuts = gs.nuts - def.costNuts
    if (newNuts < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')
    // Replace: remove all active boosts, add new one
    const newBoosts: ParsedBoosts = {
      active: [{ type: boostType, activatedAt: now, expiresAt: now + def.durationMs }],
    }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      nuts: newNuts,
      boosts: newBoosts as object,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'activate_boost', currency: 'nuts',
        amount: -def.costNuts, balanceBefore: gs.nuts, balanceAfter: newNuts,
        metadata: { boostType, replaced: true, expiresAt: now + def.durationMs }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: {
        boostType,
        activatedAt: now,
        expiresAt: now + def.durationMs,
        costNuts: def.costNuts,
        replaced: true,
      },
    }
  }))
}
