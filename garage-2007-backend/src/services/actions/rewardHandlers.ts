import { prisma } from '../../utils/prisma.js'
import { AppError } from '../../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../../utils/occ.js'
import { gsToNumbers } from '../../utils/decimal.js'
import { buildGameState } from '../gameStateService.js'
import { env } from '../../config/env.js'
import { ACHIEVEMENTS, getTotalWorkerCount } from '@shared/constants/achievements.js'
import {
  DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS,
  REWARDED_VIDEO_COOLDOWN_MS, REWARDED_VIDEO_NUTS,
} from '@shared/constants/dailyRewards.js'
import { GAME_EVENTS, EVENT_CATEGORY_WEIGHTS, EVENT_COOLDOWN_MS, EVENT_RANDOM_DELAY_MS } from '@shared/constants/events.js'
import { claimAchievementPayload } from '../../validation/gameSchemas.js'
import { achievementsSchema, dailyRewardsSchema, rewardedVideoSchema } from '../../validation/jsonSchemas.js'
import type { AchievementId, AchievementProgressField, EventCategory } from '@shared/types/game.js'
import type { GameSave } from '@prisma/client'
import {
  parseEvents,
  getAchievementProgress,
  weightedRandomPick,
  checkIdempotencyInTx,
  type ParsedEvents,
  type ActiveEventData,
  type ActionResult,
} from '../helpers/actionHelpers.js'

/** Maximum rewarded video watches per calendar day (UTC) */
export const REWARDED_VIDEO_DAILY_CAP = 3

// ── 8. claim_achievement ────────────────────────────────────────────────────

export async function handleClaimAchievement(
  userId: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const { achievementId } = claimAchievementPayload.parse(payload)
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    await checkIdempotencyInTx(tx, idempotencyKey)

    const def = ACHIEVEMENTS[achievementId as AchievementId]
    if (!def) throw new AppError(400, 'ACHIEVEMENT_NOT_FOUND', 'Achievement not found')

    const achievements = achievementsSchema.parse(gs.achievements)
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

export async function handleClaimDailyReward(
  userId: number,
  idempotencyKey?: string,
): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    await checkIdempotencyInTx(tx, idempotencyKey)

    const daily = dailyRewardsSchema.parse(gs.dailyRewards)
    const lastClaim = daily.lastClaimTimestamp
    const currentStreak = daily.currentStreak
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

export async function handleWatchRewardedVideo(
  userId: number,
  idempotencyKey?: string,
): Promise<ActionResult> {
  if (env.REWARDED_VIDEO_ENABLED !== 'true') {
    throw new AppError(403, 'VIDEO_DISABLED', 'Rewarded video is currently disabled')
  }

  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    await checkIdempotencyInTx(tx, idempotencyKey)

    const video = rewardedVideoSchema.parse(gs.rewardedVideo)
    const totalWatches = video.totalWatches
    const lastWatchedTimestamp = video.lastWatchedTimestamp
    const now = Date.now()

    if (lastWatchedTimestamp > 0 && now - lastWatchedTimestamp < REWARDED_VIDEO_COOLDOWN_MS) {
      throw new AppError(400, 'VIDEO_COOLDOWN', 'Rewarded video is still on cooldown')
    }

    // Daily cap: count video_reward actions for the current UTC day
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const todayVideoCount = await tx.balanceLog.count({
      where: {
        userId,
        actionType: 'video_reward',
        createdAt: { gte: todayStart },
      },
    })

    if (todayVideoCount >= REWARDED_VIDEO_DAILY_CAP) {
      throw new AppError(400, 'VIDEO_DAILY_CAP', `Daily video reward limit reached (${REWARDED_VIDEO_DAILY_CAP}/day)`)
    }

    // TODO: integrate ad network receipt verification for production

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
        metadata: { totalWatches: newTotalWatches, dailyCount: todayVideoCount + 1 }, idempotencyKey,
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

export async function handleTriggerEvent(userId: number, idempotencyKey?: string): Promise<ActionResult> {
  return withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = gsToNumbers(await tx.gameSave.findUnique({ where: { userId } }))
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    if (idempotencyKey) {
      const existing = await tx.balanceLog.findFirst({ where: { idempotencyKey } })
      if (existing) {
        return { success: true, gameState: buildGameState(gs), actionResult: { alreadyProcessed: true } }
      }
    }

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

    if (idempotencyKey) {
      await tx.balanceLog.create({
        data: {
          userId, actionType: 'trigger_event', currency: 'rubles',
          amount: 0, balanceBefore: gs.balance, balanceAfter: gs.balance,
          metadata: { eventId: selectedEvent.id }, idempotencyKey,
        },
      })
    }

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
