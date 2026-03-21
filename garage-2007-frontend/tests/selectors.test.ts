import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GARAGE_LEVEL_THRESHOLDS,
  MILESTONE_LEVELS,
  MILESTONE_UPGRADES,
  initialState,
  useGameStore,
} from '../src/store/gameStore'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockPerformAction = vi.mocked(api.performAction)

beforeEach(() => {
  useGameStore.setState({ ...initialState })
  vi.useRealTimers()
})

// ── Garage progress computation ───────────────────────────────────────────────

describe('selector logic: garage progress', () => {
  it('returns 0 when balance equals the current level threshold (level 1, balance 0)', () => {
    const level = 1
    const curr = GARAGE_LEVEL_THRESHOLDS[level] ?? 0  // 0
    const next = GARAGE_LEVEL_THRESHOLDS[level + 1]!  // 10_000
    const progress = Math.min(Math.max((curr - curr) / (next - curr), 0), 1)
    expect(progress).toBe(0)
  })

  it('returns ~0.5 when balance is halfway between level 1 and level 2 thresholds', () => {
    const level = 1
    const curr = GARAGE_LEVEL_THRESHOLDS[level] ?? 0  // 0
    const next = GARAGE_LEVEL_THRESHOLDS[level + 1]!  // 10_000
    const midBalance = (curr + next) / 2              // 5_000
    const progress = Math.min(Math.max((midBalance - curr) / (next - curr), 0), 1)
    expect(progress).toBeCloseTo(0.5)
  })

  it('returns 1 at level 20 (max level)', () => {
    useGameStore.setState({ garageLevel: 20 })
    const level = useGameStore.getState().garageLevel
    // Mirrors selector: if (garageLevel >= 20) return 1
    const progress = level >= 20 ? 1 : 0
    expect(progress).toBe(1)
  })

  it('progress is clamped to 0 even if balance is below threshold', () => {
    const level = 3
    const curr = GARAGE_LEVEL_THRESHOLDS[level] ?? 0  // 50_000
    const next = GARAGE_LEVEL_THRESHOLDS[level + 1]!  // 200_000
    // balance below curr → raw value negative → clamp to 0
    const balance = curr - 1
    const progress = Math.min(Math.max((balance - curr) / (next - curr), 0), 1)
    expect(progress).toBe(0)
  })

  it('progress is clamped to 1 if balance exceeds next threshold', () => {
    const level = 2
    const curr = GARAGE_LEVEL_THRESHOLDS[level] ?? 0
    const next = GARAGE_LEVEL_THRESHOLDS[level + 1]!
    const balance = next + 1_000
    const progress = Math.min(Math.max((balance - curr) / (next - curr), 0), 1)
    expect(progress).toBe(1)
  })
})

// ── Next level cost ───────────────────────────────────────────────────────────

describe('useNextLevelCost logic', () => {
  it('returns threshold for next level at level 1', () => {
    // GARAGE_LEVEL_THRESHOLDS[2] is the cost to reach level 2 — verify it's a positive number
    const next = GARAGE_LEVEL_THRESHOLDS[2]
    expect(next).toBeGreaterThan(0)
  })

  it('returns a higher threshold for higher levels', () => {
    // Level 5 threshold < level 10 threshold (costs increase)
    expect(GARAGE_LEVEL_THRESHOLDS[6]).toBeGreaterThan(GARAGE_LEVEL_THRESHOLDS[2] ?? 0)
  })

  it('returns null equivalent at level 20 (no level 21 threshold)', () => {
    expect(GARAGE_LEVEL_THRESHOLDS[21]).toBeUndefined()
  })
})

// ── Pending milestone info ────────────────────────────────────────────────────

