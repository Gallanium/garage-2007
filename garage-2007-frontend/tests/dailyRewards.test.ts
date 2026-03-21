import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore, initialState, DAILY_REWARDS, DAILY_STREAK_GRACE_PERIOD_MS } from '../src/store/gameStore'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockPerformAction = vi.mocked(api.performAction)

describe('daily reward system', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('claims day 0 reward on first ever claim', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: DAILY_REWARDS[0],
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 1 },
        bestStreak: 1,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    const state = useGameStore.getState()

    expect(state.nuts).toBe(DAILY_REWARDS[0])
    expect(state.dailyRewards.currentStreak).toBe(1)
    expect(state.bestStreak).toBe(1)
    expect(state.dailyRewards.lastClaimTimestamp).toBe(Date.now())
  })

  it('blocks re-claim within grace period', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: DAILY_REWARDS[0],
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 1 },
        bestStreak: 1,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    const nutsAfterFirst = useGameStore.getState().nuts

    // immediate re-claim should be blocked (no server call)
    await useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().nuts).toBe(nutsAfterFirst)
    expect(useGameStore.getState().dailyRewards.currentStreak).toBe(1)
  })

  it('claims day 1 reward after 24h advances streak', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: DAILY_REWARDS[0],
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 1 },
        bestStreak: 1,
      }),
    })
    await useGameStore.getState().claimDailyReward()

    vi.advanceTimersByTime(DAILY_STREAK_GRACE_PERIOD_MS)
    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: DAILY_REWARDS[0] + DAILY_REWARDS[1],
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 2 },
        bestStreak: 2,
      }),
    })
    await useGameStore.getState().claimDailyReward()

    const state = useGameStore.getState()
    expect(state.nuts).toBe(DAILY_REWARDS[0] + DAILY_REWARDS[1])
    expect(state.dailyRewards.currentStreak).toBe(2)
  })

  it('awards 50 nuts on day 6 (7th day of streak)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({
      dailyRewards: { lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS, currentStreak: 6 }
    })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 50,
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 7 },
        bestStreak: 7,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().nuts).toBe(50)
    expect(useGameStore.getState().dailyRewards.currentStreak).toBe(7)
  })

  it('wraps streak to day 0 reward after full 7-day cycle', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({
      dailyRewards: { lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS, currentStreak: 7 }
    })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: DAILY_REWARDS[7 % 7],
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 8 },
        bestStreak: 8,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().nuts).toBe(DAILY_REWARDS[7 % 7])
  })

  it('updates bestStreak when currentStreak exceeds it', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({
      bestStreak: 3,
      dailyRewards: { lastClaimTimestamp: Date.now() - DAILY_STREAK_GRACE_PERIOD_MS, currentStreak: 3 }
    })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        dailyRewards: { lastClaimTimestamp: Date.now(), currentStreak: 4 },
        bestStreak: 4,
      }),
    })
    await useGameStore.getState().claimDailyReward()
    expect(useGameStore.getState().dailyRewards.currentStreak).toBe(4)
    expect(useGameStore.getState().bestStreak).toBe(4)
  })

  it('checkDailyReward opens modal when never claimed', () => {
    useGameStore.getState().checkDailyReward()
    expect(useGameStore.getState().showDailyRewardsModal).toBe(true)
  })

  it('checkDailyReward resets streak if more than 2x grace period elapsed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

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
