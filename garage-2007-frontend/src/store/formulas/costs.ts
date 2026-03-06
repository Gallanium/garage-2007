// src/store/formulas/costs.ts
import { COST_MULTIPLIER } from '../constants/economy'

/**
 * Cost(n) = floor(BaseCost × 1.15^n)
 */
export function calculateUpgradeCost(baseCost: number, level: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, level))
}

/**
 * Cost(n) = floor(BaseCost × 1.15^count)
 */
export function calculateWorkerCost(baseCost: number, count: number): number {
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, count))
}
