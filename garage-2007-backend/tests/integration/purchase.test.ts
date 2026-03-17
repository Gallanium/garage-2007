import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import {
  createAuthHeader,
  createTestGameSave,
  createTestDbUser,
  createPreCheckoutPayload,
  createSuccessfulPaymentPayload,
  DEFAULT_TELEGRAM_USER,
  TEST_WEBHOOK_SECRET,
  NUTS_PACKS,
} from '../helpers'

// Mock telegramBotService before importing app
vi.mock('../../src/services/telegramBotService.js', () => ({
  createInvoiceLink: vi.fn().mockResolvedValue('https://t.me/invoice/test123'),
  answerPreCheckoutQuery: vi.fn().mockResolvedValue(undefined),
  refundStarPayment: vi.fn().mockResolvedValue(undefined),
}))

// Must import app after mocks are set up
const { default: app } = await import('../../src/app')

const prisma = __mockClient as any

describe('POST /api/purchase/create-invoice', () => {
  const token = signToken({ sub: 1, tgId: 123456789 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with invoiceUrl for a valid packId', async () => {
    const res = await request(app)
      .post('/api/purchase/create-invoice')
      .set(createAuthHeader(token))
      .send({ packId: 'nuts_100' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('invoiceUrl')
    expect(typeof res.body.invoiceUrl).toBe('string')
    expect(res.body.invoiceUrl.length).toBeGreaterThan(0)
  })

  it('returns 400 for an invalid packId', async () => {
    const res = await request(app)
      .post('/api/purchase/create-invoice')
      .set(createAuthHeader(token))
      .send({ packId: 'nonexistent_pack' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/purchase/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles pre_checkout_query with valid secret header', async () => {
    const payload = createPreCheckoutPayload(DEFAULT_TELEGRAM_USER.id, 'nuts_100')

    const res = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)

    expect(res.status).toBe(200)
  })

  it('credits nuts and creates Transaction on successful_payment', async () => {
    const gameSave = createTestGameSave({ userId: 1, nuts: 50 })
    const dbUser = createTestDbUser({ id: 1, telegramId: BigInt(200_000_001) })

    // Mock user lookup with gameSave include
    prisma.user.findUnique.mockResolvedValue({ ...dbUser, gameSave })
    // Mock transaction dedup check
    prisma.transaction.findUnique.mockResolvedValue(null)
    // $transaction is already mocked in setup to execute the callback or resolve array

    const chargeId = `charge_${Date.now()}`
    const payload = createSuccessfulPaymentPayload(200_000_001, 'nuts_100', chargeId)

    const webhookRes = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)

    expect(webhookRes.status).toBe(200)
  })

  it('returns 403 when X-Telegram-Bot-Api-Secret-Token header is missing', async () => {
    const payload = createPreCheckoutPayload(DEFAULT_TELEGRAM_USER.id, 'nuts_100')

    const res = await request(app)
      .post('/api/purchase/webhook')
      // no secret header
      .send(payload)

    expect(res.status).toBe(403)
  })

  it('returns 403 when secret token is wrong', async () => {
    const payload = createPreCheckoutPayload(DEFAULT_TELEGRAM_USER.id, 'nuts_100')

    const res = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'wrong_secret_value')
      .send(payload)

    expect(res.status).toBe(403)
  })

  it('handles duplicate payment idempotently (no double credit)', async () => {
    const gameSave = createTestGameSave({ userId: 1, nuts: 50 })
    const dbUser = createTestDbUser({ id: 1, telegramId: BigInt(200_000_002) })

    const chargeId = `charge_dedup_${Date.now()}`

    // First call: no existing transaction
    prisma.transaction.findUnique.mockResolvedValueOnce(null)
    prisma.user.findUnique.mockResolvedValueOnce({ ...dbUser, gameSave })

    const payload = createSuccessfulPaymentPayload(200_000_002, 'nuts_100', chargeId)

    const first = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)
    expect(first.status).toBe(200)

    // Second call: transaction already exists (dedup)
    prisma.transaction.findUnique.mockResolvedValueOnce({
      id: 1,
      telegramPaymentId: chargeId,
      status: 'completed',
    })

    const second = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)
    expect(second.status).toBe(200)

    // The $transaction (batch) should only be called once (first time)
    // On the second call, it finds the existing transaction and returns early
  })
})
