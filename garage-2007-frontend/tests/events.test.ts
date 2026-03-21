import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GAME_EVENTS,
  initialState,
  useGameStore,
} from '../src/store/gameStore'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockPerformAction = vi.mocked(api.performAction)

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

  it('triggers an event via server and applies server response', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const now = Date.now()
    let resolvePromise: (v: unknown) => void
    const promise = new Promise(r => { resolvePromise = r })
    mockPerformAction.mockReturnValueOnce(promise as ReturnType<typeof api.performAction>)

    const result = useGameStore.getState().triggerRandomEvent()
    expect(result).toBe(true)

    resolvePromise!({
      success: true,
      gameState: buildMockServerState({
        events: {
          activeEvent: { id: 'client_rush', activatedAt: now, expiresAt: now + 60_000, eventSeed: 123 },
          cooldownEnd: now + 120_000,
        },
      }),
    })

    await vi.advanceTimersByTimeAsync(0)

    const state = useGameStore.getState()
    expect(state.events.activeEvent).not.toBeNull()
    expect(state.events.activeEvent?.id).toBe('client_rush')
    expect(state.events.cooldownEnd).toBeGreaterThan(now)
  })

  it('getEventMultiplier returns correct multiplier for server-provided event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const now = Date.now()
    let resolvePromise: (v: unknown) => void
    const promise = new Promise(r => { resolvePromise = r })
    mockPerformAction.mockReturnValueOnce(promise as ReturnType<typeof api.performAction>)

    useGameStore.getState().triggerRandomEvent()

    resolvePromise!({
      success: true,
      gameState: buildMockServerState({
        events: {
          activeEvent: { id: 'client_rush', activatedAt: now, expiresAt: now + 60_000, eventSeed: 123 },
          cooldownEnd: now + 120_000,
        },
      }),
    })

    await vi.advanceTimersByTimeAsync(0)

    const state = useGameStore.getState()
    expect(state.events.activeEvent?.id).toBe('client_rush')
    expect(state.getEventMultiplier('income')).toBe(GAME_EVENTS.client_rush.effect.multiplier)
    expect(state.getEventMultiplier('click')).toBe(1)
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

    vi.advanceTimersByTime(200)
    useGameStore.getState().tickEvents()

    expect(useGameStore.getState().events.activeEvent).toBeNull()
  })

  it('does not clear an event that has not expired', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const expiresAt = Date.now() + 100_000
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
    expect(useGameStore.getState().getEventMultiplier('income')).toBe(1)
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

  it('sets cooldownEnd after server response', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const now = Date.now()
    let resolvePromise: (v: unknown) => void
    const promise = new Promise(r => { resolvePromise = r })
    mockPerformAction.mockReturnValueOnce(promise as ReturnType<typeof api.performAction>)

    useGameStore.getState().triggerRandomEvent()

    resolvePromise!({
      success: true,
      gameState: buildMockServerState({
        events: {
          activeEvent: { id: 'client_rush', activatedAt: now, expiresAt: now + 60_000, eventSeed: 0 },
          cooldownEnd: now + 180_000,
        },
      }),
    })

    await vi.advanceTimersByTimeAsync(0)

    const state = useGameStore.getState()
    expect(state.events.cooldownEnd).toBeGreaterThan(now)
  })
})
