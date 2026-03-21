import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../utils/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { updateGameSaveWithLock, withOccRetry } from '../utils/occ.js'
import { createInvoiceLink, answerPreCheckoutQuery, refundStarPayment } from './telegramBotService.js'
import { logBalanceChange, logSuspiciousActivity } from './auditService.js'
import { logger } from '../utils/logger.js'
import type { NutsPackId } from '@shared/types/purchase.js'
import { NUTS_PACKS } from '@shared/constants/purchase.js'

export async function createStarsInvoice(packId: NutsPackId, userId: number): Promise<string> {
  const pack = NUTS_PACKS[packId]
  if (!pack) {
    throw new AppError(400, 'INVALID_PACK', 'Unknown nuts pack')
  }

  const idempotencyKey = uuidv4()
  const payload = JSON.stringify({ packId, idempotencyKey, userId })

  const invoiceUrl = await createInvoiceLink({
    title: pack.label,
    description: 'Гайки для Гараж 2007',
    payload,
    currency: 'XTR',
    prices: [{ label: pack.label, amount: pack.stars }],
  })

  return invoiceUrl
}

interface InvoicePayload {
  packId: NutsPackId
  idempotencyKey: string
  userId?: number
}

function parsePayload(payloadStr: string): InvoicePayload | null {
  try {
    const parsed = JSON.parse(payloadStr) as InvoicePayload
    if (!parsed.packId || !parsed.idempotencyKey) return null
    return parsed
  } catch {
    return null
  }
}

export async function handlePreCheckoutQuery(
  queryId: string,
  invoicePayload: string,
  senderTgId: number,
  totalAmount?: number,
  currency?: string,
): Promise<void> {
  const payload = parsePayload(invoicePayload)

  if (!payload || !NUTS_PACKS[payload.packId]) {
    await answerPreCheckoutQuery(queryId, false, 'Invalid purchase data')
    return
  }

  const pack = NUTS_PACKS[payload.packId]

  // Validate currency is Telegram Stars
  if (currency !== undefined && currency !== 'XTR') {
    logger.warn({ queryId, currency }, 'Pre-checkout: unexpected currency')
    await answerPreCheckoutQuery(queryId, false, 'Invalid currency')
    return
  }

  // Validate total_amount matches expected pack price
  if (totalAmount !== undefined && totalAmount !== pack.stars) {
    logger.warn({ queryId, totalAmount, expectedStars: pack.stars }, 'Pre-checkout: amount mismatch')
    await answerPreCheckoutQuery(queryId, false, 'Amount mismatch')
    return
  }

  // Verify sender matches invoice owner
  if (payload.userId !== undefined) {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(senderTgId) },
      select: { id: true },
    })

    if (!user || user.id !== payload.userId) {
      logger.warn({ queryId, senderTgId, payloadUserId: payload.userId }, 'Pre-checkout: payment user mismatch')
      await answerPreCheckoutQuery(queryId, false, 'Payment user mismatch')
      return
    }
  }

  // Respond within 10 seconds
  await answerPreCheckoutQuery(queryId, true)
}

export async function processSuccessfulPayment(
  telegramPaymentChargeId: string,
  invoicePayload: string,
  senderTgId: number,
): Promise<void> {
  const payload = parsePayload(invoicePayload)
  if (!payload) {
    logger.error({ invoicePayload }, 'Invalid invoice payload in successful_payment')
    return
  }

  const pack = NUTS_PACKS[payload.packId]
  if (!pack) {
    logger.error({ packId: payload.packId }, 'Unknown pack in successful_payment')
    return
  }

  // Deduplicate by telegram_payment_charge_id
  const existing = await prisma.transaction.findUnique({
    where: { telegramPaymentId: telegramPaymentChargeId },
  })
  if (existing) {
    logger.warn({ telegramPaymentChargeId }, 'Duplicate payment — already processed')
    return
  }

  // Find user by telegram ID
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(senderTgId) },
    include: { gameSave: true },
  })

  if (!user || !user.gameSave) {
    logger.error({ senderTgId }, 'User or game save not found for payment')
    return
  }

  // Cross-check: invoice was created for this user
  if (payload.userId !== undefined && payload.userId !== user.id) {
    logger.error({ payloadUserId: payload.userId, actualUserId: user.id, senderTgId, chargeId: telegramPaymentChargeId }, 'Invoice userId mismatch — initiating refund')
    logSuspiciousActivity({
      userId: user.id,
      reason: 'payment_user_mismatch',
      details: { payloadUserId: payload.userId, actualUserId: user.id, senderTgId, telegramPaymentChargeId },
    })
    try {
      await refundStarPayment(senderTgId, telegramPaymentChargeId)
      logger.info({ senderTgId, telegramPaymentChargeId }, 'Refund issued for userId mismatch')
    } catch (refundErr) {
      logger.error({ senderTgId, telegramPaymentChargeId, error: refundErr }, 'Failed to issue refund for userId mismatch')
    }
    return
  }

  const userId = user.id

  // Interactive transaction with OCC: read fresh gameSave, version-check the update
  const { nutsBefore, nutsAfter } = await withOccRetry(() => prisma.$transaction(async (tx) => {
    const gs = await tx.gameSave.findUnique({ where: { userId } })
    if (!gs) throw new AppError(404, 'NOT_FOUND', 'Game save not found')

    const before = gs.nuts
    const after = before + pack.nuts

    await tx.transaction.create({
      data: {
        userId,
        telegramPaymentId: telegramPaymentChargeId,
        packId: payload.packId,
        starsAmount: pack.stars,
        nutsAmount: pack.nuts,
        status: 'completed',
        idempotencyKey: payload.idempotencyKey,
      },
    })

    await updateGameSaveWithLock(tx, userId, gs, { nuts: after })

    await tx.balanceLog.create({
      data: {
        userId,
        actionType: 'stars_purchase',
        currency: 'nuts',
        amount: pack.nuts,
        balanceBefore: before,
        balanceAfter: after,
        metadata: { packId: payload.packId, starsAmount: pack.stars, telegramPaymentChargeId },
        idempotencyKey: payload.idempotencyKey,
      },
    })

    return { nutsBefore: before, nutsAfter: after }
  }))

  logBalanceChange({
    userId,
    actionType: 'stars_purchase',
    currency: 'nuts',
    amount: pack.nuts,
    balanceBefore: nutsBefore,
    balanceAfter: nutsAfter,
    metadata: { packId: payload.packId, starsAmount: pack.stars },
  })

  logger.info({ userId, packId: payload.packId, nuts: pack.nuts }, 'Stars purchase completed')
}
