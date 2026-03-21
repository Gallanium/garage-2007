import { prisma } from '../utils/prisma.js'
import { calculateClickIncome, calculateTotalPassiveIncome } from '@shared/formulas/income.js'
import { calculateUpgradeCost, calculateWorkerCost } from '@shared/formulas/costs.js'
import { checkAutoLevel, isWorkerUnlocked } from '@shared/formulas/progression.js'
import { roundCurrency } from '@shared/utils/math.js'
import { BASE_COSTS, CLICK_UPGRADE_MAX_LEVEL, WORKER_LIMITS } from '@shared/constants/economy.js'
import { MILESTONE_LEVELS, MILESTONE_UPGRADES } from '@shared/constants/garageLevels.js'
import type { MilestoneLevel } from '@shared/constants/garageLevels.js'
import { BOOST_DEFINITIONS } from '@shared/constants/boosts.js'
import { ACHIEVEMENTS, getTotalWorkerCount } from '@shared/constants/achievements.js'
import {
  DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS,
  REWARDED_VIDEO_NUTS, REWARDED_VIDEO_COOLDOWN_MS,
} from '@shared/constants/dailyRewards.js'
import { GAME_EVENTS, EVENT_CATEGORY_WEIGHTS, EVENT_COOLDOWN_MS, EVENT_RANDOM_DELAY_MS } from '@shared/constants/events.js'
import { DECORATION_CATALOG } from '@shared/constants/decorations.js'
import { AppError } from '../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../utils/occ.js'
import { logBalanceChange, logSuspiciousActivity, detectBalanceJump, detectRapidSync, detectTimingAnomaly } from './auditService.js'
import { buildGameState } from './gameStateService.js'
import {
  purchaseUpgradePayload, hireWorkerPayload, purchaseMilestonePayload,
  purchaseDecorationPayload, toggleDecorationPayload,
  activateBoostPayload, replaceBoostPayload, claimAchievementPayload,
} from '../validation/gameSchemas.js'
import { Prisma, type GameSave } from '@prisma/client'
import type { BoostType, AchievementId, AchievementProgressField, WorkerType, EventCategory } from '@shared/types/game.js'
import { logger } from '../utils/logger.js'

// ── Internal Types ──────────────────────────────────────────────────────────

interface ActiveBoostData {
  type: string
  activatedAt: number
  expiresAt: number
}

interface ParsedBoosts {
  active: ActiveBoostData[]
}

interface ActiveEventData {
  id: string
  activatedAt: number
  expiresAt: number
  eventSeed: number
}

interface ParsedEvents {
  activeEvent: ActiveEventData | null
  cooldownEnd: number
}

