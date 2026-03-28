import { prisma } from '../../utils/prisma.js'
import { AppError } from '../../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../../utils/occ.js'
import { gsToNumbers } from '../../utils/decimal.js'
import { buildGameState } from '../gameStateService.js'
import { calculateUpgradeCost, calculateWorkerCost } from '@shared/formulas/costs.js'
import { checkAutoLevel, isWorkerUnlocked } from '@shared/formulas/progression.js'
import { roundCurrency } from '@shared/utils/math.js'
import { BASE_COSTS, CLICK_UPGRADE_MAX_LEVEL, WORKER_LIMITS } from '@shared/constants/economy.js'
import { MILESTONE_LEVELS, MILESTONE_UPGRADES } from '@shared/constants/garageLevels.js'
import type { MilestoneLevel } from '@shared/constants/garageLevels.js'
import { DECORATION_CATALOG } from '@shared/constants/decorations.js'
import {
  purchaseUpgradePayload, hireWorkerPayload, purchaseMilestonePayload,
  purchaseDecorationPayload,
} from '../../validation/gameSchemas.js'
import type { WorkerType } from '@shared/types/game.js'
import type { GameSave } from '@prisma/client'
import {
  parseEvents,
  getEventCostMultiplier,
  checkIdempotencyInTx,
  workerCountField,
  workerCostField,
  type ActionResult,
} from '../helpers/actionHelpers.js'

// ── 1. purchase_upgrade ─────────────────────────────────────────────────────

export async function handlePurchaseUpgrade(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { upgradeType } = purchaseUpgradePayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    const levelField = upgradeType === 'clickPower' ? 'clickPowerLevel' : 'workSpeedLevel'
    const costField = upgradeType === 'clickPower' ? 'clickPowerCost' : 'workSpeedCost'
    const currentLevel = gs[levelField]
    const currentCost = gs[costField]

    if (currentLevel >= CLICK_UPGRADE_MAX_LEVEL) {
      throw new AppError(400, 'MAX_LEVEL_REACHED', 'Upgrade is already at max level')
    }

    const events = parseEvents(gs.events)
    const costMultiplier = getEventCostMultiplier(events)
    const finalCost = roundCurrency(currentCost * costMultiplier)

    if (gs.balance < finalCost) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough rubles for this upgrade')
    }

    const newBalance = roundCurrency(gs.balance - finalCost)
    if (newBalance < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')
    const newLevel = currentLevel + 1
    const baseCost = upgradeType === 'clickPower' ? BASE_COSTS.clickUpgrade : BASE_COSTS.workSpeed
    const newCost = calculateUpgradeCost(baseCost, newLevel)

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      balance: newBalance,
      [levelField]: newLevel,
      [costField]: newCost,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'purchase_upgrade', currency: 'rubles',
        amount: -finalCost, balanceBefore: gs.balance, balanceAfter: newBalance,
        metadata: { upgradeType, level: newLevel }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { upgradeType, level: newLevel, cost: finalCost },
    }
  }))
}

// ── 2. hire_worker ──────────────────────────────────────────────────────────

export async function handleHireWorker(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { workerType } = hireWorkerPayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    const countKey = workerCountField(workerType as WorkerType) as keyof GameSave
    const costKey = workerCostField(workerType as WorkerType) as keyof GameSave
    const currentCount = gs[countKey] as number
    const currentCost = gs[costKey] as number
    const limit = WORKER_LIMITS[workerType as keyof typeof WORKER_LIMITS]

    if (currentCount >= limit) {
      throw new AppError(400, 'WORKER_LIMIT_REACHED', 'Worker count is at the limit')
    }
    if (!isWorkerUnlocked(workerType as WorkerType, gs.milestonesPurchased)) {
      throw new AppError(400, 'WORKER_LOCKED', 'Worker type is not unlocked yet')
    }

    const events = parseEvents(gs.events)
    const costMultiplier = getEventCostMultiplier(events)
    const finalCost = roundCurrency(currentCost * costMultiplier)

    if (gs.balance < finalCost) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough rubles to hire this worker')
    }

    const newBalance = roundCurrency(gs.balance - finalCost)
    if (newBalance < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')
    const newCount = currentCount + 1
    const baseCost = BASE_COSTS[workerType as keyof typeof BASE_COSTS]
    const newCost = calculateWorkerCost(baseCost, newCount)

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      balance: newBalance,
      [countKey as string]: newCount,
      [costKey as string]: newCost,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'hire_worker', currency: 'rubles',
        amount: -finalCost, balanceBefore: gs.balance, balanceAfter: newBalance,
        metadata: { workerType, count: newCount }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { workerType, count: newCount, cost: finalCost },
    }
  }))
}

