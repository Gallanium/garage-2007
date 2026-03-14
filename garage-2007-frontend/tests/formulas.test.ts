import { describe, expect, it } from 'vitest'
import { calculateUpgradeCost, calculateWorkerCost } from '../src/store/formulas/costs'
import {
  calculateClickIncome,
  calculateTotalPassiveIncome,
  calculateWorkSpeedMultiplier,
} from '../src/store/formulas/income'
import {
  checkAutoLevel,
  formatLargeNumber,
  isWorkerUnlocked,
} from '../src/store/formulas/progression'
import { BASE_COSTS } from '../src/store/constants/economy'

describe('economy formulas', () => {
  it('scales upgrade and worker costs with the shared multiplier', () => {
    expect(calculateUpgradeCost(BASE_COSTS.clickUpgrade, 0)).toBe(100)
    expect(calculateUpgradeCost(BASE_COSTS.clickUpgrade, 2)).toBe(132)
    expect(calculateWorkerCost(BASE_COSTS.apprentice, 3)).toBe(760)
  })

  it('calculates click income and work speed multiplier from level', () => {
    expect(calculateClickIncome(0)).toBe(1)
    expect(calculateClickIncome(7)).toBe(8)
    expect(calculateWorkSpeedMultiplier(3)).toBeCloseTo(1.3)
  })

  it('calculates total passive income with worker counts and speed bonus', () => {
    const workers = {
      apprentice: { count: 2 },
      mechanic: { count: 1 },
      master: { count: 0 },
      brigadier: { count: 0 },
      director: { count: 0 },
    }

    expect(calculateTotalPassiveIncome(workers, 0)).toBe(24)
    expect(calculateTotalPassiveIncome(workers, 2)).toBe(28.8)
  })
})

describe('progression formulas', () => {
  it('stops auto leveling on an unpurchased milestone', () => {
    expect(checkAutoLevel(1_000_000, 1, [])).toBe(4)
    expect(checkAutoLevel(1_000_000, 1, [5])).toBe(5)
  })

  it('continues leveling after a purchased milestone until the next gate', () => {
    expect(checkAutoLevel(25_000_000, 5, [5])).toBe(7)
    expect(checkAutoLevel(25_000_000, 5, [5, 10])).toBe(7)
  })

  it('checks worker unlocks through milestone ownership', () => {
    expect(isWorkerUnlocked('apprentice', [])).toBe(true)
    expect(isWorkerUnlocked('mechanic', [])).toBe(false)
    expect(isWorkerUnlocked('mechanic', [5])).toBe(true)
    expect(isWorkerUnlocked('director', [5, 10, 15])).toBe(false)
  })

  it('formats large numbers for UI suffixes', () => {
    expect(formatLargeNumber(950)).toBe('950')
    expect(formatLargeNumber(12_500)).toBe('12.5K')
    expect(formatLargeNumber(2_500_000)).toBe('2.5M')
    expect(formatLargeNumber(3_000_000_000)).toBe('3.0B')
  })
})
