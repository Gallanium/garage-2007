import { afterEach, beforeEach, vi } from 'vitest'
import { useGameStore } from '../src/store/gameStore'
import { initialState } from '../src/store/initialState'

// Mock apiService so server-first actions work in tests
vi.mock('../src/services/apiService', () => ({
  isOnline: () => true,
  performAction: vi.fn(async () => {
    // Return a mock ActionResponse with no gameState by default.
    // Tests that need server-first behavior should mock specific responses.
    return { success: true, gameState: null }
  }),
  sync: vi.fn(async () => null),
  authenticate: vi.fn(async () => null),
  loadState: vi.fn(async () => null),
  getToken: () => 'test-token',
  setToken: vi.fn(),
  clearToken: vi.fn(),
}))

/**
 * Build a clean server-like gameState from current store state,
 * stripping out functions and UI-only fields that wouldn't come from the server.
 */
export function buildMockServerState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const s = useGameStore.getState()
  return {
    balance: s.balance,
    nuts: s.nuts,
    totalClicks: s.totalClicks,
    garageLevel: s.garageLevel,
    milestonesPurchased: [...s.milestonesPurchased],
    totalEarned: s.totalEarned,
    sessionCount: s.sessionCount,
    lastSessionDate: s.lastSessionDate,
    peakClickIncome: s.peakClickIncome,
    totalPlayTimeSeconds: s.totalPlayTimeSeconds,
    bestStreak: s.bestStreak,
    upgrades: {
      clickPower: { ...s.upgrades.clickPower },
      workSpeed: { ...s.upgrades.workSpeed },
    },
    workers: {
      apprentice: { ...s.workers.apprentice },
      mechanic: { ...s.workers.mechanic },
      master: { ...s.workers.master },
      brigadier: { ...s.workers.brigadier },
      director: { ...s.workers.director },
    },
    achievements: Object.fromEntries(
      Object.entries(s.achievements).map(([k, v]) => [k, { ...v }]),
    ),
    dailyRewards: { ...s.dailyRewards },
    rewardedVideo: {
      lastWatchedTimestamp: s.rewardedVideo.lastWatchedTimestamp,
      totalWatches: s.rewardedVideo.totalWatches,
    },
    boosts: { active: s.boosts.active.map(b => ({ ...b })) },
    events: {
      activeEvent: s.events.activeEvent ? { ...s.events.activeEvent } : null,
      cooldownEnd: s.events.cooldownEnd,
    },
    decorations: {
      owned: [...s.decorations.owned],
      active: [...s.decorations.active],
    },
    ...overrides,
  }
}

class LocalStorageMock implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new LocalStorageMock(),
  configurable: true,
  writable: true,
})

beforeEach(() => {
  localStorage.clear()
  useGameStore.setState({ ...initialState })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  useGameStore.setState({ ...initialState })
})
