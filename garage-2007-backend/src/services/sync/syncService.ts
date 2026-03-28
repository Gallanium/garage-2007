import { prisma } from '../../utils/prisma.js'
import { calculateClickIncome, calculateTotalPassiveIncome } from '@shared/formulas/income.js'
import { calculateOfflineEarnings } from '@shared/formulas/offlineEarnings.js'
import { roundCurrency } from '@shared/utils/math.js'
import { CRITICAL_CLICK_MULTIPLIER, CRITICAL_CLICK_CHANCE } from '@shared/constants/economy.js'
import { BOOST_DEFINITIONS } from '@shared/constants/boosts.js'
import { checkAutoLevel } from '@shared/formulas/progression.js'
import { AppError } from '../../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../../utils/occ.js'
import { logSuspiciousActivity, detectBalanceJump, detectRapidSync, detectTimingAnomaly } from '../auditService.js'
import { checkAndClaimTierRewards } from '../leagueService.js'
import { buildGameState } from '../gameStateService.js'
import { parsedBoostsSchema } from '../../validation/jsonSchemas.js'
import { Prisma } from '@prisma/client'
import type { BoostType } from '@shared/types/game.js'
import { gsToNumbers } from '../../utils/decimal.js'
import {
  type ParsedBoosts,
  parseEvents,
  getBoostMultiplier,
  getEventMultiplier,
} from '../helpers/actionHelpers.js'

// ── processSync ─────────────────────────────────────────────────────────────