// ── 3. purchase_milestone ───────────────────────────────────────────────────

export async function handlePurchaseMilestone(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { level } = purchaseMilestonePayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    if (!(MILESTONE_LEVELS as readonly number[]).includes(level)) {
      throw new AppError(400, 'INVALID_MILESTONE', 'Invalid milestone level')
    }
    if (gs.milestonesPurchased.includes(level)) {
      throw new AppError(400, 'MILESTONE_ALREADY_PURCHASED', 'Milestone already purchased')
    }

    // Progression gate: garage level must reach milestone level
    if (gs.garageLevel < level) {
      throw new AppError(400, 'LEVEL_TOO_LOW', 'Garage level too low for this milestone')
    }

    // Sequential order: all lower milestones must be purchased first
    const lowerMilestones = (MILESTONE_LEVELS as readonly number[]).filter(m => m < level)
    if (lowerMilestones.some(m => !gs.milestonesPurchased.includes(m))) {
      throw new AppError(400, 'PREREQUISITE_MISSING', 'Must purchase previous milestones first')
    }

    const milestoneData = MILESTONE_UPGRADES[level as MilestoneLevel]
    if (gs.balance < milestoneData.cost) {
      throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough rubles for this milestone')
    }

    const newBalance = roundCurrency(gs.balance - milestoneData.cost)
    if (newBalance < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')
    const newMilestones = [...gs.milestonesPurchased, level]
    const newLevel = checkAutoLevel(newBalance, gs.garageLevel, newMilestones)

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      balance: newBalance,
      milestonesPurchased: newMilestones,
      garageLevel: newLevel,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'purchase_milestone', currency: 'rubles',
        amount: -milestoneData.cost, balanceBefore: gs.balance, balanceAfter: newBalance,
        metadata: { level, garageLevel: newLevel }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { level, cost: milestoneData.cost, garageLevel: newLevel },
    }
  }))
}

// ── 4. purchase_decoration ──────────────────────────────────────────────────

export async function handlePurchaseDecoration(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { decorationId } = purchaseDecorationPayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
    await checkIdempotencyInTx(tx, idempotencyKey)

    const dec = DECORATION_CATALOG[decorationId]
    if (!dec) throw new AppError(400, 'DECORATION_NOT_FOUND', 'Decoration not found')
    if (gs.decorationsOwned.includes(decorationId)) {
      throw new AppError(400, 'DECORATION_ALREADY_OWNED', 'Decoration already owned')
    }
    if (gs.garageLevel < dec.unlockLevel) {
      throw new AppError(400, 'DECORATION_LOCKED', 'Garage level too low for this decoration')
    }

    const currency = dec.currency
    const cost = dec.cost

    // Slot displacement: deactivate other decorations in same slot
    const newActive = gs.decorationsActive.filter(id => {
      const d = DECORATION_CATALOG[id]
      return d && d.slot !== dec.slot
    })
    newActive.push(decorationId)

    const newDecorationsOwned = [...gs.decorationsOwned, decorationId]

    if (currency === 'rubles') {
      if (gs.balance < cost) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough rubles for this decoration')
      }

      const newBalance = roundCurrency(gs.balance - cost)
      if (newBalance < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')

      const updated = await updateGameSaveWithLock(tx, userId, gs, {
        balance: newBalance,
        decorationsOwned: newDecorationsOwned,
        decorationsActive: newActive,
      })

      await tx.balanceLog.create({
        data: {
          userId, actionType: 'purchase_decoration', currency: 'rubles',
          amount: -cost, balanceBefore: gs.balance, balanceAfter: newBalance,
          metadata: { decorationId, slot: dec.slot }, idempotencyKey,
        },
      })

      return {
        success: true,
        gameState: buildGameState(updated),
        actionResult: { decorationId, cost, currency: 'rubles' },
      }
    } else {
      if (gs.nuts < cost) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', 'Not enough nuts for this decoration')
      }

      const newNuts = gs.nuts - cost
      if (newNuts < 0) throw new AppError(500, 'INTERNAL_ERROR', 'Balance calculation error')

      const updated = await updateGameSaveWithLock(tx, userId, gs, {
        nuts: newNuts,
        decorationsOwned: newDecorationsOwned,
        decorationsActive: newActive,
      })

      await tx.balanceLog.create({
        data: {
          userId, actionType: 'purchase_decoration', currency: 'nuts',
          amount: -cost, balanceBefore: gs.nuts, balanceAfter: newNuts,
          metadata: { decorationId, slot: dec.slot }, idempotencyKey,
        },
      })

      return {
        success: true,
        gameState: buildGameState(updated),
        actionResult: { decorationId, cost, currency: 'nuts' },
      }
    }
  }))
}
