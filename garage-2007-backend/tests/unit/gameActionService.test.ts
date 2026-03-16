import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processAction } from '../../src/services/gameActionService'
import { __mockClient } from '@prisma/client'
import { createTestGameSave } from '../helpers'

const prisma = __mockClient as any

describe('gameActionService — processAction', () => {
  const userId = 1

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.balanceLog.findFirst.mockResolvedValue(null) // no idempotency collision
    prisma.balanceLog.create.mockResolvedValue({})
    prisma.gameSave.update.mockImplementation(async ({ data }: any) => data)
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
      expect(result.gameState.clickPowerLevel).toBe(1)
      expect(result.gameState.balance).toBeLessThan(10_000)
      // Cost should be recalculated (higher than previous)
      expect(result.gameState.clickPowerCost).toBeGreaterThan(100)
    })

    it('insufficient balance returns INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10,
        clickPowerLevel: 0,
        clickPowerCost: 100,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_upgrade', {
        upgradeType: 'clickPower',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INSUFFICIENT_BALANCE')
    })

    it('level >= 200 returns MAX_LEVEL_REACHED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999_999,
        clickPowerLevel: 200,
        clickPowerCost: 100,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_upgrade', {
        upgradeType: 'clickPower',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('MAX_LEVEL_REACHED')
    })

    it('event cost multiplier applied (e.g., 0.8 discount)', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10_000,
        clickPowerLevel: 0,
        clickPowerCost: 100,
        events: {
          activeEvent: {
            id: 'discount_upgrades',
            multiplier: 0.8,
            activatedAt: Date.now() - 60_000,
            expiresAt: Date.now() + 300_000,
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
      expect(result.gameState.apprenticeCount).toBe(1)
      expect(result.gameState.balance).toBeLessThan(10_000)
      expect(result.gameState.apprenticeCost).toBeGreaterThan(500)
    })

    it('worker limit reached returns WORKER_LIMIT_REACHED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999_999,
        apprenticeCount: 3, // WORKER_LIMITS.apprentice = 3
        apprenticeCost: 500,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'hire_worker', {
        workerType: 'apprentice',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('WORKER_LIMIT_REACHED')
    })

    it('milestone not purchased for locked worker returns WORKER_LOCKED error', async () => {
      // Mechanic requires milestone 5
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999_999,
        milestonesPurchased: [], // no milestones
        mechanicCount: 0,
        mechanicCost: 5_000,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'hire_worker', {
        workerType: 'mechanic',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('WORKER_LOCKED')
    })

    it('insufficient balance returns INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 10,
        apprenticeCount: 0,
        apprenticeCost: 500,
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'hire_worker', {
        workerType: 'apprentice',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INSUFFICIENT_BALANCE')
    })
  })

  // ── purchase_milestone ──────────────────────────────────────────────────────

  describe('purchase_milestone', () => {
    it('success: balance deducted, milestone added to array', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 100_000,
        garageLevel: 5,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_milestone', { level: 5 })

      expect(result.success).toBe(true)
      expect(result.gameState.milestonesPurchased).toContain(5)
    })

    it('already purchased returns ALREADY_PURCHASED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 100_000,
        garageLevel: 5,
        milestonesPurchased: [5],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_milestone', { level: 5 })

      expect(result.success).toBe(false)
      expect(result.error).toBe('ALREADY_PURCHASED')
    })

    it('invalid level (not in milestone levels) returns INVALID_MILESTONE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 100_000,
        garageLevel: 7,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_milestone', { level: 7 })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INVALID_MILESTONE')
    })

    it('insufficient balance returns INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 0,
        garageLevel: 5,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_milestone', { level: 5 })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INSUFFICIENT_BALANCE')
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
      expect(result.gameState.decorationsOwned).toContain('tools_workbench')
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
      expect(result.gameState.decorationsOwned).toContain('decor_neon_sign')
      expect(result.gameState.nuts).toBeLessThan(100)
    })

    it('not in catalog returns DECORATION_NOT_FOUND error', async () => {
      const gameSave = createTestGameSave({ userId, balance: 999_999 })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_decoration', {
        decorationId: 'nonexistent_decoration',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('DECORATION_NOT_FOUND')
    })

    it('already owned returns ALREADY_OWNED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999,
        garageLevel: 5,
        decorationsOwned: ['decor_poster_car'],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'purchase_decoration', {
        decorationId: 'decor_poster_car',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('ALREADY_OWNED')
    })

    it('garage level too low returns LEVEL_REQUIRED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        balance: 999_999,
        garageLevel: 1, // decor_poster_car requires unlockLevel 2
        decorationsOwned: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      // decor_poster_car: unlockLevel 2, garageLevel 1 → should fail
      const result = await processAction(userId, 'purchase_decoration', {
        decorationId: 'decor_poster_car',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('LEVEL_REQUIRED')
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
      expect(result.gameState.decorationsActive).toContain('decor_poster_car')
    })

    it('not owned returns NOT_OWNED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        decorationsOwned: [],
        decorationsActive: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'toggle_decoration', {
        decorationId: 'decor_poster_car',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('NOT_OWNED')
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
      const activeBoosts = result.gameState.boosts.active
      expect(activeBoosts.some((b: any) => b.type === 'turbo')).toBe(true)
    })

    it('insufficient nuts returns INSUFFICIENT_NUTS error', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 0,
        boosts: { active: [] },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'activate_boost', {
        boostType: 'turbo',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('INSUFFICIENT_NUTS')
    })

    it('milestone not unlocked returns BOOST_LOCKED error (income_2x needs milestone 5)', async () => {
      const gameSave = createTestGameSave({
        userId,
        nuts: 100,
        milestonesPurchased: [], // no milestones
        boosts: { active: [] },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'activate_boost', {
        boostType: 'income_2x',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('BOOST_LOCKED')
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
      const turboBoost = result.gameState.boosts.active.find(
        (b: any) => b.type === 'turbo',
      )
      expect(turboBoost).toBeDefined()
      expect(turboBoost.expiresAt).toBeGreaterThan(Date.now())
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
      expect(result.gameState.achievements.garage_level_5.claimed).toBe(true)
    })

    it('already claimed returns ALREADY_CLAIMED error', async () => {
      const gameSave = createTestGameSave({
        userId,
        achievements: {
          garage_level_5: { unlocked: true, claimed: true },
        },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      const result = await processAction(userId, 'claim_achievement', {
        achievementId: 'garage_level_5',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('ALREADY_CLAIMED')
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
      expect(result.gameState.dailyRewards.currentStreak).toBe(1)
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
      expect(result.gameState.dailyRewards.currentStreak).toBe(2)

      vi.useRealTimers()
    })

    it('double claim same period returns ALREADY_CLAIMED error', async () => {
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

      const result = await processAction(userId, 'claim_daily_reward', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('ALREADY_CLAIMED')

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

    it('cooldown active (< 1 hour) returns COOLDOWN_ACTIVE error', async () => {
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

      const result = await processAction(userId, 'watch_rewarded_video', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('COOLDOWN_ACTIVE')

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
      expect(result.gameState.events.activeEvent).not.toBeNull()
      expect(result.gameState.events.activeEvent.id).toBeDefined()
      expect(result.gameState.events.activeEvent.expiresAt).toBeGreaterThan(Date.now())
    })

    it('cooldown active returns COOLDOWN_ACTIVE error', async () => {
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

      const result = await processAction(userId, 'trigger_event', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('COOLDOWN_ACTIVE')

      vi.useRealTimers()
    })
  })
})