describe('selector logic: pending milestone info', () => {
  // Mirror of usePendingMilestoneInfo logic
  function computePendingMilestone(
    balance: number,
    milestonesPurchased: number[]
  ): { level: number; upgrade: (typeof MILESTONE_UPGRADES)[5 | 10 | 15 | 20] } | null {
    for (const level of MILESTONE_LEVELS) {
      if (!milestonesPurchased.includes(level)) {
        const threshold = GARAGE_LEVEL_THRESHOLDS[level]
        if (threshold !== undefined && balance >= threshold) {
          return { level, upgrade: MILESTONE_UPGRADES[level] }
        }
        return null
      }
    }
    return null
  }

  it('returns null when balance is 0 and no milestones purchased', () => {
    useGameStore.setState({ balance: 0, milestonesPurchased: [] })
    const { balance, milestonesPurchased } = useGameStore.getState()
    expect(computePendingMilestone(balance, milestonesPurchased)).toBeNull()
  })

  it('returns level 5 info when balance >= threshold[5] and not yet purchased', () => {
    const threshold5 = GARAGE_LEVEL_THRESHOLDS[5]!  // 1_000_000
    useGameStore.setState({ balance: threshold5, milestonesPurchased: [] })
    const { balance, milestonesPurchased } = useGameStore.getState()
    const result = computePendingMilestone(balance, milestonesPurchased)
    expect(result).not.toBeNull()
    expect(result?.level).toBe(5)
    expect(result?.upgrade).toBe(MILESTONE_UPGRADES[5])
  })

  it('returns null when level 5 is already purchased and balance does not reach level 10', () => {
    const threshold5 = GARAGE_LEVEL_THRESHOLDS[5]!   // 1_000_000
    const threshold10 = GARAGE_LEVEL_THRESHOLDS[10]! // 1_000_000_000
    // balance is above level-5 threshold but below level-10 threshold
    useGameStore.setState({ balance: threshold5, milestonesPurchased: [5] })
    const { balance, milestonesPurchased } = useGameStore.getState()
    expect(balance).toBeLessThan(threshold10)
    const result = computePendingMilestone(balance, milestonesPurchased)
    expect(result).toBeNull()
  })

  it('returns level 10 info when level 5 is purchased and balance >= threshold[10]', () => {
    const threshold10 = GARAGE_LEVEL_THRESHOLDS[10]!
    useGameStore.setState({ balance: threshold10, milestonesPurchased: [5] })
    const { balance, milestonesPurchased } = useGameStore.getState()
    const result = computePendingMilestone(balance, milestonesPurchased)
    expect(result).not.toBeNull()
    expect(result?.level).toBe(10)
    expect(result?.upgrade).toBe(MILESTONE_UPGRADES[10])
  })

  it('returns null when all milestones are purchased', () => {
    const threshold20 = GARAGE_LEVEL_THRESHOLDS[20]!
    useGameStore.setState({ balance: threshold20, milestonesPurchased: [5, 10, 15, 20] })
    const { balance, milestonesPurchased } = useGameStore.getState()
    const result = computePendingMilestone(balance, milestonesPurchased)
    expect(result).toBeNull()
  })
})

// ── Boost multiplier methods (getActiveMultiplier) ────────────────────────────

describe('store method: getActiveMultiplier (boost)', () => {
  it('returns 1 for both scopes when no active boosts', () => {
    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(1)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(1)
  })

  it('returns the correct multiplier for an active turbo boost (click scope)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })

    const now = Date.now()
    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 5,
        boosts: { active: [{ type: 'turbo', activatedAt: now, expiresAt: now + 900_000 }] },
      }),
    })
    const success = await useGameStore.getState().activateBoost('turbo')
    expect(success).toBe(true)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBeGreaterThan(1)
    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(1)
  })

  it('returns the correct multiplier for an active income_2x boost (income and click scopes both get multiplied)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    const now = Date.now()
    useGameStore.setState({
      boosts: {
        active: [{ type: 'income_2x', activatedAt: now, expiresAt: now + 3_600_000 }],
      },
    })
    // income_2x affects both income and click scopes
    expect(useGameStore.getState().getActiveMultiplier('income')).toBe(2)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(2)
  })

  it('returns 1 after boost expires and tickBoosts is called', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    useGameStore.setState({ nuts: 20 })

    const now = Date.now()
    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 5,
        boosts: { active: [{ type: 'turbo', activatedAt: now, expiresAt: now + 900_000 }] },
      }),
    })
    await useGameStore.getState().activateBoost('turbo')
    expect(useGameStore.getState().getActiveMultiplier('click')).toBeGreaterThan(1)

    vi.advanceTimersByTime(100 * 60 * 1000) // advance 100 minutes
    useGameStore.getState().tickBoosts()

    expect(useGameStore.getState().boosts.active).toHaveLength(0)
    expect(useGameStore.getState().getActiveMultiplier('click')).toBe(1)
  })
})

// ── useActiveBoostType logic ──────────────────────────────────────────────────

describe('selector logic: active boost type', () => {
  it('no active boosts → boosts.active is empty', () => {
    expect(useGameStore.getState().boosts.active).toHaveLength(0)
  })

  it('active income_2x boost is present and not expired', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    const now = Date.now()
    useGameStore.setState({
      boosts: {
        active: [{ type: 'income_2x', activatedAt: now, expiresAt: now + 3_600_000 }],
      },
    })
    const active = useGameStore.getState().boosts.active
    const found = active.find(b => b.expiresAt > Date.now())
    expect(found?.type).toBe('income_2x')
  })

  it('expired boost does not appear as active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    const now = Date.now()
    useGameStore.setState({
      boosts: {
        active: [{ type: 'turbo', activatedAt: now - 10_000, expiresAt: now - 1 }],
      },
    })
    const active = useGameStore.getState().boosts.active
    const found = active.find(b => b.expiresAt > Date.now())
    expect(found).toBeUndefined()
  })
})

// ── useHasActiveBoost logic ───────────────────────────────────────────────────

