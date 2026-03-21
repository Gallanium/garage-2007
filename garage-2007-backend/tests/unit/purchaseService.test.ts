import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStarsInvoice, processSuccessfulPayment } from '../../src/services/purchaseService'
import { AppError } from '../../src/middleware/errorHandler'
import { __mockClient } from '@prisma/client'
import { createTestGameSave, createTestDbUser, NUTS_PACKS } from '../helpers'

vi.mock('../../src/services/telegramBotService.js', () => ({
  createInvoiceLink: vi.fn().mockResolvedValue('https://t.me/$test_invoice'),
  answerPreCheckoutQuery: vi.fn().mockResolvedValue(undefined),
  refundStarPayment: vi.fn().mockResolvedValue(undefined),
}))

const prisma = __mockClient as any

describe('purchaseService', () => {
  const userId = 1

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── createStarsInvoice ──────────────────────────────────────────────────────

  describe('createStarsInvoice', () => {
    it('valid packId (nuts_100) returns invoice URL string', async () => {
      const result = await createStarsInvoice('nuts_100' as any)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).toBe('https://t.me/$test_invoice')
    })

    it('invalid packId throws AppError with INVALID_PACK code', async () => {
      await expect(
        createStarsInvoice('nonexistent_pack' as any),
      ).rejects.toThrow(AppError)

      try {
        await createStarsInvoice('nonexistent_pack' as any)
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        expect((err as AppError).code).toBe('INVALID_PACK')
      }
    })

    it('valid packId (nuts_500) returns invoice URL string', async () => {
      const result = await createStarsInvoice('nuts_500' as any)

      expect(typeof result).toBe('string')
      expect(result).toBe('https://t.me/$test_invoice')
    })
  })

  // ── processSuccessfulPayment ──────────────────────────────────────────────

  describe('processSuccessfulPayment', () => {
    const senderTgId = 123456789
    const telegramPaymentChargeId = 'charge_abc_123'

    it('credits nuts via $transaction for valid payment', async () => {
      const gameSave = createTestGameSave({ userId, nuts: 10 })
      const user = { ...createTestDbUser(), gameSave }
      const invoicePayload = JSON.stringify({ packId: 'nuts_100', idempotencyKey: 'test-uuid-1' })

      prisma.transaction.findUnique.mockResolvedValue(null) // no duplicate
      prisma.user.findUnique.mockResolvedValue(user)
      // Interactive transaction reads gameSave inside the tx callback
      prisma.gameSave.findUnique.mockResolvedValue(gameSave)

      await processSuccessfulPayment(telegramPaymentChargeId, invoicePayload, senderTgId)

      // $transaction should have been called with a function (interactive transaction)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('duplicate telegram_payment_charge_id is idempotent (no double credit)', async () => {
      const invoicePayload = JSON.stringify({ packId: 'nuts_100', idempotencyKey: 'test-uuid-1' })

      // Simulate existing transaction with same telegramPaymentChargeId
      prisma.transaction.findUnique.mockResolvedValue({
        id: 1,
        userId,
        telegramPaymentId: telegramPaymentChargeId,
        packId: 'nuts_100',
        starsAmount: 50,
        nutsAmount: 100,
        status: 'completed',
      })

      await processSuccessfulPayment(telegramPaymentChargeId, invoicePayload, senderTgId)

      // Should not call $transaction since it's a duplicate
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('does nothing if user not found', async () => {
      const invoicePayload = JSON.stringify({ packId: 'nuts_100', idempotencyKey: 'test-uuid-1' })

      prisma.transaction.findUnique.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue(null)

      await processSuccessfulPayment(telegramPaymentChargeId, invoicePayload, senderTgId)

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('does nothing for invalid payload', async () => {
      const invalidPayload = 'not-valid-json'

      await processSuccessfulPayment(telegramPaymentChargeId, invalidPayload, senderTgId)

      expect(prisma.transaction.findUnique).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