type ActionResult = {
  success: boolean
  gameState: Record<string, unknown>
  actionResult: Record<string, unknown>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseBoosts(boosts: unknown): ParsedBoosts {
  const b = boosts as { active?: ActiveBoostData[] } | null
  if (!b?.active) return { active: [] }
  const now = Date.now()
  return { active: b.active.filter(x => x.expiresAt > now) }
}

function parseEvents(events: unknown): ParsedEvents {
  const e = events as ParsedEvents | null
  if (!e) return { activeEvent: null, cooldownEnd: 0 }
  const now = Date.now()
  return {
    activeEvent: e.activeEvent && e.activeEvent.expiresAt > now ? e.activeEvent : null,
    cooldownEnd: e.cooldownEnd ?? 0,
  }
}

function getBoostMultiplier(boosts: ParsedBoosts, scope: 'income' | 'click'): number {
  let mult = 1
  const now = Date.now()
  for (const b of boosts.active) {
    if (b.expiresAt <= now) continue
    const def = BOOST_DEFINITIONS[b.type as BoostType]
    if (!def) continue
    // income_2x, income_3x apply to both income and click scopes; turbo affects 'click' scope only
    if (b.type === 'income_2x' || b.type === 'income_3x') {
      mult *= def.multiplier
    } else if (scope === 'click' && b.type === 'turbo') {
      mult *= def.multiplier
    }
  }
  return mult
}

function getEventMultiplier(events: ParsedEvents, scope: 'income' | 'click'): number {
  if (!events.activeEvent) return 1
  const ev = GAME_EVENTS[events.activeEvent.id]
  if (!ev || ev.effect.scope !== scope) return 1
  return ev.effect.multiplier
}

function getEventCostMultiplier(events: ParsedEvents): number {
  if (!events.activeEvent) return 1
  const ev = GAME_EVENTS[events.activeEvent.id]
  if (!ev || ev.effect.scope !== 'cost') return 1
  return ev.effect.multiplier
}

async function checkIdempotencyInTx(
  tx: { balanceLog: { findFirst: (args: { where: { idempotencyKey: string } }) => Promise<unknown> } },
  idempotencyKey?: string,
): Promise<void> {
  if (!idempotencyKey) return
  const existing = await tx.balanceLog.findFirst({ where: { idempotencyKey } })
  if (existing) throw new AppError(409, 'IDEMPOTENT_REQUEST', 'This action has already been processed')
}

function workerCountField(wt: WorkerType): string { return `${wt}Count` }
function workerCostField(wt: WorkerType): string { return `${wt}Cost` }

function getAchievementProgress(gs: GameSave, field: AchievementProgressField): number {
  switch (field) {
    case 'garageLevel': return gs.garageLevel
    case 'totalEarned': return gs.totalEarned
    case 'totalClicks': return gs.totalClicks
    case 'totalWorkerCount': return getTotalWorkerCount({
      apprentice: { count: gs.apprenticeCount, cost: 0 },
      mechanic: { count: gs.mechanicCount, cost: 0 },
      master: { count: gs.masterCount, cost: 0 },
      brigadier: { count: gs.brigadierCount, cost: 0 },
      director: { count: gs.directorCount, cost: 0 },
    })
    case 'milestonesCount': return gs.milestonesPurchased.length
  }
}

function weightedRandomPick<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * totalWeight
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

// OCC helpers (updateGameSaveWithLock, withOccRetry, TxClient) imported from ../utils/occ.js

// ── processSync ─────────────────────────────────────────────────────────────

export async function processSync(
  userId: number,
  clicksSinceLastSync: number,
  clientTimestamp?: number,
  syncNonce?: string,
): Promise<{ gameState: Record<string, unknown>; serverTime: number }> {
  // Anti-cheat: detect client timestamp anomaly (read-only, safe outside transaction)
  if (clientTimestamp) {
    detectTimingAnomaly(userId, clientTimestamp)
  }

  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    // Idempotency: if this syncNonce was already processed, return current state
    if (syncNonce) {
      const existing = await tx.balanceLog.findFirst({ where: { idempotencyKey: syncNonce } })
      if (existing) {
        return { gameState: buildGameState(gs), serverTime: Date.now() }
      }
    }

    const now = Date.now()

    const secondsSinceLastSync = Math.max(1, (now - gs.lastSyncAt.getTime()) / 1000)

    // Validate click rate: max 20 clicks/sec
    let clicks = Math.max(0, Math.floor(clicksSinceLastSync))
    const maxClicks = Math.floor(secondsSinceLastSync * 20)
    if (clicks > maxClicks) {
      logSuspiciousActivity({
        userId,
        reason: 'excessive_click_rate',
        details: { reported: clicks, max: maxClicks, seconds: secondsSinceLastSync },
      })
      clicks = maxClicks
    }

    const boosts = parseBoosts(gs.boosts)
    const events = parseEvents(gs.events)

    const boostClickMult = getBoostMultiplier(boosts, 'click')
    const boostIncomeMult = getBoostMultiplier(boosts, 'income')
    const eventClickMult = getEventMultiplier(events, 'click')
    const eventIncomeMult = getEventMultiplier(events, 'income')

    // Click income
    const clickIncome = roundCurrency(
      clicks * calculateClickIncome(gs.clickPowerLevel) * boostClickMult * eventClickMult,
    )

    // Passive income
    const workers = {
      apprentice: { count: gs.apprenticeCount },
      mechanic: { count: gs.mechanicCount },
      master: { count: gs.masterCount },
      brigadier: { count: gs.brigadierCount },
      director: { count: gs.directorCount },
    }
    const passivePerSec = calculateTotalPassiveIncome(workers, gs.workSpeedLevel)
    const passiveIncome = roundCurrency(
      secondsSinceLastSync * passivePerSec * boostIncomeMult * eventIncomeMult,
    )

    const totalIncome = roundCurrency(clickIncome + passiveIncome)
    const newBalance = roundCurrency(gs.balance + totalIncome)
    const newTotalEarned = roundCurrency(gs.totalEarned + totalIncome)
    const newTotalClicks = gs.totalClicks + clicks
    const newPlayTime = gs.totalPlayTimeSeconds + Math.floor(secondsSinceLastSync)
    const newPeakClickIncome = Math.max(
      gs.peakClickIncome,
      calculateClickIncome(gs.clickPowerLevel) * boostClickMult,
    )

    // Anti-cheat checks (logging only, safe inside transaction)
    detectBalanceJump(userId, gs.balance, newBalance)
    detectRapidSync(userId, gs.lastSyncAt)

    // Auto-level
    const newLevel = checkAutoLevel(newBalance, gs.garageLevel, gs.milestonesPurchased)

    // Tick boosts/events (remove expired)
    const tickedBoosts = parseBoosts(gs.boosts)
    const tickedEvents = parseEvents(gs.events)

    // BalanceLog entries (batch insert)
    const logEntries: Array<{
      userId: number; actionType: string; currency: string;
      amount: number; balanceBefore: number; balanceAfter: number;
      metadata: object; idempotencyKey?: string;
    }> = []

    if (clickIncome > 0) {
      logEntries.push({
        userId, actionType: 'click_income', currency: 'rubles',
        amount: clickIncome, balanceBefore: gs.balance,
        balanceAfter: roundCurrency(gs.balance + clickIncome),
        metadata: { clicks, clickPowerLevel: gs.clickPowerLevel },
        idempotencyKey: syncNonce,
      })
    }
    if (passiveIncome > 0) {
      logEntries.push({
        userId, actionType: 'passive_income', currency: 'rubles',
        amount: passiveIncome,
        balanceBefore: roundCurrency(gs.balance + clickIncome),
        balanceAfter: newBalance,
        metadata: { seconds: Math.floor(secondsSinceLastSync), passivePerSec },
        idempotencyKey: syncNonce ? `${syncNonce}:passive` : undefined,
      })
    }

    if (logEntries.length > 0) {
      await tx.balanceLog.createMany({ data: logEntries })
    }

    // Update GameSave with optimistic lock
    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      balance: newBalance,
      totalEarned: newTotalEarned,
      totalClicks: newTotalClicks,
      totalPlayTimeSeconds: newPlayTime,
      peakClickIncome: newPeakClickIncome,
      garageLevel: newLevel,
      boosts: tickedBoosts as object,
      events: tickedEvents as object,
      lastSyncAt: new Date(),
      gameDataSnapshot: Prisma.DbNull,
    })

    return { gameState: buildGameState(updated), serverTime: Date.now() }
  }))
}

