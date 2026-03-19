// shared/formulas/progression.ts
import { GARAGE_LEVEL_THRESHOLDS, MILESTONE_LEVELS } from '../constants/garageLevels.js'
import type { WorkerType } from '../types/game.js'

const WORKER_UNLOCK_LEVELS: Record<WorkerType, number | null> = {
  apprentice: null,
  mechanic:   5,
  master:     10,
  brigadier:  15,
  director:   20,
}

export function isWorkerUnlocked(workerType: WorkerType, purchasedMilestones: number[]): boolean {
  const required = WORKER_UNLOCK_LEVELS[workerType]
  if (required === null) return true
  return purchasedMilestones.includes(required)
}

/**
 * Автоматический левелинг гаража по балансу.
 * Останавливается перед непокупленными milestone (5/10/15/20).
 */
export function checkAutoLevel(
  balance: number,
  currentLevel: number,
  milestonesPurchased: number[],
): number {
  let level = currentLevel
  while (level < 20) {
    const next = level + 1
    const threshold = GARAGE_LEVEL_THRESHOLDS[next]
    if (threshold === undefined || balance < threshold) break
    if (
      (MILESTONE_LEVELS as readonly number[]).includes(next) &&
      !milestonesPurchased.includes(next)
    ) break
    level = next
  }
  return level
}

/** Форматирование больших чисел для UI. */
export function formatLargeNumber(num: number): string {
  if (num >= 1e15) return `${(num / 1e15).toFixed(1)}Q`
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`
  if (num >= 1e9)  return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6)  return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3)  return `${(num / 1e3).toFixed(1)}K`
  return num.toLocaleString()
}
