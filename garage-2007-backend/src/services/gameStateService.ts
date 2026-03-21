import { prisma } from '../utils/prisma.js'
import { calculateTotalPassiveIncome } from '@shared/formulas/income.js'
import { calculateOfflineEarnings } from '@shared/formulas/offlineEarnings.js'
import { checkAutoLevel } from '@shared/formulas/progression.js'
import { roundCurrency } from '@shared/utils/math.js'
import { BASE_COSTS } from '@shared/constants/economy.js'
import { logBalanceChange, detectBalanceJump } from './auditService.js'
import { AppError } from '../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../utils/occ.js'
import { logger } from '../utils/logger.js'
import type { GameSave } from '@prisma/client'

interface WorkersMap {
  [key: string]: { count: number; cost: number }
  apprentice: { count: number; cost: number }
  mechanic: { count: number; cost: number }
  master: { count: number; cost: number }
  brigadier: { count: number; cost: number }
  director: { count: number; cost: number }
}

function extractWorkers(gs: GameSave): WorkersMap {
  return {
    apprentice: { count: gs.apprenticeCount, cost: gs.apprenticeCost },
    mechanic: { count: gs.mechanicCount, cost: gs.mechanicCost },
    master: { count: gs.masterCount, cost: gs.masterCost },
    brigadier: { count: gs.brigadierCount, cost: gs.brigadierCost },
    director: { count: gs.directorCount, cost: gs.directorCost },
  }
}

function tickBoosts(boosts: unknown): { active: Array<{ type: string; activatedAt: number; expiresAt: number }> } {
  const b = boosts as { active?: Array<{ type: string; activatedAt: number; expiresAt: number }> } | null
  if (!b?.active) return { active: [] }
  const now = Date.now()
  return { active: b.active.filter(boost => boost.expiresAt > now) }
}

function tickEvents(events: unknown): { activeEvent: { id: string; activatedAt: number; expiresAt: number; eventSeed: number } | null; cooldownEnd: number } {
  const e = events as { activeEvent?: { id: string; activatedAt: number; expiresAt: number; eventSeed: number } | null; cooldownEnd?: number } | null
  if (!e) return { activeEvent: null, cooldownEnd: 0 }
  const now = Date.now()
  const activeEvent = e.activeEvent && e.activeEvent.expiresAt > now ? e.activeEvent : null
  return { activeEvent, cooldownEnd: e.cooldownEnd ?? 0 }
}

export function buildGameState(gs: GameSave): Record<string, unknown> {
  const workers = extractWorkers(gs)
  const boosts = tickBoosts(gs.boosts)
  const events = tickEvents(gs.events)

  return {
    balance: gs.balance,
    nuts: gs.nuts,
    garageLevel: gs.garageLevel,
    totalClicks: gs.totalClicks,
    totalEarned: gs.totalEarned,
    milestonesPurchased: gs.milestonesPurchased,
    upgrades: {
      clickPower: { level: gs.clickPowerLevel, cost: gs.clickPowerCost, baseCost: BASE_COSTS.clickUpgrade },
      workSpeed: { level: gs.workSpeedLevel, cost: gs.workSpeedCost, baseCost: BASE_COSTS.workSpeed },
    },
    workers,
    sessionCount: gs.sessionCount,
    lastSessionDate: gs.lastSessionDate,
    peakClickIncome: gs.peakClickIncome,
    totalPlayTimeSeconds: gs.totalPlayTimeSeconds,
    bestStreak: gs.bestStreak,
    achievements: gs.achievements,
    dailyRewards: gs.dailyRewards,
    rewardedVideo: gs.rewardedVideo,
    boosts,
    events,
    decorations: {
      owned: gs.decorationsOwned,
      active: gs.decorationsActive,
    },
  }
}

