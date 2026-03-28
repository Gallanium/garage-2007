import { auditLogger } from '../utils/logger.js'
import { getRequestId } from '../utils/requestContext.js'
import { AppError } from '../middleware/errorHandler.js'

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
    requestId: getRequestId(),
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
    requestId: getRequestId(),
    ...params,
  })
}

// ── Anti-cheat detection ────────────────────────────────────────────────────

/** Alert or block if balance increases suspiciously in a single operation */
export function detectBalanceJump(
  userId: number,
  balanceBefore: number,
  balanceAfter: number,
): void {
  // Ignore small starting balances (new players) and zero/decreasing
  if (balanceBefore < 100 || balanceAfter <= balanceBefore) return

  const ratio = balanceAfter / balanceBefore

  // Hard block: 100x+ jump = exploitation
  if (ratio > 100) {
    logSuspiciousActivity({
      userId,
      reason: 'balance_jump_blocked',
      details: { balanceBefore, balanceAfter, ratio: Math.round(ratio * 100) / 100 },
    })
    throw new AppError(400, 'SUSPICIOUS_ACTIVITY', 'Suspicious balance change detected')
  }

  // Soft warning: 10x+ logged for review
  if (ratio > 10) {
    logSuspiciousActivity({
      userId,
      reason: 'balance_jump_warning',
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
