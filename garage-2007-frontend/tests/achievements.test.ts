import { describe, expect, it, vi } from 'vitest'
import { ACHIEVEMENTS, initialState, useGameStore } from '../src/store/gameStore'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockPerformAction = vi.mocked(api.performAction)

describe('achievement actions', () => {
  it('unlocks garage_level_2 when garageLevel reaches 2', () => {
    useGameStore.setState({ garageLevel: 2 })
    const unlocked = useGameStore.getState().checkAchievements()
    expect(unlocked).toContain('garage_level_2')
    expect(useGameStore.getState().achievements.garage_level_2.unlocked).toBe(true)
    expect(useGameStore.getState().hasNewAchievements).toBe(true)
  })

  it('does not unlock garage_level_2 when garageLevel is 1', () => {
    const unlocked = useGameStore.getState().checkAchievements()
    expect(unlocked).not.toContain('garage_level_2')
    expect(useGameStore.getState().achievements.garage_level_2.unlocked).toBe(false)
  })

  it('unlocks clicks_100 when totalClicks reaches 100', () => {
    useGameStore.setState({ totalClicks: 100 })
    const unlocked = useGameStore.getState().checkAchievements()
    expect(unlocked).toContain('clicks_100')
  })

  it('does not include already-unlocked achievements in return value', () => {
    useGameStore.setState({
      garageLevel: 2,
      achievements: { ...initialState.achievements, garage_level_2: { unlocked: true, claimed: false } },
    })
    const unlocked = useGameStore.getState().checkAchievements()
    expect(unlocked).not.toContain('garage_level_2')
  })

  it('claims unlocked achievement and awards nuts (server-first)', async () => {
    const nutsReward = ACHIEVEMENTS.garage_level_2.nutsReward
    useGameStore.setState({
      achievements: { ...initialState.achievements, garage_level_2: { unlocked: true, claimed: false } },
    })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: nutsReward,
        achievements: { ...initialState.achievements, garage_level_2: { unlocked: true, claimed: true } },
      }),
    })

    const result = await useGameStore.getState().claimAchievement('garage_level_2')
    expect(result).toBe(true)
    expect(useGameStore.getState().nuts).toBe(nutsReward)
    expect(useGameStore.getState().achievements.garage_level_2.claimed).toBe(true)
  })

  it('returns false when achievement is not unlocked', async () => {
    const result = await useGameStore.getState().claimAchievement('garage_level_2')
    expect(result).toBe(false)
    expect(useGameStore.getState().nuts).toBe(0)
  })

  it('returns false on re-claim and does not double-award nuts', async () => {
    useGameStore.setState({
      nuts: 5,
      achievements: { ...initialState.achievements, garage_level_2: { unlocked: true, claimed: true } },
    })
    const result = await useGameStore.getState().claimAchievement('garage_level_2')
    expect(result).toBe(false)
    expect(useGameStore.getState().nuts).toBe(5)
  })

  it('does not set hasNewAchievements when nothing unlocks', () => {
    useGameStore.getState().checkAchievements()
    expect(useGameStore.getState().hasNewAchievements).toBe(false)
  })

  it('clears hasNewAchievements flag', () => {
    useGameStore.setState({ hasNewAchievements: true })
    useGameStore.getState().clearNewAchievementsFlag()
    expect(useGameStore.getState().hasNewAchievements).toBe(false)
  })

  it('unlocks multiple achievements in one checkAchievements call', () => {
    useGameStore.setState({ garageLevel: 2, totalClicks: 100 })
    const unlocked = useGameStore.getState().checkAchievements()
    expect(unlocked).toContain('garage_level_2')
    expect(unlocked).toContain('clicks_100')
  })
})