export async function loadState(userId: number): Promise<{
  gameState: Record<string, unknown> | null
  offlineEarnings?: { amount: number; timeAway: number }
  serverTime: number
}> {
  // Quick check: does the user have a game save at all?
  // (avoids spinning up retries for brand-new users)
  const exists = await prisma.gameSave.findUnique({ where: { userId }, select: { userId: true } })
  if (!exists) {
    return { gameState: null, serverTime: Date.now() }
  }

  // Read + compute + update inside the retry lambda so that on version
  // conflict the retry re-reads the FRESH row instead of using stale data.
  const { updated, offlineAmount, elapsedSeconds, passiveIncome, balanceBefore } =
    await withOccRetry(() => prisma.$transaction(async (tx) => {
      const gameSave = await tx.gameSave.findUnique({ where: { userId } })
      if (!gameSave) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

      // Compute offline earnings (base passive income only — boosts intentionally excluded)
      const workers = extractWorkers(gameSave)
      const pi = calculateTotalPassiveIncome(workers, gameSave.workSpeedLevel)
      const elapsed = (Date.now() - gameSave.lastSyncAt.getTime()) / 1000
      const offline = calculateOfflineEarnings(pi, elapsed)

      let updatedBalance = gameSave.balance
      let updatedTotalEarned = gameSave.totalEarned

      if (offline > 0) {
        updatedBalance = roundCurrency(updatedBalance + offline)
        updatedTotalEarned = roundCurrency(updatedTotalEarned + offline)

        detectBalanceJump(userId, gameSave.balance, updatedBalance)
      }

      // Tick boosts and events
      const boosts = tickBoosts(gameSave.boosts)
      const events = tickEvents(gameSave.events)

      // Auto-level
      const newLevel = checkAutoLevel(updatedBalance, gameSave.garageLevel, gameSave.milestonesPurchased)

      const result = await updateGameSaveWithLock(tx, userId, gameSave, {
        balance: updatedBalance,
        totalEarned: updatedTotalEarned,
        garageLevel: newLevel,
        boosts: boosts as object,
        events: events as object,
        lastSyncAt: new Date(),
        sessionCount: gameSave.sessionCount + 1,
        lastSessionDate: new Date().toISOString().split('T')[0],
      })

      // Write BalanceLog inside transaction
      if (offline > 0) {
        await tx.balanceLog.create({
          data: {
            userId,
            actionType: 'offline_income',
            currency: 'rubles',
            amount: offline,
            balanceBefore: gameSave.balance,
            balanceAfter: updatedBalance,
            metadata: { elapsedSeconds: Math.floor(elapsed) },
          },
        })
      }

      return {
        updated: result,
        offlineAmount: offline,
        elapsedSeconds: elapsed,
        passiveIncome: pi,
        balanceBefore: gameSave.balance,
      }
    }))

  // Audit log AFTER DB update (non-transactional, logging only)
  if (offlineAmount > 0) {
    logBalanceChange({
      userId,
      actionType: 'offline_income',
      currency: 'rubles',
      amount: offlineAmount,
      balanceBefore,
      balanceAfter: roundCurrency(balanceBefore + offlineAmount),
      metadata: { elapsedSeconds: Math.floor(elapsedSeconds), passiveIncome },
    })
  }

  return {
    gameState: buildGameState(updated),
    offlineEarnings: offlineAmount > 0
      ? { amount: offlineAmount, timeAway: Math.floor(elapsedSeconds) }
      : undefined,
    serverTime: Date.now(),
  }
}

export async function createInitialState(userId: number): Promise<Record<string, unknown>> {
  const gameSave = await prisma.gameSave.create({
    data: {
      userId,
      balance: 0,
      nuts: 0,
      garageLevel: 1,
      totalClicks: 0,
      totalEarned: 0,
      milestonesPurchased: [],
      clickPowerLevel: 0,
      clickPowerCost: BASE_COSTS.clickUpgrade,
      workSpeedLevel: 0,
      workSpeedCost: BASE_COSTS.workSpeed,
      apprenticeCount: 0,
      apprenticeCost: BASE_COSTS.apprentice,
      mechanicCount: 0,
      mechanicCost: BASE_COSTS.mechanic,
      masterCount: 0,
      masterCost: BASE_COSTS.master,
      brigadierCount: 0,
      brigadierCost: BASE_COSTS.brigadier,
      directorCount: 0,
      directorCost: BASE_COSTS.director,
      sessionCount: 1,
      lastSessionDate: new Date().toISOString().split('T')[0],
      peakClickIncome: 0,
      totalPlayTimeSeconds: 0,
      bestStreak: 0,
      achievements: {},
      dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 },
      rewardedVideo: { lastWatchedTimestamp: 0, totalWatches: 0 },
      boosts: { active: [] },
      events: { activeEvent: null, cooldownEnd: 0 },
      decorationsOwned: [],
      decorationsActive: [],
    },
  })

  logger.info({ userId }, 'Created initial game state')
  return buildGameState(gameSave)
}