// ── processAction ───────────────────────────────────────────────────────────

export async function processAction(
  userId: number,
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  // Idempotency check
  if (idempotencyKey) {
    const existing = await prisma.balanceLog.findFirst({ where: { idempotencyKey } })
    if (existing) {
      const gs = await prisma.gameSave.findUnique({ where: { userId } })
      if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')
      throw new AppError(409, 'IDEMPOTENT_REQUEST', 'This action has already been processed')
    }
  }

  switch (type) {
    case 'purchase_upgrade': return handlePurchaseUpgrade(userId, payload, idempotencyKey)
    case 'hire_worker': return handleHireWorker(userId, payload, idempotencyKey)
    case 'purchase_milestone': return handlePurchaseMilestone(userId, payload, idempotencyKey)
    case 'purchase_decoration': return handlePurchaseDecoration(userId, payload, idempotencyKey)
    case 'toggle_decoration': return handleToggleDecoration(userId, payload)
    case 'activate_boost': return handleActivateBoost(userId, payload, idempotencyKey)
    case 'replace_boost': return handleReplaceBoost(userId, payload, idempotencyKey)
    case 'claim_achievement': return handleClaimAchievement(userId, payload, idempotencyKey)
    case 'claim_daily_reward': return handleClaimDailyReward(userId, idempotencyKey)
    case 'watch_rewarded_video': return handleWatchRewardedVideo(userId, idempotencyKey)
    case 'trigger_event': return handleTriggerEvent(userId)
    default: throw new AppError(400, 'UNKNOWN_ACTION', `Unknown action type: ${type}`)
  }
}

// ── 1. purchase_upgrade ─────────────────────────────────────────────────────

