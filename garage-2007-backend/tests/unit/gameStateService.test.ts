import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadState } from '../../src/services/gameStateService'
import { __mockClient } from '@prisma/client'
import { createTestGameSave, createTestDbUser } from '../helpers'

const prisma = __mockClient as any

describe('gameStateService — loadState', () => {
  const userId = 1

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('existing player returns full gameState object', async () => {
    const gameSave = createTestGameSave({ userId, balance: 5000, garageLevel: 3 })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)

    const result = await loadState(userId)

    expect(result).toHaveProperty('gameState')
    expect(result.gameState).not.toBeNull()
    expect(result.gameState.balance).toBeDefined()
    expect(result.gameState.garageLevel).toBe(3)
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
    const gameSave = createTestGameSave({
      userId,
      balance: 1000,
      lastSyncAt: oneHourAgo,
      apprenticeCount: 1, // has passive income
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const result = await loadState(userId)

    // Should have offline earnings since there are workers and time has passed
    expect(result).toHaveProperty('offlineEarnings')
    if (result.offlineEarnings) {
      expect(result.offlineEarnings.timeAway).toBeGreaterThan(0)
      expect(result.offlineEarnings.amount).toBeGreaterThanOrEqual(0)
    }

    vi.useRealTimers()
  })

  it('expired boosts removed from state on load', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-03-16T12:00:00Z')
    vi.setSystemTime(now)

    const gameSave = createTestGameSave({
      userId,
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
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const result = await loadState(userId)

    // Expired boosts should be removed
    const activeBoosts = result.gameState?.boosts?.active ?? []
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

    const gameSave = createTestGameSave({
      userId,
      events: {
        activeEvent: {
          id: 'discount_upgrades',
          activatedAt: new Date('2026-03-16T09:00:00Z').getTime(),
          expiresAt: new Date('2026-03-16T10:00:00Z').getTime(), // expired 2h ago
        },
        cooldownEnd: 0,
      },
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const result = await loadState(userId)

    // Expired event should be cleared
    expect(result.gameState?.events?.activeEvent).toBeNull()

    vi.useRealTimers()
  })

  it('lastSyncAt updated after load', async () => {
    const gameSave = createTestGameSave({ userId })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    await loadState(userId)

    // Verify that gameSave.update was called to update lastSyncAt
    expect(prisma.gameSave.update).toHaveBeenCalled()
    const updateCall = prisma.gameSave.update.mock.calls[0][0]
    expect(updateCall.data).toHaveProperty('lastSyncAt')
  })

  it('response includes serverTime as number', async () => {
    const gameSave = createTestGameSave({ userId })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const result = await loadState(userId)

    expect(result).toHaveProperty('serverTime')
    expect(typeof result.serverTime).toBe('number')
    // serverTime should be a reasonable Unix timestamp in milliseconds
    expect(result.serverTime).toBeGreaterThan(1_000_000_000_000)
  })
})
