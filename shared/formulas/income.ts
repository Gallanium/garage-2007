// shared/formulas/income.ts
import { WORKER_INCOME, WORK_SPEED_BONUS_PER_LEVEL } from '../constants/economy.js'
import { roundCurrency } from '../utils/math.js'

/** Income(n) = n + 1 (GBD v1.1 упрощённая формула) */
export function calculateClickIncome(level: number): number {
  return level + 1
}

/** Multiplier = 1.0 + level * 0.1 */
export function calculateWorkSpeedMultiplier(level: number): number {
  return 1.0 + level * WORK_SPEED_BONUS_PER_LEVEL
}

/**
 * BasePassive = sum(count * income)
 * Total = BasePassive * WorkSpeedMultiplier
 */
export function calculateTotalPassiveIncome(
  workers: Record<string, { count: number }>,
  workSpeedLevel: number,
): number {
  let base = 0
  for (const [type, data] of Object.entries(workers)) {
    base += data.count * (WORKER_INCOME[type as keyof typeof WORKER_INCOME] ?? 0)
  }
  return roundCurrency(base * calculateWorkSpeedMultiplier(workSpeedLevel))
}
