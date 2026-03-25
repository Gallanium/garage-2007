import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../src/store/gameStore'
import { initialState } from '../src/store/initialState'
import { buildMockServerState } from './setup'

describe('click valuation with multiplier snapshots', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState, isLoaded: true })
  })

  it('applyServerState compensates pending clicks using stored multiplier, not current boost state', () => {
    // Simulate 5 clicks made with a 2x boost
    useGameStore.setState({
      _pendingClickBuffer: Array.from({ length: 5 }, () => ({
        timestamp: Date.now(),
        isCritical: false,
        multiplier: 2,
      })),
      upgrades: {
        ...initialState.upgrades,
        clickPower: { level: 0, cost: 100, baseCost: 100 },
      },
    })

    // Server state has balance=100, boosts expired (empty active array)
    const serverState = buildMockServerState({
      serverTime: Date.now(),
      balance: 100,
      totalClicks: 10,
      totalEarned: 100,
      boosts: { active: [] }, // boost expired on server!
    })

    useGameStore.getState().applyServerState(serverState)

    // clickIncome at level 0 = 1
    // 5 pending × 1 base × 2 multiplier = 10
    // Expected: serverBalance(100) + pendingCompensation(10) = 110
    expect(useGameStore.getState().balance).toBe(110)
  })

  it('handles missing multiplier field (backward compat with old buffer entries)', () => {
    useGameStore.setState({
      _pendingClickBuffer: [
        // Old format without multiplier — fallback to 1
        { timestamp: Date.now(), isCritical: false } as unknown as { timestamp: number; isCritical: boolean; multiplier: number },
      ],
      upgrades: {
        ...initialState.upgrades,
        clickPower: { level: 0, cost: 100, baseCost: 100 },
      },
    })

    const serverState = buildMockServerState({
      serverTime: Date.now(),
      balance: 100,
      totalClicks: 10,
      totalEarned: 100,
      boosts: { active: [] },
    })

    useGameStore.getState().applyServerState(serverState)
    // Falls back to multiplier=1: 1 click × 1 base × 1 = 1
    expect(useGameStore.getState().balance).toBe(101)
  })

  it('correctly values critical clicks with stored multiplier', () => {
    useGameStore.setState({
      _pendingClickBuffer: [
        { timestamp: Date.now(), isCritical: true, multiplier: 3 },
      ],
      upgrades: {
        ...initialState.upgrades,
        clickPower: { level: 0, cost: 100, baseCost: 100 },
      },
    })

    const serverState = buildMockServerState({
      serverTime: Date.now(),
      balance: 50,
      totalClicks: 5,
      totalEarned: 50,
      boosts: { active: [] },
    })

    useGameStore.getState().applyServerState(serverState)
    // CRITICAL_CLICK_MULTIPLIER = 2
    // 1 critical click × 1 base × 2 crit × 3 multiplier = 6
    // Expected: serverBalance(50) + pendingCompensation(6) = 56
    expect(useGameStore.getState().balance).toBe(56)
  })
})
