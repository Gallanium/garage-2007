import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore, initialState, BOOST_DEFINITIONS } from '../src/store/gameStore'

describe('boost system', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('activates turbo boost when nuts are sufficient', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })

    const result = useGameStore.getState().activateBoost('turbo')

    expect(result).toBe(true)
    expect(useGameStore.getState().nuts).toBe(5) // 20 - 15
    expect(useGameStore.getState().boosts.active).toHaveLength(1)
    expect(useGameStore.getState().boosts.active[0].type).toBe('turbo')
  })

  it('returns false when nuts are insufficient', () => {
    useGameStore.setState({ nuts: 10 }) // turbo costs 15
    const result = useGameStore.getState().activateBoost('turbo')
    expect(result).toBe(false)
    expect(useGameStore.getState().boosts.active).toHaveLength(0)
  })

  it('returns false for income_2x when garageLevel < 5', () => {
    useGameStore.setState({ nuts: 50, garageLevel: 1 })
    const result = useGameStore.getState().activateBoost('income_2x')
    expect(result).toBe(false)
    expect(useGameStore.getState().nuts).toBe(50) // unchanged
  })

  it('activates income_2x when garageLevel >= 5 and nuts sufficient', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 50, garageLevel: 5 })

    const result = useGameStore.getState().activateBoost('income_2x')
    expect(result).toBe(true)
    expect(useGameStore.getState().nuts).toBe(20) // 50 - 30
    expect(useGameStore.getState().boosts.active[0].type).toBe('income_2x')
  })

  it('returns false when another boost is already active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({
      nuts: 50,
      boosts: { active: [{ type: 'turbo', activatedAt: Date.now(), expiresAt: Date.now() + 999_999 }] },
    })
    const result = useGameStore.getState().activateBoost('turbo')
    expect(result).toBe(false)
  })

  it('replaceBoost replaces an active boost', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({
      nuts: 50,
      garageLevel: 5,
      boosts: { active: [{ type: 'turbo', activatedAt: Date.now(), expiresAt: Date.now() + 999_999 }] },
    })
    const result = useGameStore.getState().replaceBoost('income_2x')
    expect(result).toBe(true)
    expect(useGameStore.getState().boosts.active[0].type).toBe('income_2x')
    expect(useGameStore.getState().boosts.active).toHaveLength(1)
  })

  it('tickBoosts removes expired boosts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({
      boosts: { active: [{ type: 'turbo', activatedAt: 0, expiresAt: Date.now() - 1 }] },
    })
    useGameStore.getState().tickBoosts()
    expect(useGameStore.getState().boosts.active).toHaveLength(0)
  })

  it('turbo multiplier applies to click only, not income', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })
    useGameStore.getState().activateBoost('turbo')

    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(5)
    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(1)
  })

  it('income_2x multiplier applies to both click and income', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 50, garageLevel: 5 })
    useGameStore.getState().activateBoost('income_2x')

    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(2)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(2)
  })

  it('getActiveMultiplier returns 1 after boost expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })
    useGameStore.getState().activateBoost('turbo')

    // Advance past turbo duration (900_000 ms = 15 min)
    vi.advanceTimersByTime(BOOST_DEFINITIONS.turbo.durationMs + 1_000)
    useGameStore.getState().tickBoosts()

    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(1)
    expect(useGameStore.getState().boosts.active).toHaveLength(0)
  })
})
