import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore, initialState, DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS } from '../src/store/gameStore'

describe('daily reward system', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('claims day 0 reward on first ever claim', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    // initialState has dailyRewards: { lastClaimTimestamp: 0, currentStreak: 0 }
    useGameStore.getState().claimDailyReward()
    const state = useGameStore.getState()

    expect(state.nuts).toBe(DAILY_REWARDS[0]) // 5
    expect(state.dailyRewards.currentStreak).toBe(1)
    expect(state.bestStreak).toBe(1)
    expect(state.dailyRewards.lastClaimTimestamp).toBe(Date.now())
  })

  it('blocks re-claim within grace period', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.getState().claimDailyReward()
    const nutsAfterFirst = useGameStore.getState().nuts

    useGameStore.getState().claimDailyReward() // immediate re-claim
    expect(useGameStore.getState().nuts).toBe(nutsAfterFirst) // no change
    expect(useGameStore.getState().dailyRewards.currentStreak).toBe(1) // no change
  })

  it('claims day 1 reward after 24h advances streak', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.getState().claimDailyReward() // day 0: 5 nuts, streak: 1

    vi.advanceTimersByTime(DAILY_STREAK_GRACE_PERIOD_MS) // advance 24h
    useGameStore.getState().claimDailyReward() // day 1: 5 nuts, streak: 2

    const state = useGameStore.getState()
    expect(state.nuts).toBe(DAILY_REWARDS[0] + DAILY_REWARDS[1]) // 5 + 5 = 10
    expect(state.dailyRewards.currentStreak).toBe(2)
  })

  it('awards 50 nuts on day 6 (7th day of streak)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    // Simulate being on streak day 6 (index 6 in DAILY_REWARDS)
    useGameStore.setState({
      dailyRewards: { lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS, currentStreak: 6 }
    })

    useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().nuts).toBe(50) // DAILY_REWARDS[6] = 50
    expect(useGameStore.getState().dailyRewards.currentStreak).toBe(7)
  })

  it('wraps streak to day 0 reward after full 7-day cycle', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    // Simulate being on streak 7 (index 7 % 7 = 0 → day 0 reward again)
    useGameStore.setState({
      dailyRewards: { lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS, currentStreak: 7 }
    })

    useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().nuts).toBe(DAILY_REWARDS[7 % 7]) // DAILY_REWARDS[0] = 5
  })

  it('updates bestStreak when currentStreak exceeds it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({ bestStreak: 3 })

    // Claim from streak 3 → becomes 4 → new bestStreak
    useGameStore.setState({
      dailyRewards: { lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS, currentStreak: 3 }
    })
    useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().dailyRewards.currentStreak).toBe(4)
    expect(useGameStore.getState().bestStreak).toBe(4)
  })

  it('checkDailyReward opens modal when never claimed', () => {
    // initialState has lastClaimTimestamp: 0
    useGameStore.getState().checkDailyReward()
    expect(useGameStore.getState().showDailyRewardsModal).toBe(true)
  })

  it('checkDailyReward resets streak if more than 2x grace period elapsed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    // Last claim was 3 days ago (> 2 * DAILY_STREAK_GRACE_PERIOD_MS)
    useGameStore.setState({
      dailyRewards: {
        lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS * 3,
        currentStreak: 5
      }
    })

    useGameStore.getState().checkDailyReward()

    const state = useGameStore.getState()
    expect(state.dailyRewards.currentStreak).toBe(0)
    expect(state.dailyRewards.lastClaimTimestamp).toBe(0)
    expect(state.showDailyRewardsModal).toBe(true)
  })
})