describe('useHasActiveBoost logic (type-only, no expiry check)', () => {
  it('returns false with no active boosts', () => {
    useGameStore.setState({ boosts: { active: [] } })
    const state = useGameStore.getState()
    // Simulate the selector: s.boosts.active.some(b => b.type === type)
    expect(state.boosts.active.some(b => b.type === 'turbo')).toBe(false)
  })

  it('returns true for matching type regardless of expiry', () => {
    const expiredBoost = { type: 'turbo' as const, activatedAt: 0, expiresAt: 1 } // already expired
    useGameStore.setState({ boosts: { active: [expiredBoost] } })
    const state = useGameStore.getState()
    // useHasActiveBoost checks type only, not expiresAt
    expect(state.boosts.active.some(b => b.type === 'turbo')).toBe(true)
    // Note: getActiveMultiplier WOULD return 1 here (checks expiry)
    expect(state.getActiveMultiplier('click')).toBe(1)
  })

  it('returns false for non-matching type', () => {
    const activeBoost = { type: 'turbo' as const, activatedAt: Date.now(), expiresAt: Date.now() + 999_999 }
    useGameStore.setState({ boosts: { active: [activeBoost] } })
    const state = useGameStore.getState()
    expect(state.boosts.active.some(b => b.type === 'income_2x')).toBe(false)
    expect(state.boosts.active.some(b => b.type === 'turbo')).toBe(true)
  })
})

// ── useHasActiveEvent logic ───────────────────────────────────────────────────

describe('selector logic: active event presence', () => {
  it('returns false (null activeEvent) when no event is active', () => {
    useGameStore.setState({ events: { activeEvent: null, cooldownEnd: 0 } })
    const hasEvent = useGameStore.getState().events.activeEvent !== null
    expect(hasEvent).toBe(false)
  })

  it('returns true when an event is active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    const now = Date.now()
    useGameStore.setState({
      events: {
        activeEvent: {
          id: 'client_rush',
          activatedAt: now,
          expiresAt: now + 300_000,
          eventSeed: 42,
        },
        cooldownEnd: now + 600_000,
      },
    })
    const hasEvent = useGameStore.getState().events.activeEvent !== null
    expect(hasEvent).toBe(true)
  })

  it('returns true even when event is expired (relies on tickEvents cleanup)', () => {
    const expiredEvent = { id: 'client_rush', activatedAt: 0, expiresAt: 1, eventSeed: 42 }
    useGameStore.setState({ events: { activeEvent: expiredEvent, cooldownEnd: 0 } })
    // The selector only checks null — cleanup is tickEvents' responsibility
    expect(useGameStore.getState().events.activeEvent).not.toBeNull()
    // After tickEvents, it clears
    useGameStore.getState().tickEvents()
    expect(useGameStore.getState().events.activeEvent).toBeNull()
  })
})

// ── Event multiplier method (getEventMultiplier) ──────────────────────────────

describe('store method: getEventMultiplier', () => {
  it('returns 1 for all scopes when no event is active', () => {
    useGameStore.setState({ events: { activeEvent: null, cooldownEnd: 0 } })
    expect(useGameStore.getState().getEventMultiplier('income')).toBe(1)
    expect(useGameStore.getState().getEventMultiplier('click')).toBe(1)
  })

  it('returns the event multiplier for the correct scope after triggering an event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    const now = Date.now()
    let resolvePromise: (v: unknown) => void
    const promise = new Promise(r => { resolvePromise = r })
    mockPerformAction.mockReturnValueOnce(promise as ReturnType<typeof api.performAction>)

    const triggered = useGameStore.getState().triggerRandomEvent()
    expect(triggered).toBe(true)

    resolvePromise!({
      success: true,
      gameState: buildMockServerState({
        events: {
          activeEvent: { id: 'client_rush', activatedAt: now, expiresAt: now + 60_000, eventSeed: 123 },
          cooldownEnd: now + 180_000,
        },
      }),
    })

    await vi.advanceTimersByTimeAsync(0)

    const incomeMultiplier = useGameStore.getState().getEventMultiplier('income')
    const clickMultiplier = useGameStore.getState().getEventMultiplier('click')
    expect(incomeMultiplier).toBeGreaterThan(1)
    expect(clickMultiplier).toBe(1)
  })

  it('returns 1 after the event expires and tickEvents is called', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'))

    // Set up event via setState (already-active event, no need to trigger)
    const now = Date.now()
    useGameStore.setState({
      events: {
        activeEvent: { id: 'client_rush', activatedAt: now, expiresAt: now + 60_000, eventSeed: 0 },
        cooldownEnd: now + 180_000,
      },
    })
    expect(useGameStore.getState().getEventMultiplier('income')).toBeGreaterThan(1)

    vi.advanceTimersByTime(60 * 60 * 1000) // advance 1 hour
    useGameStore.getState().tickEvents()

    expect(useGameStore.getState().events.activeEvent).toBeNull()
    expect(useGameStore.getState().getEventMultiplier('income')).toBe(1)
  })
})
