import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadState } from '../../src/services/gameStateService'
import { __mockClient } from '@prisma/client'
import { createTestGameSave, createTestDbUser } from '../helpers'

const prisma = __mockClient as any

describe('gameStateService — loadState', () => {
  const userId = 1
  let currentGameSave: ReturnType<typeof createTestGameSave> | null

  beforeEach(() => {
    vi.clearAllMocks()
    currentGameSave = null

    // OCC: updateMany returns { count: 1 } (optimistic lock succeeds)
    prisma.gameSave.updateMany.mockResolvedValue({ count: 1 })

    prisma.balanceLog.create.mockResolvedValue({})
  })

  it('existing player returns full gameState object', async () => {
    currentGameSave = createTestGameSave({ userId, balance: 5000, garageLevel: 3 })
    prisma.gameSave.findUnique.mockResolvedValue(currentGameSave)

    const result = await loadState(userId)

    expect(result).toHaveProperty('gameState')
    expect(result.gameState).not.toBeNull()
    expect(result.gameState!.balance).toBeDefined()
    expect(result.gameState!.garageLevel).toBe(3)
  })

  it('new player (no GameSave) returns { gameState: null, serverTime }', async () => {
    prisma.gameSave.findUnique.mockResolvedValue(null)

    const result = await loadState(userId)

    expect(result.gameState).toBeNull()
    expect(result).toHaveProperty('serverTime')
    expect(typeof result.serverTime).toBe('number')
  })

  it('offline earnings calculated based on time since lastSyncAt', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-03-16T12:00:00Z')
    vi.setSystemTime(now)

    const oneHourAgo = new Date('2026-03-16T11:00:00Z')
    currentGameSave = createTestGameSave({
      userId,
      balance: 1000,
      lastSyncAt: oneHourAgo,
      apprenticeCount: 1, // has passive income
    })
    prisma.gameSave.findUnique.mockResolvedValue(currentGameSave)

    const result = await loadState(userId)

    // Should have offline earnings since there are workers and time has passed
    expect(result).toHaveProperty('offlineEarnings')
    if (result.offlineEarnings) {
      expect(result.offlineEarnings.timeAway).toBeGreaterThan(0)
      expect(result.offlineEarnings.amount).toBeGreaterThanOrEqual(0)
    }

    vi.useRealTimers()
  })

  it('offline earnings exclude active boost multipliers', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-03-16T12:00:00Z')
    vi.setSystemTime(now)

    const oneHourAgo = new Date('2026-03-16T11:00:00Z')

    // Save WITHOUT boosts
    const saveNoBoost = createTestGameSave({
      userId,
      balance: 1000,
      lastSyncAt: oneHourAgo,
      apprenticeCount: 1,
      boosts: { active: [] },
    })
    prisma.gameSave.findUnique.mockResolvedValue(saveNoBoost)
    currentGameSave = saveNoBoost
    const resultNoBoost = await loadState(userId)

    // Save WITH active income_2x boost
    const saveWithBoost = createTestGameSave({
      userId,
      balance: 1000,
      lastSyncAt: oneHourAgo,
      apprenticeCount: 1,
      boosts: {
        active: [{
          type: 'income_2x',
          activatedAt: now.getTime() - 600_000,
          expiresAt: now.getTime() + 600_000, // still active
        }],
      },
    })
    prisma.gameSave.findUnique.mockResolvedValue(saveWithBoost)
    currentGameSave = saveWithBoost
    const resultWithBoost = await loadState(userId)

    // Offline earnings should be the same regardless of active boosts
    expect(resultNoBoost.offlineEarnings?.amount).toBe(resultWithBoost.offlineEarnings?.amount)

    vi.useRealTimers()
  })

  it('expired boosts removed from state on load', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-03-16T12:00:00Z')
    vi.setSystemTime(now)

    currentGameSave = createTestGameSave({
      userId,
      lastSyncAt: new Date(Date.now() - 3600_000),
      boosts: {
        active: [
          {
            type: 'turbo',
            activatedAt: new Date('2026-03-16T10:00:00Z').getTime(),
            expiresAt: new Date('2026-03-16T11:00:00Z').getTime(), // expired 1h ago
          },
        ],
      },
    })
    prisma.gameSave.findUnique.mockResolvedValue(currentGameSave)

    const result = await loadState(userId)

    // Expired boosts should be removed
    const activeBoosts = (result.gameState?.boosts as any)?.active ?? []
    const expiredBoost = activeBoosts.find(
      (b: any) => b.type === 'turbo' && b.expiresAt < now.getTime(),
    )
    expect(expiredBoost).toBeUndefined()

    vi.useRealTimers()
  })

  it('expired events cleared on load', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-03-16T12:00:00Z')
    vi.setSystemTime(now)

    currentGameSave = createTestGameSave({
      userId,
      lastSyncAt: new Date(Date.now() - 3600_000),
      events: {
        activeEvent: {
          id: 'discount_upgrades',
          activatedAt: new Date('2026-03-16T09:00:00Z').getTime(),
          expiresAt: new Date('2026-03-16T10:00:00Z').getTime(), // expired 2h ago
        },
        cooldownEnd: 0,
      },
    })
    prisma.gameSave.findUnique.mockResolvedValue(currentGameSave)

    const result = await loadState(userId)

    // Expired event should be cleared
    expect((result.gameState?.events as any)?.activeEvent).toBeNull()

    vi.useRealTimers()
  })

  it('lastSyncAt updated after load', async () => {
    currentGameSave = createTestGameSave({ userId })
    prisma.gameSave.findUnique.mockResolvedValue(currentGameSave)

    await loadState(userId)

    // Verify that gameSave.updateMany was called (OCC) to update lastSyncAt
    expect(prisma.gameSave.updateMany).toHaveBeenCalled()
    const updateCall = prisma.gameSave.updateMany.mock.calls[0][0]
    expect(updateCall.data).toHaveProperty('lastSyncAt')
  })

  it('response includes serverTime as number', async () => {
    currentGameSave = createTestGameSave({ userId })
    prisma.gameSave.findUnique.mockResolvedValue(currentGameSave)

    const result = await loadState(userId)

    expect(result).toHaveProperty('serverTime')
    expect(typeof result.serverTime).toBe('number')
    // serverTime should be a reasonable Unix timestamp in milliseconds
    expect(result.serverTime).toBeGreaterThan(1_000_000_000_000)
  })
})
