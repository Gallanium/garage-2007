import { auditLogger } from '../utils/logger.js'

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