async function handlePurchaseUpgrade(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { upgradeType } = purchaseUpgradePayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

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

async function handleHireWorker(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { workerType } = hireWorkerPayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

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

async function handlePurchaseMilestone(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { level } = purchaseMilestonePayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    if (!(MILESTONE_LEVELS as readonly number[]).includes(level)) {
      throw new AppError(400, 'INVALID_MILESTONE', 'Invalid milestone level')
    }
    if (gs.milestonesPurchased.includes(level)) {
      throw new AppError(400, 'MILESTONE_ALREADY_PURCHASED', 'Milestone already purchased')
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

async function handlePurchaseDecoration(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { decorationId } = purchaseDecorationPayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

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

// ── 5. toggle_decoration ────────────────────────────────────────────────────

async function handleToggleDecoration(
  userId: number,
  payload: Record<string, unknown>,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { decorationId } = toggleDecorationPayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    if (!gs.decorationsOwned.includes(decorationId)) {
      throw new AppError(400, 'DECORATION_NOT_FOUND', 'Decoration not owned')
    }

    const isActive = gs.decorationsActive.includes(decorationId)
    let newActive: string[]

    if (isActive) {
      // Deactivate
      newActive = gs.decorationsActive.filter(id => id !== decorationId)
    } else {
      // Activate — deactivate others in same slot
      const dec = DECORATION_CATALOG[decorationId]
      newActive = gs.decorationsActive.filter(id => {
        const d = DECORATION_CATALOG[id]
        return d && dec && d.slot !== dec.slot
      })
      newActive.push(decorationId)
    }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      decorationsActive: newActive,
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { decorationId, active: !isActive },
    }
  }))
}

// ── 6. activate_boost ───────────────────────────────────────────────────────

async function handleActivateBoost(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { boostType } = activateBoostPayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

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

async function handleReplaceBoost(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { boostType } = replaceBoostPayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

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

// ── 8. claim_achievement ────────────────────────────────────────────────────

async function handleClaimAchievement(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { achievementId } = claimAchievementPayload.parse(payload)
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    await checkIdempotencyInTx(tx, idempotencyKey)

    const def = ACHIEVEMENTS[achievementId as AchievementId]
    if (!def) throw new AppError(400, 'ACHIEVEMENT_NOT_FOUND', 'Achievement not found')

    const achievements = gs.achievements as Record<string, { unlocked: boolean; claimed: boolean; unlockedAt?: number }>
    const playerAch = achievements[achievementId]

    // Check if achievement is unlocked (compute from current state)
    const progress = getAchievementProgress(gs, def.progressField)
    const isUnlocked = playerAch?.unlocked || progress >= def.targetValue

    if (!isUnlocked) {
      throw new AppError(400, 'ACHIEVEMENT_NOT_UNLOCKED', 'Achievement is not unlocked yet')
    }
    if (playerAch?.claimed) {
      throw new AppError(400, 'ACHIEVEMENT_ALREADY_CLAIMED', 'Achievement has already been claimed')
    }

    const newNuts = gs.nuts + def.nutsReward
    const updatedAchievements = {
      ...achievements,
      [achievementId]: {
        unlocked: true,
        claimed: true,
        unlockedAt: playerAch?.unlockedAt ?? Date.now(),
      },
    }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      nuts: newNuts,
      achievements: updatedAchievements,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'achievement_reward', currency: 'nuts',
        amount: def.nutsReward, balanceBefore: gs.nuts, balanceAfter: newNuts,
        metadata: { achievementId }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { achievementId, nutsRewarded: def.nutsReward },
    }
  }))
}

// ── 9. claim_daily_reward ───────────────────────────────────────────────────

