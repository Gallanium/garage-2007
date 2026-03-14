import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOST_DEFINITIONS } from '../src/store/constants/boosts'
import {
  DAILY_STREAK_GRACE_PERIOD_MS,
  GAME_EVENTS,
  initialState,
  useGameStore,
} from '../src/store/gameStore'

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

  it('purchases a click upgrade and recalculates click value', () => {
    useGameStore.setState({ balance: 1_000 })

    const success = useGameStore.getState().purchaseClickUpgrade()
    const state = useGameStore.getState()

    expect(success).toBe(true)
    expect(state.balance).toBe(900)
    expect(state.upgrades.clickPower.level).toBe(1)
    expect(state.clickValue).toBe(2)
    expect(state.upgrades.clickPower.cost).toBe(114)
  })

  it('hires a worker and recalculates passive income', () => {
    useGameStore.setState({ balance: 1_000 })

    useGameStore.getState().hireWorker('apprentice')
    const state = useGameStore.getState()

    expect(state.balance).toBe(500)
    expect(state.workers.apprentice.count).toBe(1)
    expect(state.workers.apprentice.cost).toBe(575)
    expect(state.passiveIncomePerSecond).toBe(2)
  })

  it('opens and purchases a milestone when the threshold is reached', () => {
    useGameStore.setState({ balance: 1_000_000, garageLevel: 4 })

    useGameStore.getState().checkForMilestone()
    expect(useGameStore.getState().pendingMilestoneLevel).toBe(5)
    expect(useGameStore.getState().showMilestoneModal).toBe(true)

    const purchased = useGameStore.getState().purchaseMilestone(5)
    const state = useGameStore.getState()

    expect(purchased).toBe(true)
    expect(state.milestonesPurchased).toContain(5)
    expect(state.garageLevel).toBe(5)
    expect(state.showMilestoneModal).toBe(false)
  })

  it('claims a daily reward once and blocks immediate re-claim', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))

    useGameStore.getState().claimDailyReward()
    let state = useGameStore.getState()

    expect(state.nuts).toBe(5)
    expect(state.dailyRewards.currentStreak).toBe(1)
    expect(state.bestStreak).toBe(1)

    useGameStore.getState().claimDailyReward()
    state = useGameStore.getState()

    expect(state.nuts).toBe(5)
    expect(state.dailyRewards.currentStreak).toBe(1)

    vi.advanceTimersByTime(DAILY_STREAK_GRACE_PERIOD_MS)
    useGameStore.getState().claimDailyReward()
    state = useGameStore.getState()

    expect(state.nuts).toBe(10)
    expect(state.dailyRewards.currentStreak).toBe(2)
  })

  it('activates and expires turbo boost with correct multipliers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })

    const success = useGameStore.getState().activateBoost('turbo')
    expect(success).toBe(true)
    expect(useGameStore.getState().nuts).toBe(5)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(5)
    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(1)

    vi.advanceTimersByTime(BOOST_DEFINITIONS.turbo.durationMs + 1)
    useGameStore.getState().tickBoosts()

    expect(useGameStore.getState().boosts.active).toHaveLength(0)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(1)
  })

  it('triggers a deterministic random event and exposes its multiplier', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00.000Z'))
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)

    const triggered = useGameStore.getState().triggerRandomEvent()
    const state = useGameStore.getState()

    expect(triggered).toBe(true)
    expect(state.events.activeEvent?.id).toBe('client_rush')
    expect(state.getEventMultiplier('income')).toBe(GAME_EVENTS.client_rush.effect.multiplier)
    expect(state.getEventMultiplier('click')).toBe(1)
    expect(state.events.cooldownEnd).toBeGreaterThan(Date.now())
  })
})
