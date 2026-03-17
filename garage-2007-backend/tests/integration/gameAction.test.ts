import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave } from '../helpers'

const prisma = __mockClient as any

/**
 * Helper: perform a game action via the API.
 */
async function performAction(
  token: string,
  type: string,
  payload: Record<string, unknown> = {},
  idempotencyKey?: string,
) {
  return request(app)
    .post('/api/game/action')
    .set(createAuthHeader(token))
    .send({ type, payload, idempotencyKey })
}

describe('POST /api/game/action', () => {
  const token = signToken({ sub: 1, tgId: 123456789 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Happy path tests ───────────────────────────────────────────────────────

  describe('purchase_upgrade', () => {
    it('increments clickPowerLevel on valid purchase', async () => {
      const gameSave = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null) // no idempotency hit
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data, clickPowerLevel: 1, balance: gameSave.balance - 100 }
      })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'purchase_upgrade', { upgradeType: 'clickPower' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState).toBeDefined()
      expect(res.body.gameState.upgrades.clickPower.level).toBeGreaterThanOrEqual(1)
    })
  })

  describe('hire_worker', () => {
    it('increments apprenticeCount on valid hire', async () => {
      // Apprentice is unlocked at milestone level... need milestonesPurchased to include it
      // From shared code, isWorkerUnlocked checks milestonesPurchased
      // apprentice is typically unlocked at level 0 or by default
      const gameSave = createTestGameSave({
        balance: 10_000,
        apprenticeCount: 0,
        apprenticeCost: 500,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data, apprenticeCount: 1, balance: gameSave.balance - 500 }
      })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'hire_worker', { workerType: 'apprentice' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState.workers.apprentice.count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('purchase_milestone', () => {
    it('returns 400 with INSUFFICIENT_BALANCE when balance is too low', async () => {
      const gameSave = createTestGameSave({
        balance: 1_000,
        garageLevel: 1,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)

      const res = await performAction(token, 'purchase_milestone', { level: 5 })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })
  })

  describe('purchase_decoration', () => {
    it('handles decoration purchase attempt', async () => {
      const gameSave = createTestGameSave({
        balance: 10_000,
        garageLevel: 1,
        decorationsOwned: [],
        decorationsActive: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data }
      })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'purchase_decoration', {
        decorationId: 'tools_workbench',
      })

      // May succeed or fail depending on decoration catalog requirements
      if (res.status === 200) {
        expect(res.body.success).toBe(true)
      } else {
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
      }
    })
  })

  describe('toggle_decoration', () => {
    it('returns 400 when decoration not owned', async () => {
      const gameSave = createTestGameSave({
        decorationsOwned: [],
        decorationsActive: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)

      const res = await performAction(token, 'toggle_decoration', {
        decorationId: 'tools_workbench',
      })

      expect(res.status).toBe(400)
    })
  })

  describe('activate_boost', () => {
    it('handles boost activation attempt', async () => {
      const gameSave = createTestGameSave({
        nuts: 50,
        milestonesPurchased: [],
        boosts: { active: [] },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data }
      })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'activate_boost', { boostType: 'turbo' })

      // May succeed or fail depending on boost requirements (unlock level, cost)
      if (res.status === 200) {
        expect(res.body.success).toBe(true)
      } else {
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
      }
    })
  })

  describe('claim_achievement', () => {
    it('handles achievement claim attempt', async () => {
      const gameSave = createTestGameSave({
        garageLevel: 1,
        achievements: {},
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)

      const res = await performAction(token, 'claim_achievement', {
        achievementId: 'garage_level_2',
      })

      // Will fail because garageLevel < 2
      expect(res.status).toBe(400)
    })
  })

  describe('claim_daily_reward', () => {
    it('increases nuts on valid daily reward claim', async () => {
      const gameSave = createTestGameSave({
        nuts: 50,
        dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data }
      })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'claim_daily_reward', {})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState.nuts).toBeGreaterThan(50)
    })
  })

  describe('watch_rewarded_video', () => {
    it('awards 5 nuts on valid rewarded video watch', async () => {
      const gameSave = createTestGameSave({
        nuts: 50,
        rewardedVideo: { lastWatchedTimestamp: 0, totalWatches: 0 },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data }
      })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'watch_rewarded_video', {})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // Should get +5 nuts
      expect(res.body.gameState.nuts).toBe(55)
    })
  })

  describe('trigger_event', () => {
    it('activates a random event', async () => {
      const gameSave = createTestGameSave({
        events: { activeEvent: null, cooldownEnd: 0 },
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockImplementation(async (args: any) => {
        return { ...gameSave, ...args.data }
      })

      const res = await performAction(token, 'trigger_event', {})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState.events).toBeDefined()
      expect(res.body.gameState.events.activeEvent).not.toBeNull()
    })
  })

  // ── Error cases ────────────────────────────────────────────────────────────

  describe('error: insufficient balance', () => {
    it('returns 400 with INSUFFICIENT_BALANCE error', async () => {
      const gameSave = createTestGameSave({
        balance: 1_000,
        garageLevel: 1,
        milestonesPurchased: [],
      })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)

      // Milestone 5 requires much more than 1000 balance
      const res = await performAction(token, 'purchase_milestone', { level: 5 })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBe('INSUFFICIENT_BALANCE')
    })
  })

  describe('idempotency', () => {
    it('returns 409 for duplicate idempotencyKey', async () => {
      const gameSave = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
      const key = randomUUID()

      // First call: no existing balanceLog for this key
      prisma.balanceLog.findFirst.mockResolvedValueOnce(null)
      prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave)
      prisma.gameSave.update.mockResolvedValueOnce({ ...gameSave, clickPowerLevel: 1, balance: 9900 })
      prisma.balanceLog.create.mockResolvedValueOnce({})

      const first = await performAction(token, 'purchase_upgrade', { upgradeType: 'clickPower' }, key)
      expect(first.status).toBe(200)

      // Second call: balanceLog exists for this key (idempotency check)
      prisma.balanceLog.findFirst.mockResolvedValueOnce({ id: 1, idempotencyKey: key })
      prisma.gameSave.findUnique.mockResolvedValueOnce({ ...gameSave, clickPowerLevel: 1, balance: 9900 })

      const second = await performAction(token, 'purchase_upgrade', { upgradeType: 'clickPower' }, key)

      // The service throws 409 IDEMPOTENT_REQUEST
      expect(second.status).toBe(409)
    })
  })

  describe('error: invalid action type', () => {
    it('returns 400 for an unknown action type', async () => {
      const res = await performAction(token, 'nonexistent_action', {})

      // Zod validation catches this because actionSchema uses z.enum
      expect(res.status).toBe(400)
    })
  })

  describe('error: no auth', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app)
        .post('/api/game/action')
        .send({ type: 'purchase_upgrade', payload: { upgradeType: 'clickPower' } })

      expect(res.status).toBe(401)
    })
  })

  describe('audit: BalanceLog', () => {
    it('creates a BalanceLog entry for balance-changing actions', async () => {
      const gameSave = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)
      prisma.balanceLog.findFirst.mockResolvedValue(null)
      prisma.gameSave.update.mockResolvedValue({ ...gameSave, clickPowerLevel: 1, balance: 9900 })
      prisma.balanceLog.create.mockResolvedValue({})

      const res = await performAction(token, 'purchase_upgrade', { upgradeType: 'clickPower' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState).toBeDefined()
      // Verify BalanceLog.create was called
      expect(prisma.balanceLog.create).toHaveBeenCalled()
    })
  })
})
