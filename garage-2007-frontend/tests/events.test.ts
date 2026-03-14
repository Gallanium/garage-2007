import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EVENT_COOLDOWN_MS,
  GAME_EVENTS,
  initialState,
  useGameStore,
} from '../src/store/gameStore'

describe('random event system', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('returns false when cooldown is active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({
      events: { activeEvent: null, cooldownEnd: Date.now() + 999_999 },
    })
    const result = useGameStore.getState().triggerRandomEvent()
    expect(result).toBe(false)
    expect(useGameStore.getState().events.activeEvent).toBeNull()
  })

  it('triggers an event and sets activeEvent when no cooldown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const result = useGameStore.getState().triggerRandomEvent()
    expect(result).toBe(true)
    const state = useGameStore.getState()
    expect(state.events.activeEvent).not.toBeNull()
    expect(state.events.activeEvent?.id).toBeDefined()
    expect(state.events.cooldownEnd).toBeGreaterThan(Date.now())
  })

  it('triggers client_rush and exposes income multiplier', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)   // pickCategory: rand = 0 * 100 = 0 → positive
      .mockReturnValueOnce(0)   // pickEventInCategory: rand = 0 * 10 = 0 → client_rush
      .mockReturnValueOnce(0.5) // eventSeed
      .mockReturnValueOnce(0)   // EVENT_RANDOM_DELAY_MS jitter

    useGameStore.getState().triggerRandomEvent()
    const state = useGameStore.getState()

    expect(state.events.activeEvent?.id).toBe('client_rush')
    expect(state.getEventMultiplier('income')).toBe(GAME_EVENTS.client_rush.effect.multiplier) // 1.3
    expect(state.getEventMultiplier('click')).toBe(1) // client_rush is income-only
  })

  it('clears event after it expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const expiresAt = Date.now() + 100
    useGameStore.setState({
      events: {
        activeEvent: { id: 'client_rush', activatedAt: Date.now(), expiresAt, eventSeed: 0 },
        cooldownEnd: 0,
      },
    })

    vi.advanceTimersByTime(200) // advance past expiry
    useGameStore.getState().tickEvents()

    expect(useGameStore.getState().events.activeEvent).toBeNull()
  })

  it('does not clear an event that has not expired', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const expiresAt = Date.now() + 100_000 // far future
    useGameStore.setState({
      events: {
        activeEvent: { id: 'client_rush', activatedAt: Date.now(), expiresAt, eventSeed: 0 },
        cooldownEnd: 0,
      },
    })

    useGameStore.getState().tickEvents()
    expect(useGameStore.getState().events.activeEvent?.id).toBe('client_rush')
  })

  it('returns income multiplier for active income event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({
      events: {
        activeEvent: {
          id: 'client_rush',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 100_000,
          eventSeed: 0,
        },
        cooldownEnd: 0,
      },
    })

    expect(useGameStore.getState().getEventMultiplier('income')).toBe(1.3)
    expect(useGameStore.getState().getEventMultiplier('click')).toBe(1)
  })

  it('returns sub-1 multiplier for negative income event (equipment_break)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({
      events: {
        activeEvent: {
          id: 'equipment_break',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 100_000,
          eventSeed: 0,
        },
        cooldownEnd: 0,
      },
    })

    expect(useGameStore.getState().getEventMultiplier('income')).toBe(0.8)
  })

  it('returns cost multiplier for parts_discount event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    useGameStore.setState({
      events: {
        activeEvent: {
          id: 'parts_discount',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 100_000,
          eventSeed: 0,
        },
        cooldownEnd: 0,
      },
    })

    expect(useGameStore.getState().getEventCostMultiplier()).toBe(0.8)
    expect(useGameStore.getState().getEventMultiplier('income')).toBe(1) // not income scope
  })

  it('clearEvent removes the active event', () => {
    useGameStore.setState({
      events: {
        activeEvent: { id: 'client_rush', activatedAt: 0, expiresAt: Date.now() + 100_000, eventSeed: 0 },
        cooldownEnd: 0,
      },
    })
    useGameStore.getState().clearEvent()
    expect(useGameStore.getState().events.activeEvent).toBeNull()
  })

  it('sets cooldownEnd after triggering an event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)

    useGameStore.getState().triggerRandomEvent()
    const state = useGameStore.getState()

    // cooldownEnd should be at least EVENT_COOLDOWN_MS + event duration in the future
    expect(state.events.cooldownEnd).toBeGreaterThan(Date.now() + EVENT_COOLDOWN_MS)
  })
})
