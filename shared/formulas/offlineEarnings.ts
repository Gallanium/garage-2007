// shared/formulas/offlineEarnings.ts
// Extracted from utils/storageService.ts for FE+BE reuse.
import { roundCurrency } from '../utils/math.js'

/** Минимальный интервал оффлайна для начисления дохода (60 секунд) */
const MIN_OFFLINE_SECONDS = 60

/** Количество секунд в одном часе */
const SECONDS_PER_HOUR = 3600

/** Часы полной (100%) эффективности оффлайн-дохода */
const FULL_SPEED_HOURS = 8

/** Коэффициент эффективности после FULL_SPEED_HOURS */
const REDUCED_EFFICIENCY = 0.5

/**
 * Вычисляет доход, накопленный за время отсутствия игрока.
 *
 * Двухступенчатая система эффективности:
 * - 0-8 часов: 100% пассивного дохода
 * - 8-24 часа: 50% пассивного дохода
 *
 * @param passiveIncomePerSec - текущий пассивный доход (₽/сек)
 * @param elapsedSeconds      - время отсутствия в секундах
 * @param maxOfflineHours     - лимит оффлайн-начисления в часах (по умолчанию 24)
 * @returns сумма оффлайн-дохода в рублях, округлённая до 2 знаков
 */
export function calculateOfflineEarnings(
  passiveIncomePerSec: number,
  elapsedSeconds: number,
  maxOfflineHours: number = 24,
): number {
  if (passiveIncomePerSec <= 0) return 0
  if (elapsedSeconds < MIN_OFFLINE_SECONDS) return 0

  // Ограничиваем максимальным временем
  const maxSeconds = maxOfflineHours * SECONDS_PER_HOUR
  const clampedSeconds = Math.min(elapsedSeconds, maxSeconds)

  // Двухступенчатая эффективность:
  // Первые 8 часов — 100%, остальное время — 50%
  const fullSpeedSeconds = FULL_SPEED_HOURS * SECONDS_PER_HOUR
  const fullSpeedTime = Math.min(clampedSeconds, fullSpeedSeconds)
  const halfSpeedTime = Math.max(0, clampedSeconds - fullSpeedTime)

  const earnings =
    passiveIncomePerSec * fullSpeedTime +
    passiveIncomePerSec * REDUCED_EFFICIENCY * halfSpeedTime

  return roundCurrency(earnings)
}
