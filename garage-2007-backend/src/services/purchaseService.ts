import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../utils/prisma.js'
import { AppError } from '../middleware/errorHandler.js'
import { createInvoiceLink, answerPreCheckoutQuery } from './telegramBotService.js'
import { logBalanceChange } from './auditService.js'
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
): Promise<void> {
  const payload = parsePayload(invoicePayload)

  if (!payload || !NUTS_PACKS[payload.packId]) {
    await answerPreCheckoutQuery(queryId, false, 'Invalid purchase data')
    return
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
    logger.error({ payloadUserId: payload.userId, actualUserId: user.id }, 'Invoice userId mismatch — possible payment fraud')
    return
  }

  const userId = user.id
  const nutsBefore = user.gameSave.nuts
  const nutsAfter = nutsBefore + pack.nuts

  // Prisma transaction: create Transaction + credit nuts + BalanceLog
  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        telegramPaymentId: telegramPaymentChargeId,
        packId: payload.packId,
        starsAmount: pack.stars,
        nutsAmount: pack.nuts,
        status: 'completed',
        idempotencyKey: payload.idempotencyKey,
      },
    }),
    prisma.gameSave.update({
      where: { userId },
      data: { nuts: { increment: pack.nuts } },
    }),
    prisma.balanceLog.create({
      data: {
        userId,
        actionType: 'stars_purchase',
        currency: 'nuts',
        amount: pack.nuts,
        balanceBefore: nutsBefore,
        balanceAfter: nutsAfter,
        metadata: { packId: payload.packId, starsAmount: pack.stars, telegramPaymentChargeId },
        idempotencyKey: payload.idempotencyKey,
      },
    }),
  ])

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