export async function processSync(
  userId: number,
  normalClicks: number,
  criticalClicks: number,
  clientTimestamp?: number,
  syncNonce?: string,
  clickBuckets?: Array<{ multiplier: number; normalClicks: number; criticalClicks: number }>,
  clientPeakClickIncome?: number,
): Promise<{ gameState: Record<string, unknown>; serverTime: number }> {
  // Anti-cheat: detect client timestamp anomaly (read-only, safe outside transaction)
  if (clientTimestamp) {
    detectTimingAnomaly(userId, clientTimestamp)
  }

  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    // Anti-cheat: reject rapid syncs (< 5s) — return current state without income
    if (detectRapidSync(userId, gs.lastSyncAt)) {
      return { gameState: buildGameState(gs), serverTime: Date.now() }
    }

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
    let normal = Math.max(0, Math.floor(normalClicks))
    let critical = Math.max(0, Math.floor(criticalClicks))
    let clicks = normal + critical
    const maxClicks = Math.floor(secondsSinceLastSync * 20)
    if (clicks > maxClicks) {
      logSuspiciousActivity({
        userId,
        reason: 'excessive_click_rate',
        details: { reported: clicks, max: maxClicks, seconds: secondsSinceLastSync },
      })
      // Scale down proportionally
      const ratio = maxClicks / clicks
      normal = Math.floor(normal * ratio)
      critical = maxClicks - normal
      clicks = maxClicks
    }

    // Anti-cheat: suspiciously high critical click ratio (>30% on 50+ clicks)
    if (clicks > 50 && critical / clicks > 0.3) {
      logSuspiciousActivity({
        userId,
        reason: 'suspicious_critical_ratio',
        details: { normal, critical, ratio: critical / clicks },
      })
      // Enforcement: scale crits down to realistic distribution
      const maxCritical = Math.floor(clicks * CRITICAL_CLICK_CHANCE)
      const excess = critical - maxCritical
      normal = normal + excess
      critical = maxCritical
    }

    // Parse boosts: keep raw for sync-window fairness, filter for current multipliers
    const rawBoosts = parsedBoostsSchema.parse(gs.boosts)
    const boosts: ParsedBoosts = { active: rawBoosts.active.filter(b => b.expiresAt > Date.now()) }
    const events = parseEvents(gs.events)

    const boostClickMult = getBoostMultiplier(boosts, 'click')
    const boostIncomeMult = getBoostMultiplier(boosts, 'income')
    const eventClickMult = getEventMultiplier(events, 'click')
    const eventIncomeMult = getEventMultiplier(events, 'income')
    let expectedClickMult = roundCurrency(boostClickMult * eventClickMult)
    if (!Number.isFinite(expectedClickMult) || expectedClickMult <= 0) {
      logSuspiciousActivity({ userId, reason: 'invalid_server_multiplier', details: { boostClickMult, eventClickMult } })
      expectedClickMult = 1
    }

    // Fairness: compute max multiplier from boosts active during sync window
    // (allows legitimate clicks from recently-expired boosts)
    const syncWindowStart = gs.lastSyncAt.getTime()
    const recentBoosts = rawBoosts.active.filter(b => b.expiresAt > syncWindowStart)
    let maxRecentClickMult = 1
    for (const b of recentBoosts) {
      const def = BOOST_DEFINITIONS[b.type as BoostType]
      if (!def) continue
      if (b.type === 'income_2x' || b.type === 'income_3x' || b.type === 'turbo') {
        maxRecentClickMult = Math.max(maxRecentClickMult, def.multiplier)
      }
    }
    const allowedClickMult = Math.max(expectedClickMult, roundCurrency(maxRecentClickMult * eventClickMult))

    // Click income (critical clicks get CRITICAL_CLICK_MULTIPLIER bonus)
    const baseClickIncome = calculateClickIncome(gs.clickPowerLevel)
    let clickIncome: number
    if (clickBuckets && clickBuckets.length > 0) {
      // Anti-cheat: verify bucket totals match top-level click counts
      const bucketNormal = clickBuckets.reduce((s, b) => s + b.normalClicks, 0)
      const bucketCritical = clickBuckets.reduce((s, b) => s + b.criticalClicks, 0)
      if (bucketNormal !== normal || bucketCritical !== critical) {
        logSuspiciousActivity({ userId, reason: 'bucket_count_mismatch', details: { normal, critical, bucketNormal, bucketCritical } })
        // Mismatch — use server-side multipliers
        clickIncome = roundCurrency(
          (normal * baseClickIncome + critical * baseClickIncome * CRITICAL_CLICK_MULTIPLIER) * boostClickMult * eventClickMult,
        )
      } else {
        // Valid buckets — use SERVER-SIDE multiplier (client multiplier is untrusted)
        clickIncome = 0
        for (const bucket of clickBuckets) {
          // Use LOWER of client vs allowed multiplier (accounts for recently-expired boosts)
          // - Caps fabricated multipliers (client=100 → capped to max allowed)
          // - Allows legitimate boost clicks when boost expired between click and sync
          const safeMult = Math.min(Math.max(bucket.multiplier, 1), allowedClickMult)

          if (Math.abs(bucket.multiplier - allowedClickMult) > 0.001) {
            logSuspiciousActivity({
              userId,
              reason: 'bucket_multiplier_mismatch',
              details: { clientMult: bucket.multiplier, serverMult: expectedClickMult, allowedMult: allowedClickMult, usedMult: safeMult },
            })
          }
          clickIncome += (bucket.normalClicks * baseClickIncome
            + bucket.criticalClicks * baseClickIncome * CRITICAL_CLICK_MULTIPLIER) * safeMult
        }
        clickIncome = roundCurrency(clickIncome)
      }
    } else {
      // No buckets — server-side multipliers (backward compat)
      clickIncome = roundCurrency(
        (normal * baseClickIncome + critical * baseClickIncome * CRITICAL_CLICK_MULTIPLIER) * expectedClickMult,
      )
    }

    // Passive income
    const workers = {
      apprentice: { count: gs.apprenticeCount },
      mechanic: { count: gs.mechanicCount },
      master: { count: gs.masterCount },
      brigadier: { count: gs.brigadierCount },
      director: { count: gs.directorCount },
    }
    const passivePerSec = calculateTotalPassiveIncome(workers, gs.workSpeedLevel)
    let expectedIncomeMult = roundCurrency(boostIncomeMult * eventIncomeMult)
    if (!Number.isFinite(expectedIncomeMult) || expectedIncomeMult <= 0) {
      logSuspiciousActivity({ userId, reason: 'invalid_server_multiplier', details: { boostIncomeMult, eventIncomeMult } })
      expectedIncomeMult = 1
    }
    let passiveIncome: number
    if (secondsSinceLastSync < 60) {
      // Short interval (active play) — raw calculation, no cap needed
      passiveIncome = roundCurrency(secondsSinceLastSync * passivePerSec * expectedIncomeMult)
    } else {
      // Long interval — capped offline earnings (24h max, 8h full + 50% efficiency)
      const basePassiveIncome = calculateOfflineEarnings(passivePerSec, secondsSinceLastSync)
      passiveIncome = roundCurrency(basePassiveIncome * expectedIncomeMult)
    }

    const totalIncome = roundCurrency(clickIncome + passiveIncome)
    const newBalance = roundCurrency(gs.balance + totalIncome)
    const newTotalEarned = roundCurrency(gs.totalEarned + totalIncome)
    const newTotalClicks = gs.totalClicks + clicks
    const newPlayTime = gs.totalPlayTimeSeconds + Math.floor(secondsSinceLastSync)
    const serverComputedPeak = calculateClickIncome(gs.clickPowerLevel) * boostClickMult * eventClickMult
    const newPeakClickIncome = Math.max(gs.peakClickIncome, serverComputedPeak)

    // Anti-cheat checks
    detectBalanceJump(userId, gs.balance, newBalance)

    // Auto-level
    const newLevel = checkAutoLevel(newBalance, gs.garageLevel, gs.milestonesPurchased)

    // Tick boosts/events (reuse parsed boosts/events from above)

    // BalanceLog entries (batch insert)
    const logEntries: Array<{
      userId: number; actionType: string; currency: string;
      amount: number; balanceBefore: number; balanceAfter: number;
      metadata: object; idempotencyKey?: string;
    }> = []

    if (syncNonce) {
      logEntries.push({
        userId,
        actionType: 'sync_marker',
        currency: 'rubles',
        amount: 0,
        balanceBefore: gs.balance,
        balanceAfter: gs.balance,
        metadata: {
          clicksSinceLastSync: clicks,
          clickIncome,
          passiveIncome,
          seconds: Math.floor(secondsSinceLastSync),
        },
        idempotencyKey: syncNonce,
      })
    }

    if (clickIncome > 0) {
      logEntries.push({
        userId, actionType: 'click_income', currency: 'rubles',
        amount: clickIncome, balanceBefore: gs.balance,
        balanceAfter: roundCurrency(gs.balance + clickIncome),
        metadata: { clicks, clickPowerLevel: gs.clickPowerLevel },
        idempotencyKey: syncNonce ? `${syncNonce}:click` : undefined,
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
      await tx.balanceLog.createMany({ data: logEntries, skipDuplicates: true })
    }

    // Update GameSave with optimistic lock
    const updated = await updateGameSaveWithLock(tx, userId, gs, {
      balance: newBalance,
      totalEarned: newTotalEarned,
      totalClicks: newTotalClicks,
      totalPlayTimeSeconds: newPlayTime,
      peakClickIncome: newPeakClickIncome,
      garageLevel: newLevel,
      boosts: boosts as object,
      events: events as object,
      lastSyncAt: new Date(),
      gameDataSnapshot: Prisma.DbNull,
    })

    // Auto-claim league tier rewards after totalEarned update
    const claimResult = await checkAndClaimTierRewards(userId, updated, tx)

    const finalState = claimResult.claimedTiers.length > 0 ? claimResult.updatedGs : updated

    return { gameState: buildGameState(finalState), serverTime: Date.now() }
  }))
}
