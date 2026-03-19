import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processAction } from '../../src/services/gameActionService'
import { AppError } from '../../src/middleware/errorHandler'
import { __mockClient } from '@prisma/client'
import { createTestGameSave } from '../helpers'

const prisma = __mockClient as any

describe('gameActionService — processAction', () => {
  const userId = 1

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.balanceLog.findFirst.mockResolvedValue(null) // no idempotency collision
    prisma.balanceLog.create.mockResolvedValue({})
    // Default update mock: merge data with the gameSave from findUnique
    prisma.gameSave.update.mockImplementation(async ({ data }: any) => {
      const currentSave = prisma.gameSave.findUnique.mock.results?.[0]?.value
      // Await in case it's a promise (mockResolvedValue)
      const resolved = currentSave instanceof Promise ? await currentSave : currentSave
      return {
        ...resolved,
        ...data,
        // Handle Prisma increment operations
        ...(data.version?.increment ? { version: (resolved?.version ?? 7) + data.version.increment } : {}),
        // Handle Prisma push operations (decorationsOwned)
        ...(data.decorationsOwned?.push ? { decorationsOwned: [...(resolved?.decorationsOwned ?? []), data.decorationsOwned.push] } : {}),
      }
    })
  })

  // ── purchase_upgrade ────────────────────────────────────────────────────────

  describe('purchase_upgrade', () => {
    it('success: balance deducted, level incremented, cost recalculated', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10_000,
        clickPowerLevel: 0,
        clickPowerCost: 100,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_upgrade', {
        upgradeType: 'clickPower',
      })

      expect(result.success).toBe(true)
      expect(result.gameState.upgrades).toBeDefined()
      const upgrades = result.gameState.upgrades as { clickPower: { level: number; cost: number } }
      expect(upgrades.clickPower.level).toBe(1)
      expect(result.gameState.balance).toBeLessThan(10_000)
      // Cost should be recalculated (higher than previous)
      expect(upgrades.clickPower.cost).toBeGreaterThan(100)
    })

    it('insufficient balance throws INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10,
        clickPowerLevel: 0,
        clickPowerCost: 100,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_upgrade', { upgradeType: 'clickPower' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('INSUFFICIENT_BALANCE')
      }
    })

    it('level >= 200 throws MAX_LEVEL_REACHED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999_999,
        clickPowerLevel: 200,
        clickPowerCost: 100,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_upgrade', { upgradeType: 'clickPower' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('MAX_LEVEL_REACHED')
      }
    })

    it('event cost multiplier applied (e.g., 0.8 discount)', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10_000,
        clickPowerLevel: 0,
        clickPowerCost: 100,
        events: {
          activeEvent: {
            id: 'parts_discount',
            activatedAt: Date.now() - 60_000,
            expiresAt: Date.now() + 300_000,
            eventSeed: 1,
          },
          cooldownEnd: 0,
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_upgrade', {
        upgradeType: 'clickPower',
      })

      expect(result.success).toBe(true)
      // With 0.8 multiplier, cost should be 80 instead of 100
      // Balance deducted should be less than full cost
      expect(result.gameState.balance).toBeGreaterThan(10_000 - 100)
    })
  })

  // ── hire_worker ─────────────────────────────────────────────────────────────

  describe('hire_worker', () => {
    it('success: balance deducted, count incremented, cost recalculated', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10_000,
        apprenticeCount: 0,
        apprenticeCost: 500,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'hire_worker', {
        workerType: 'apprentice',
      })

      expect(result.success).toBe(true)
      const workers = result.gameState.workers as { apprentice: { count: number; cost: number } }
      expect(workers.apprentice.count).toBe(1)
      expect(result.gameState.balance).toBeLessThan(10_000)
      expect(workers.apprentice.cost).toBeGreaterThan(500)
    })

    it('worker limit reached throws WORKER_LIMIT_REACHED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999_999,
        apprenticeCount: 3, // WORKER_LIMITS.apprentice = 3
        apprenticeCost: 500,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'hire_worker', { workerType: 'apprentice' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('WORKER_LIMIT_REACHED')
      }
    })

    it('milestone not purchased for locked worker throws WORKER_LOCKED error', async () => {
      // Mechanic requires milestone 5
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999_999,
        milestonesPurchased: [], // no milestones
        mechanicCount: 0,
        mechanicCost: 5_000,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'hire_worker', { workerType: 'mechanic' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('WORKER_LOCKED')
      }
    })

    it('insufficient balance throws INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10,
        apprenticeCount: 0,
        apprenticeCost: 500,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'hire_worker', { workerType: 'apprentice' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('INSUFFICIENT_BALANCE')
      }
    })
  })

  // ── purchase_milestone ──────────────────────────────────────────────────────

  describe('purchase_milestone', () => {
    it('success: balance deducted, milestone added to array', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 2_000_000,
        garageLevel: 5,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_milestone', { level: 5 })

      expect(result.success).toBe(true)
      expect(result.gameState.milestonesPurchased).toContain(5)
    })

    it('already purchased throws MILESTONE_ALREADY_PURCHASED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 100_000,
        garageLevel: 5,
        milestonesPurchased: [5],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_milestone', { level: 5 })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('MILESTONE_ALREADY_PURCHASED')
      }
    })

    it('invalid level (not in milestone levels) throws INVALID_MILESTONE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 100_000,
        garageLevel: 7,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_milestone', { level: 7 })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('INVALID_MILESTONE')
      }
    })

    it('insufficient balance throws INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 0,
        garageLevel: 5,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_milestone', { level: 5 })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('INSUFFICIENT_BALANCE')
      }
    })
  })

  // ── purchase_decoration ─────────────────────────────────────────────────────

  describe('purchase_decoration', () => {
    it('success with rubles: balance deducted, added to owned', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 50_000,
        garageLevel: 5,
        decorationsOwned: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      // tools_workbench: currency 'rubles', cost 5000, unlockLevel 1
      const result = await processAction(userId, 'purchase_decoration', {
        decorationId: 'tools_workbench',
      })

      expect(result.success).toBe(true)
      const decorations = result.gameState.decorations as { owned: string[]; active: string[] }
      expect(decorations.owned).toContain('tools_workbench')
    })

    it('success with nuts: nuts deducted, added to owned', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 100,
        garageLevel: 12,
        decorationsOwned: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      // decor_neon_sign: currency 'nuts', cost 40, unlockLevel 12
      const result = await processAction(userId, 'purchase_decoration', {
        decorationId: 'decor_neon_sign',
      })

      expect(result.success).toBe(true)
      const decorations = result.gameState.decorations as { owned: string[]; active: string[] }
      expect(decorations.owned).toContain('decor_neon_sign')
      expect(result.gameState.nuts).toBeLessThan(100)
    })

    it('not in catalog throws DECORATION_NOT_FOUND error', async () => {
      const gameSave = createTestGameSave({ userId, balance: 999_999 })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_decoration', { decorationId: 'nonexistent_decoration' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('DECORATION_NOT_FOUND')
      }
    })

    it('already owned throws DECORATION_ALREADY_OWNED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999,
        garageLevel: 5,
        decorationsOwned: ['decor_poster_car'],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'purchase_decoration', { decorationId: 'decor_poster_car' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('DECORATION_ALREADY_OWNED')
      }
    })

    it('garage level too low throws DECORATION_LOCKED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999,
        garageLevel: 1, // decor_poster_car requires unlockLevel 2
        decorationsOwned: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      // decor_poster_car: unlockLevel 2, garageLevel 1 → should fail
      try {
        await processAction(userId, 'purchase_decoration', { decorationId: 'decor_poster_car' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('DECORATION_LOCKED')
      }
    })
  })

  // ── toggle_decoration ───────────────────────────────────────────────────────

  describe('toggle_decoration', () => {
    it('success: toggled in active list', async () => {
      const gameSave = createTestGameSave({
        userId,
        decorationsOwned: ['decor_poster_car'],
        decorationsActive: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'toggle_decoration', {
        decorationId: 'decor_poster_car',
      })

      expect(result.success).toBe(true)
      const decorations = result.gameState.decorations as { owned: string[]; active: string[] }
      expect(decorations.active).toContain('decor_poster_car')
    })

    it('not owned throws DECORATION_NOT_FOUND error', async () => {
      const gameSave = createTestGameSave({
        userId,
        decorationsOwned: [],
        decorationsActive: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'toggle_decoration', { decorationId: 'decor_poster_car' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('DECORATION_NOT_FOUND')
      }
    })
  })

  // ── activate_boost ──────────────────────────────────────────────────────────

  describe('activate_boost', () => {
    it('success: nuts deducted, boost added to active (turbo costs 15 nuts)', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 50,
        boosts: { active: [] },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'activate_boost', {
        boostType: 'turbo',
      })

      expect(result.success).toBe(true)
      expect(result.gameState.nuts).toBe(50 - 15)
      const boosts = result.gameState.boosts as { active: Array<{ type: string }> }
      expect(boosts.active.some((b) => b.type === 'turbo')).toBe(true)
    })

    it('insufficient nuts throws INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 0,
        boosts: { active: [] },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'activate_boost', { boostType: 'turbo' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('INSUFFICIENT_BALANCE')
      }
    })

    it('milestone not unlocked throws BOOST_LOCKED error (income_2x needs milestone 5)', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 100,
        milestonesPurchased: [], // no milestones
        boosts: { active: [] },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'activate_boost', { boostType: 'income_2x' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('BOOST_LOCKED')
      }
    })
  })

  // ── replace_boost ───────────────────────────────────────────────────────────

  describe('replace_boost', () => {
    it('success: replaces existing boost, nuts deducted', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 50,
        boosts: {
          active: [
            {
              type: 'turbo',
              activatedAt: Date.now() - 60_000,
              expiresAt: Date.now() + 240_000,
            },
          ],
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'replace_boost', {
        boostType: 'turbo',
      })

      expect(result.success).toBe(true)
      expect(result.gameState.nuts).toBeLessThan(50)
      // New boost should have fresh expiresAt
      const boosts = result.gameState.boosts as { active: Array<{ type: string; expiresAt: number }> }
      const turboBoost = boosts.active.find(
        (b) => b.type === 'turbo',
      )
      expect(turboBoost).toBeDefined()
      expect(turboBoost!.expiresAt).toBeGreaterThan(Date.now())
    })
  })

  // ── claim_achievement ───────────────────────────────────────────────────────

  describe('claim_achievement', () => {
    it('success: achievement claimed, nuts awarded', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 10,
        achievements: {
          garage_level_5: { unlocked: true, claimed: false },
        },
        garageLevel: 5,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'claim_achievement', {
        achievementId: 'garage_level_5',
      })

      expect(result.success).toBe(true)
      expect(result.gameState.nuts).toBeGreaterThan(10)
      const achievements = result.gameState.achievements as Record<string, { claimed: boolean }>
      expect(achievements.garage_level_5.claimed).toBe(true)
    })

    it('already claimed throws ACHIEVEMENT_ALREADY_CLAIMED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        achievements: {
          garage_level_5: { unlocked: true, claimed: true },
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'claim_achievement', { achievementId: 'garage_level_5' })
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('ACHIEVEMENT_ALREADY_CLAIMED')
      }
    })
  })

  // ── claim_daily_reward ──────────────────────────────────────────────────────

  describe('claim_daily_reward', () => {
    it('success day 1: 5 nuts, streak = 1', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 0,
        dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'claim_daily_reward', {})

      expect(result.success).toBe(true)
      expect(result.gameState.nuts).toBe(5)
      expect(result.actionResult?.nutsRewarded).toBe(5)
      const dailyRewards = result.gameState.dailyRewards as { currentStreak: number }
      expect(dailyRewards.currentStreak).toBe(1)
    })

    it('streak continuation (next day): 5 nuts, streak = 2', async () => {
      vi.useFakeTimers()
      const now = new Date('2026-03-16T12:00:00Z')
      vi.setSystemTime(now)

      const yesterday = new Date('2026-03-15T12:00:00Z').getTime()
      const gameSave = createTestGameSave({
        userId,
        nuts: 10,
        dailyRewards: { lastClaimTimestamp: yesterday, currentStreak: 1 },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'claim_daily_reward', {})

      expect(result.success).toBe(true)
      expect(result.gameState.nuts).toBe(15) // 10 + 5
      const dailyRewards = result.gameState.dailyRewards as { currentStreak: number }
      expect(dailyRewards.currentStreak).toBe(2)

      vi.useRealTimers()
    })

    it('double claim same period throws DAILY_REWARD_COOLDOWN error', async () => {
      vi.useFakeTimers()
      const now = new Date('2026-03-16T12:00:00Z')
      vi.setSystemTime(now)

      const gameSave = createTestGameSave({
        userId,
        dailyRewards: {
          lastClaimTimestamp: now.getTime() - 3600_000, // claimed 1h ago (same day)
          currentStreak: 1,
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'claim_daily_reward', {})
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('DAILY_REWARD_COOLDOWN')
      }

      vi.useRealTimers()
    })
  })

  // ── watch_rewarded_video ────────────────────────────────────────────────────

  describe('watch_rewarded_video', () => {
    it('success: 5 nuts awarded', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 10,
        rewardedVideo: { lastWatchedTimestamp: 0, totalWatches: 0, isWatching: false },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'watch_rewarded_video', {})

      expect(result.success).toBe(true)
      expect(result.gameState.nuts).toBe(15) // 10 + 5
    })

    it('cooldown active (< 1 hour) throws VIDEO_COOLDOWN error', async () => {
      vi.useFakeTimers()
      const now = new Date('2026-03-16T12:00:00Z')
      vi.setSystemTime(now)

      const gameSave = createTestGameSave({
        userId,
        rewardedVideo: {
          lastWatchedTimestamp: now.getTime() - 30 * 60_000, // 30 min ago
          totalWatches: 1,
          isWatching: false,
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'watch_rewarded_video', {})
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('VIDEO_COOLDOWN')
      }

      vi.useRealTimers()
    })
  })

  // ── trigger_event ───────────────────────────────────────────────────────────

  describe('trigger_event', () => {
    it('success: event activated with valid id', async () => {
      const gameSave = createTestGameSave({
        userId,
        events: { activeEvent: null, cooldownEnd: 0 },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'trigger_event', {})

      expect(result.success).toBe(true)
      const events = result.gameState.events as { activeEvent: { id: string; expiresAt: number } | null }
      expect(events.activeEvent).not.toBeNull()
      expect(events.activeEvent!.id).toBeDefined()
      expect(events.activeEvent!.expiresAt).toBeGreaterThan(Date.now())
    })

    it('cooldown active throws EVENT_COOLDOWN error', async () => {
      vi.useFakeTimers()
      const now = new Date('2026-03-16T12:00:00Z')
      vi.setSystemTime(now)

      const gameSave = createTestGameSave({
        userId,
        events: {
          activeEvent: null,
          cooldownEnd: now.getTime() + 300_000, // cooldown ends in 5 min
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      try {
        await processAction(userId, 'trigger_event', {})
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).code).toBe('EVENT_COOLDOWN')
      }

      vi.useRealTimers()
    })
  })
})
