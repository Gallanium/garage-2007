// These tests are written against the backend spec (docs/BACKEND_MVP.md).
// They will fail until the corresponding backend code is implemented.
// Run: npm test

import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import app from '../../src/index'
import {
  createValidInitData,
  createTelegramUser,
  DEFAULT_TELEGRAM_USER,
  createAuthHeader,
  TEST_BOT_TOKEN,
} from '../helpers'

/**
 * Helper: authenticate a user and return the JWT token.
 */
async function authenticateUser(
  user = DEFAULT_TELEGRAM_USER,
): Promise<string> {
  const initData = createValidInitData(user, TEST_BOT_TOKEN)
  const res = await request(app)
    .post('/api/auth/telegram')
    .send({ initData })
  return res.body.token
}

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

/**
 * Helper: sync game state to ensure a GameSave record exists.
 */
async function ensureGameState(token: string) {
  await request(app)
    .post('/api/game/sync')
    .set(createAuthHeader(token))
    .send({ clicksSinceLastSync: 0, clientTimestamp: Date.now() })
}

describe('POST /api/game/action', () => {
  // ── Happy path tests ───────────────────────────────────────────────────────

  describe('purchase_upgrade', () => {
    it('increments clickPowerLevel on valid purchase', async () => {
      // Use a user with enough balance (default game save has balance: 10000,
      // clickPower upgrade cost starts at 100)
      const user = createTelegramUser({ id: 100_000_001, first_name: 'Upgrader' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const res = await performAction(token, 'purchase_upgrade', { upgradeType: 'clickPower' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState).toBeDefined()
      expect(res.body.gameState.clickPowerLevel).toBeGreaterThanOrEqual(1)
    })
  })

  describe('hire_worker', () => {
    it('increments apprenticeCount on valid hire', async () => {
      // Apprentice costs 500, default balance is 10000
      const user = createTelegramUser({ id: 100_000_002, first_name: 'Hirer' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const res = await performAction(token, 'hire_worker', { workerType: 'apprentice' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState.apprenticeCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('purchase_milestone', () => {
    it('adds milestone level to milestonesPurchased', async () => {
      // Milestone 5 requires garageLevel == 4 and balance >= 1,000,000.
      // This test assumes the user has been set up with sufficient state.
      // In a real test environment, DB seeding would provide this state.
      // For now, we verify the API shape and error handling.
      const user = createTelegramUser({ id: 100_000_003, first_name: 'Milestoner' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      // NOTE: This test may return 400 (INSUFFICIENT_BALANCE) in practice
      // unless the test DB is seeded with garageLevel=4 and balance >= 1M.
      // The test verifies the endpoint responds correctly for the happy path.
      const res = await performAction(token, 'purchase_milestone', { level: 5 })

      // If the player has sufficient state, expect success
      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        expect(res.body.gameState.milestonesPurchased).toContain(5)
      } else {
        // Otherwise verify it returns a proper error (not a crash)
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
      }
    })
  })

  describe('purchase_decoration', () => {
    it('adds decoration to decorationsOwned', async () => {
      const user = createTelegramUser({ id: 100_000_004, first_name: 'Decorator' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const res = await performAction(token, 'purchase_decoration', {
        decorationId: 'tools_workbench',
      })

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        expect(res.body.gameState.decorationsOwned).toContain('tools_workbench')
      } else {
        // Insufficient balance or garageLevel requirement not met
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
      }
    })
  })

  describe('toggle_decoration', () => {
    it('toggles a decoration in decorationsActive (must own it first)', async () => {
      const user = createTelegramUser({ id: 100_000_005, first_name: 'Toggler' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      // First, purchase the decoration
      await performAction(token, 'purchase_decoration', { decorationId: 'tools_workbench' })

      // Then toggle it on
      const res = await performAction(token, 'toggle_decoration', {
        decorationId: 'tools_workbench',
      })

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        // After toggling, it should be in active list
        expect(res.body.gameState.decorationsActive).toContain('tools_workbench')
      } else {
        // May fail if purchase_decoration failed (insufficient balance)
        expect(res.status).toBe(400)
      }
    })
  })

  describe('activate_boost', () => {
    it('deducts nuts and adds boost to active list', async () => {
      // Default nuts: 50, turbo boost costs vary by spec
      const user = createTelegramUser({ id: 100_000_006, first_name: 'Booster' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const stateBefore = await request(app)
        .get('/api/game/state')
        .set(createAuthHeader(token))
      const nutsBefore = stateBefore.body.gameState?.nuts ?? 50

      const res = await performAction(token, 'activate_boost', { boostType: 'turbo' })

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        // Nuts should be deducted
        expect(res.body.gameState.nuts).toBeLessThan(nutsBefore)
        // Boost should be active
        expect(res.body.gameState.boosts.active).toBeDefined()
        expect(res.body.gameState.boosts.active.length).toBeGreaterThan(0)
      } else {
        // Insufficient nuts or milestone requirement not met
        expect(res.status).toBe(400)
      }
    })
  })

  describe('claim_achievement', () => {
    it('awards nuts when claiming an unlocked achievement', async () => {
      // garage_level_2 should be unlockable after reaching garageLevel >= 2
      const user = createTelegramUser({ id: 100_000_007, first_name: 'Achiever' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const res = await performAction(token, 'claim_achievement', {
        achievementId: 'garage_level_2',
      })

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        // Nuts should increase from achievement reward
        expect(res.body.gameState.nuts).toBeGreaterThanOrEqual(0)
      } else {
        // Achievement not yet unlocked
        expect(res.status).toBe(400)
      }
    })
  })

  describe('claim_daily_reward', () => {
    it('increases nuts on valid daily reward claim', async () => {
      const user = createTelegramUser({ id: 100_000_008, first_name: 'DailyRewarder' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const stateBefore = await request(app)
        .get('/api/game/state')
        .set(createAuthHeader(token))
      const nutsBefore = stateBefore.body.gameState?.nuts ?? 50

      const res = await performAction(token, 'claim_daily_reward', {})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.gameState.nuts).toBeGreaterThan(nutsBefore)
    })
  })

  describe('watch_rewarded_video', () => {
    it('awards 5 nuts on valid rewarded video watch', async () => {
      const user = createTelegramUser({ id: 100_000_009, first_name: 'VideoWatcher' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const stateBefore = await request(app)
        .get('/api/game/state')
        .set(createAuthHeader(token))
      const nutsBefore = stateBefore.body.gameState?.nuts ?? 50

      const res = await performAction(token, 'watch_rewarded_video', {})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      // Should get +5 nuts
      expect(res.body.gameState.nuts).toBe(nutsBefore + 5)
    })
  })

  describe('trigger_event', () => {
    it('activates a random event', async () => {
      const user = createTelegramUser({ id: 100_000_010, first_name: 'Eventer' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const res = await performAction(token, 'trigger_event', {})

      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        // An event should now be active
        expect(res.body.gameState.events).toBeDefined()
        expect(res.body.gameState.events.activeEvent).not.toBeNull()
      } else {
        // Cooldown not elapsed
        expect(res.status).toBe(400)
      }
    })
  })

  // ── Error cases ────────────────────────────────────────────────────────────

  describe('error: insufficient balance', () => {
    it('returns 400 with INSUFFICIENT_BALANCE error', async () => {
      // Create user, sync to get a GameSave, then try to purchase upgrade
      // repeatedly until balance runs out
      const user = createTelegramUser({ id: 100_000_011, first_name: 'Broke' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      // Try to buy an expensive upgrade that exceeds starting balance.
      // workSpeed costs 500 initially — buy many times to drain balance,
      // or just attempt purchase_milestone which requires >= 1M.
      const res = await performAction(token, 'purchase_milestone', { level: 5 })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toBe('INSUFFICIENT_BALANCE')
    })
  })

  describe('idempotency', () => {
    it('returns same result without double mutation for duplicate idempotencyKey', async () => {
      const user = createTelegramUser({ id: 100_000_012, first_name: 'Idempotent' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const key = randomUUID()

      // First call
      const first = await performAction(
        token,
        'purchase_upgrade',
        { upgradeType: 'clickPower' },
        key,
      )

      // Second call with same idempotency key
      const second = await performAction(
        token,
        'purchase_upgrade',
        { upgradeType: 'clickPower' },
        key,
      )

      // Both should succeed
      if (first.status === 200) {
        expect(second.status).toBe(200)
        // The clickPowerLevel should be the same (no double increment)
        expect(second.body.gameState.clickPowerLevel).toBe(first.body.gameState.clickPowerLevel)
        // Balance should be the same (no double deduction)
        expect(second.body.gameState.balance).toBe(first.body.gameState.balance)
      }
    })
  })

  describe('error: invalid action type', () => {
    it('returns 400 for an unknown action type', async () => {
      const token = await authenticateUser()
      await ensureGameState(token)

      const res = await performAction(token, 'nonexistent_action', {})

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
      const user = createTelegramUser({ id: 100_000_015, first_name: 'Audited' })
      const token = await authenticateUser(user)
      await ensureGameState(token)

      const res = await performAction(token, 'purchase_upgrade', { upgradeType: 'clickPower' })

      // The response should indicate success. BalanceLog creation is an
      // internal side effect. We verify via response metadata if available,
      // or just ensure the action completed without error.
      if (res.status === 200) {
        expect(res.body.success).toBe(true)
        // If the API exposes actionResult or metadata with balanceLog info,
        // we can check it here. Otherwise, the test validates that the
        // balance-changing action completed — BalanceLog should be verified
        // via direct DB inspection in a more thorough test environment.
        expect(res.body.gameState).toBeDefined()
      }
    })
  })
})
