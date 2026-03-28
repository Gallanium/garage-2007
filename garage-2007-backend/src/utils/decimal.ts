import type { Prisma } from '@prisma/client'

export function toNum(val: Prisma.Decimal | number | null): number {
  if (val === null) return 0
  if (typeof val === 'number') return val
  return val.toNumber()
}

// Decimal fields in GameSave that need conversion
const GS_DECIMAL_FIELDS = [
  'balance', 'totalEarned', 'clickPowerCost', 'workSpeedCost',
  'apprenticeCost', 'mechanicCost', 'masterCost', 'brigadierCost',
  'directorCost', 'peakClickIncome',
] as const

/** Convert all Decimal fields of a GameSave to number at the read boundary */
export function gsToNumbers<T extends Record<string, unknown>>(gs: T): T
export function gsToNumbers<T extends Record<string, unknown>>(gs: T | null): T | null
export function gsToNumbers<T extends Record<string, unknown>>(gs: T | null): T | null {
  if (!gs) return gs
  const result: Record<string, unknown> = { ...gs }
  for (const field of GS_DECIMAL_FIELDS) {
    if (field in result && result[field] != null) {
      result[field] = toNum(result[field] as Prisma.Decimal | number)
    }
  }
  return result as T
}
