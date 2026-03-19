import { auditLogger } from '../utils/logger.js'

// ── Core audit functions ────────────────────────────────────────────────────

export function logBalanceChange(params: {
  userId: number
  actionType: string
  currency: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  metadata?: Record<string, unknown>
}): void {
  auditLogger.info({
    event: 'balance_change',
    ...params,
  })
}

export function logSuspiciousActivity(params: {
  userId: number
  reason: string
  details?: Record<string, unknown>
}): void {
  auditLogger.warn({
    event: 'suspicious_activity',
    ...params,
  })
}

// ── Anti-cheat detection ────────────────────────────────────────────────────

/** Alert if balance increases > 10x in a single operation */
export function detectBalanceJump(
  userId: number,
  balanceBefore: number,
  balanceAfter: number,
): void {
  // Only check meaningful balances (avoid division by zero / tiny values)
  if (balanceBefore <= 0 || balanceAfter <= balanceBefore) return

  const ratio = balanceAfter / balanceBefore
  if (ratio > 10) {
    logSuspiciousActivity({
      userId,
      reason: 'balance_jump_10x',
      details: { balanceBefore, balanceAfter, ratio: Math.round(ratio * 100) / 100 },
    })
  }
}

/** Alert if sync happens too frequently (< 5 seconds since last) */
export function detectRapidSync(
  userId: number,
  lastSyncAt: Date,
): void {
  const secondsSinceLastSync = (Date.now() - lastSyncAt.getTime()) / 1000
  if (secondsSinceLastSync < 5) {
    logSuspiciousActivity({
      userId,
      reason: 'rapid_sync',
      details: { secondsSinceLastSync: Math.round(secondsSinceLastSync * 10) / 10 },
    })
  }
}

/** Alert if client timestamp is > 5 minutes in the future */
export function detectTimingAnomaly(
  userId: number,
  clientTimestamp: number,
): void {
  const drift = clientTimestamp - Date.now()
  if (drift > 5 * 60 * 1000) {
    logSuspiciousActivity({
      userId,
      reason: 'future_client_timestamp',
      details: { clientTimestamp, drift: Math.round(drift / 1000) },
    })
  }
}
