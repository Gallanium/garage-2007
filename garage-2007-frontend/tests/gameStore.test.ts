import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOST_DEFINITIONS } from '../src/store/constants/boosts'
import {
  DAILY_STREAK_GRACE_PERIOD_MS,
  GAME_EVENTS,
  initialState,
  useGameStore,
} from '../src/store/gameStore'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockPerformAction = vi.mocked(api.performAction)

describe('game store actions', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('handles a regular click and updates balance, totals and click count', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)

    const result = useGameStore.getState().handleClick()
    const state = useGameStore.getState()

    expect(result).toBe(false)
    expect(state.balance).toBe(1)
    expect(state.totalEarned).toBe(1)
    expect(state.totalClicks).toBe(1)
  })

  it('purchases a click upgrade and recalculates click value', async () => {
    useGameStore.setState({ balance: 1_000 })

    mockPerformAction.mockResolvedValueOnce({ success: true, gameState: null })
    const success = await useGameStore.getState().purchaseClickUpgrade()
    const state = useGameStore.getState()

    expect(success).toBe(true)
    expect(state.balance).toBe(900)
    expect(state.upgrades.clickPower.level).toBe(1)
    expect(state.clickValue).toBe(2)
    expect(state.upgrades.clickPower.cost).toBe(114)
  })

  it('hires a worker and recalculates passive income', async () => {
    useGameStore.setState({ balance: 1_000 })

    mockPerformAction.mockResolvedValueOnce({ success: true, gameState: null })
    await useGameStore.getState().hireWorker('apprentice')
    const state = useGameStore.getState()

    expect(state.balance).toBe(500)
    expect(state.workers.apprentice.count).toBe(1)
    expect(state.workers.apprentice.cost).toBe(575)
    expect(state.passiveIncomePerSecond).toBe(2)
  })

  it('opens and purchases a milestone when the threshold is reached', async () => {
    useGameStore.setState({ balance: 1_000_000, garageLevel: 4 })

    useGameStore.getState().checkForMilestone()
    expect(useGameStore.getState().pendingMilestoneLevel).toBe(5)
    expect(useGameStore.getState().showMilestoneModal).toBe(true)

    mockPerformAction.mockResolvedValueOnce({ success: true, gameState: null })
    const purchased = await useGameStore.getState().purchaseMilestone(5)
    const state = useGameStore.getState()

    expect(purchased).toBe(true)
    expect(state.milestonesPurchased).toContain(5)
    expect(state.garageLevel).toBe(5)
    expect(state.showMilestoneModal).toBe(false)
  })

  it('claims a daily reward once and blocks immediate re-claim', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 5,
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 1 },
        bestStreak: 1,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    let state = useGameStore.getState()

    expect(state.nuts).toBe(5)
    expect(state.dailyRewards.currentStreak).toBe(1)
    expect(state.bestStreak).toBe(1)

    await useGameStore.getState().claimDailyReward()
    state = useGameStore.getState()
    expect(state.nuts).toBe(5)
    expect(state.dailyRewards.currentStreak).toBe(1)

    vi.advanceTimersByTime(DAILY_STREAK_GRACE_PERIOD_MS)
    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 10,
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 2 },
        bestStreak: 2,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    state = useGameStore.getState()

    expect(state.nuts).toBe(10)
    expect(state.dailyRewards.currentStreak).toBe(2)
  })

  it('activates and expires turbo boost with correct multipliers', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })

    const now = Date.now()
    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 5,
        boosts: { active: [{ type: 'turbo', activatedAt: now, expiresAt: now + BOOST_DEFINITIONS.turbo.durationMs }] },
      }),
    })
    const success = await useGameStore.getState().activateBoost('turbo')
    expect(success).toBe(true)
    expect(useGameStore.getState().nuts).toBe(5)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(5)
    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(1)

    vi.advanceTimersByTime(BOOST_DEFINITIONS.turbo.durationMs + 1)
    useGameStore.getState().tickBoosts()

    expect(useGameStore.getState().boosts.active).toHaveLength(0)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(1)
  })

  it('triggers a random event via server and exposes its multiplier', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))

    const now = Date.now()
    let resolvePromise: (v: unknown) => void
    const promise = new Promise(r => { resolvePromise = r })
    mockPerformAction.mockReturnValueOnce(promise as ReturnType<typeof api.performAction>)

    const triggered = useGameStore.getState().triggerRandomEvent()
    expect(triggered).toBe(true)

    // Resolve the server response
    resolvePromise!({
      success: true,
      gameState: buildMockServerState({
        events: {
          activeEvent: { id: 'client_rush', activatedAt: now, expiresAt: now + 60_000, eventSeed: 123 },
          cooldownEnd: now + 180_000,
        },
      }),
    })

    // Wait for microtask to flush
    await vi.advanceTimersByTimeAsync(0)

    const state = useGameStore.getState()
    expect(state.events.activeEvent?.id).toBe('client_rush')
    expect(state.getEventMultiplier('income')).toBe(GAME_EVENTS.client_rush.effect.multiplier)
    expect(state.getEventMultiplier('click')).toBe(1)
    expect(state.events.cooldownEnd).toBeGreaterThan(now)
  })
})
