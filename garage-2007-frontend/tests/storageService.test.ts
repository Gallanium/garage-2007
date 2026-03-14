import { describe, expect, it, vi } from 'vitest'
import {
  SAVE_VERSION,
  STORAGE_KEY,
  calculateOfflineEarnings,
  clearSave,
  getLastSaveTime,
  hasSave,
  loadGame,
  saveGameFull,
  type SaveData,
} from '../src/utils/storageService'

function createSave(overrides: Partial<SaveData> = {}): SaveData {
  return {
    version: SAVE_VERSION,
    timestamp: 0,
    playerData: {
      balance: 1234,
      nuts: 7,
      totalClicks: 15,
      garageLevel: 3,
      milestonesPurchased: [5],
    },
    upgrades: {
      clickPower: { level: 2, cost: 132 },
      workSpeed: { level: 1, cost: 575 },
    },
    workers: {
      apprentice: { count: 1, cost: 575 },
      mechanic: { count: 1, cost: 5_750 },
      master: { count: 0, cost: 50_000 },
      brigadier: { count: 0, cost: 500_000 },
      director: { count: 0, cost: 5_000_000 },
    },
    stats: {
      totalEarned: 2222,
      sessionCount: 3,
      lastSessionDate: '2026-03-12T10:00:00.000Z',
      peakClickIncome: 15,
      totalPlayTimeSeconds: 600,
      bestStreak: 2,
    },
    achievements: {
      garage_level_2: { unlocked: true, claimed: false, unlockedAt: 123 },
    },
    dailyRewards: { lastClaimTimestamp: 1000, currentStreak: 2 },
    rewardedVideo: { lastWatchedTimestamp: 500, totalWatches: 1 },
    boosts: { active: [] },
    events: { activeEvent: null, cooldownEnd: 0 },
    ...overrides,
  }
}

describe('storageService', () => {
  it('saves and loads a full save payload', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))

    const save = createSave()
    expect(saveGameFull(save)).toBe(true)

    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded?.version).toBe(SAVE_VERSION)
    expect(loaded?.timestamp).toBe(Date.now())
    expect(loaded?.playerData.balance).toBe(1234)
    expect(loaded?.workers.mechanic.count).toBe(1)
  })

  it('reports presence of a save and clears it', () => {
    expect(hasSave()).toBe(false)

    saveGameFull(createSave())
    expect(hasSave()).toBe(true)
    expect(getLastSaveTime()).not.toBeNull()

    clearSave()
    expect(hasSave()).toBe(false)
    expect(loadGame()).toBeNull()
  })

  it('drops invalid save payloads', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))

    expect(loadGame()).toBeNull()
  })

  it('migrates legacy milestone field from version 2 saves', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        timestamp: 100,
        playerData: {
          balance: 1000,
          nuts: 3,
          totalClicks: 10,
          garageLevel: 5,
          functionalUpgradesPurchased: [5, 10],
        },
        upgrades: {
          clickPower: { level: 1, cost: 115 },
          workSpeed: { level: 0, cost: 500 },
        },
        workers: {
          apprentice: { count: 1, cost: 575 },
          mechanic: { count: 0, cost: 5_000 },
          master: { count: 0, cost: 50_000 },
          brigadier: { count: 0, cost: 500_000 },
          director: { count: 0, cost: 5_000_000 },
        },
        stats: {
          totalEarned: 1000,
          sessionCount: 1,
          lastSessionDate: '2026-03-12T10:00:00.000Z',
          peakClickIncome: 0,
          totalPlayTimeSeconds: 0,
          bestStreak: 0,
        },
      }),
    )

    const loaded = loadGame()
    expect(loaded?.playerData.milestonesPurchased).toEqual([5, 10])
    expect(loaded?.version).toBe(SAVE_VERSION)
    expect(loaded?.events).toEqual({ activeEvent: null, cooldownEnd: 0 })
  })

  it('calculates offline earnings with full and reduced efficiency windows', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'))

    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000
    expect(calculateOfflineEarnings(10, twelveHoursAgo)).toBe(360_000)

    const thirtyHoursAgo = Date.now() - 30 * 60 * 60 * 1000
    expect(calculateOfflineEarnings(10, thirtyHoursAgo)).toBe(576_000)
  })
})