async function handleClaimDailyReward(
  userId: number,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    await checkIdempotencyInTx(tx, idempotencyKey)

    const daily = gs.dailyRewards as { lastClaimTimestamp: number; currentStreak: number } | null
    const lastClaim = daily?.lastClaimTimestamp ?? 0
    const currentStreak = daily?.currentStreak ?? 0
    const now = Date.now()

    // Check 24h cooldown from last claim
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
    const timeSinceLastClaim = now - lastClaim
    if (lastClaim > 0 && timeSinceLastClaim < TWENTY_FOUR_HOURS_MS) {
      throw new AppError(400, 'DAILY_REWARD_COOLDOWN', 'Daily reward already claimed today')
    }

    // Calculate streak: reset if more than 24h + grace period since last claim
    let newStreak: number
    if (lastClaim === 0 || timeSinceLastClaim > TWENTY_FOUR_HOURS_MS + DAILY_STREAK_GRACE_PERIOD_MS) {
      newStreak = 0
    } else {
      newStreak = currentStreak
    }

    const rewardIndex = newStreak % DAILY_REWARDS.length
    const reward = DAILY_REWARDS[rewardIndex]
    const newNuts = gs.nuts + reward
    const updatedStreak = newStreak + 1
    const newDailyRewards = { lastClaimTimestamp: now, currentStreak: updatedStreak }

    // Update best streak
    const newBestStreak = Math.max(gs.bestStreak, updatedStreak)

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      nuts: newNuts,
      dailyRewards: newDailyRewards,
      bestStreak: newBestStreak,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'daily_reward', currency: 'nuts',
        amount: reward, balanceBefore: gs.nuts, balanceAfter: newNuts,
        metadata: { streak: updatedStreak, day: rewardIndex }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { nutsRewarded: reward, streak: updatedStreak, day: rewardIndex },
    }
  }))
}

// ── 10. watch_rewarded_video ────────────────────────────────────────────────

async function handleWatchRewardedVideo(
  userId: number,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    await checkIdempotencyInTx(tx, idempotencyKey)

    const video = gs.rewardedVideo as { lastWatchedTimestamp: number; totalWatches: number } | null
    const lastWatched = video?.lastWatchedTimestamp ?? 0
    const totalWatches = video?.totalWatches ?? 0
    const now = Date.now()

    if (lastWatched > 0 && now - lastWatched < REWARDED_VIDEO_COOLDOWN_MS) {
      throw new AppError(400, 'VIDEO_COOLDOWN', 'Rewarded video is still on cooldown')
    }

    const newNuts = gs.nuts + REWARDED_VIDEO_NUTS
    const newTotalWatches = totalWatches + 1
    const newVideo = { lastWatchedTimestamp: now, totalWatches: newTotalWatches }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      nuts: newNuts,
      rewardedVideo: newVideo,
    })

    await tx.balanceLog.create({
      data: {
        userId, actionType: 'video_reward', currency: 'nuts',
        amount: REWARDED_VIDEO_NUTS, balanceBefore: gs.nuts, balanceAfter: newNuts,
        metadata: { totalWatches: newTotalWatches }, idempotencyKey,
      },
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: { nutsRewarded: REWARDED_VIDEO_NUTS, totalWatches: newTotalWatches },
    }
  }))
}

// ── 11. trigger_event ───────────────────────────────────────────────────────

async function handleTriggerEvent(userId: number): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    const events = parseEvents(gs.events)
    const now = Date.now()

    if (events.cooldownEnd > now) {
      throw new AppError(400, 'EVENT_COOLDOWN', 'Events are still on cooldown')
    }

    // Weighted random: first pick category by EVENT_CATEGORY_WEIGHTS
    const categoryEntries = Object.entries(EVENT_CATEGORY_WEIGHTS).map(
      ([category, weight]) => ({ category, weight }),
    )
    const selectedCategory = weightedRandomPick(categoryEntries)

    // Pick event within category by weight
    const categoryEvents = Object.values(GAME_EVENTS)
      .filter(e => e.category === selectedCategory.category)
      .map(e => ({ ...e, weight: e.weight ?? 1 }))

    if (categoryEvents.length === 0) {
      throw new AppError(500, 'INVALID_ACTION', 'No events available in selected category')
    }

    const selectedEvent = weightedRandomPick(categoryEvents)

    const activeEvent: ActiveEventData = {
      id: selectedEvent.id,
      activatedAt: now,
      expiresAt: now + selectedEvent.durationMs,
      eventSeed: Math.floor(Math.random() * 1000000),
    }

    const randomDelay = Math.floor(Math.random() * EVENT_RANDOM_DELAY_MS)
    const cooldownEnd = now + selectedEvent.durationMs + EVENT_COOLDOWN_MS + randomDelay

    const newEvents: ParsedEvents = { activeEvent, cooldownEnd }

    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      events: newEvents as object,
    })

    return {
      success: true,
      gameState: buildGameState(updated),
      actionResult: {
        eventId: selectedEvent.id,
        category: selectedEvent.category,
        scope: selectedEvent.effect.scope,
        multiplier: selectedEvent.effect.multiplier,
        expiresAt: activeEvent.expiresAt,
      },
    }
  }))
}
