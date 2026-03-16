// These tests are written against the backend spec (docs/BACKEND_MVP.md).
// They will fail until the corresponding backend code is implemented.
// Run: npm test

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../src/index'
import {
  createValidInitData,
  createTelegramUser,
  DEFAULT_TELEGRAM_USER,
  createAuthHeader,
  createPreCheckoutPayload,
  createSuccessfulPaymentPayload,
  TEST_BOT_TOKEN,
  TEST_WEBHOOK_SECRET,
  NUTS_PACKS,
} from '../helpers'

/**
 * Helper: authenticate a user and return the JWT token.
 */
async function authenticateUser(
  user = DEFAULT_TELEGRAM_USER,
): Promise<string> {
  const initData = createValidInitData(user, TEST_BOT_TOKEN)
  const res = await request(app)
    .post('/api/auth/telegram')
    .send({ initData })
  return res.body.token
}

/**
 * Helper: ensure game state exists for user by syncing.
 */
async function ensureGameState(token: string) {
  await request(app)
    .post('/api/game/sync')
    .set(createAuthHeader(token))
    .send({ clicksSinceLastSync: 0, clientTimestamp: Date.now() })
}

describe('POST /api/purchase/create-invoice', () => {
  let token: string

  beforeAll(async () => {
    token = await authenticateUser()
    await ensureGameState(token)
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
  it('handles pre_checkout_query with valid secret header', async () => {
    const payload = createPreCheckoutPayload(DEFAULT_TELEGRAM_USER.id, 'nuts_100')

    const res = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)

    expect(res.status).toBe(200)
  })

  it('credits nuts and creates Transaction on successful_payment', async () => {
    // Ensure the user exists and has a GameSave
    const user = createTelegramUser({ id: 200_000_001, first_name: 'Buyer' })
    const buyerToken = await authenticateUser(user)
    await ensureGameState(buyerToken)

    // Get nuts before payment
    const stateBefore = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(buyerToken))
    const nutsBefore = stateBefore.body.gameState?.nuts ?? 0

    // Send successful_payment webhook
    const chargeId = `charge_${Date.now()}`
    const payload = createSuccessfulPaymentPayload(user.id, 'nuts_100', chargeId)

    const webhookRes = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)

    expect(webhookRes.status).toBe(200)

    // Verify nuts were credited
    const stateAfter = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(buyerToken))

    const nutsAfter = stateAfter.body.gameState?.nuts ?? 0
    expect(nutsAfter).toBe(nutsBefore + NUTS_PACKS.nuts_100.nuts)
  })

  it('returns 401 when X-Telegram-Bot-Api-Secret-Token header is missing', async () => {
    const payload = createPreCheckoutPayload(DEFAULT_TELEGRAM_USER.id, 'nuts_100')

    const res = await request(app)
      .post('/api/purchase/webhook')
      // no secret header
      .send(payload)

    expect(res.status).toBe(401)
  })

  it('returns 401 when secret token is wrong', async () => {
    const payload = createPreCheckoutPayload(DEFAULT_TELEGRAM_USER.id, 'nuts_100')

    const res = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', 'wrong_secret_value')
      .send(payload)

    expect(res.status).toBe(401)
  })

  it('handles duplicate payment idempotently (no double credit)', async () => {
    const user = createTelegramUser({ id: 200_000_002, first_name: 'DoublePayer' })
    const payerToken = await authenticateUser(user)
    await ensureGameState(payerToken)

    const chargeId = `charge_dedup_${Date.now()}`
    const payload = createSuccessfulPaymentPayload(user.id, 'nuts_100', chargeId)

    // First webhook call
    const first = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)
    expect(first.status).toBe(200)

    // Get nuts after first payment
    const stateAfterFirst = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(payerToken))
    const nutsAfterFirst = stateAfterFirst.body.gameState?.nuts ?? 0

    // Second webhook call with same charge ID (duplicate)
    const second = await request(app)
      .post('/api/purchase/webhook')
      .set('X-Telegram-Bot-Api-Secret-Token', TEST_WEBHOOK_SECRET)
      .send(payload)
    expect(second.status).toBe(200)

    // Nuts should NOT increase again
    const stateAfterSecond = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(payerToken))
    const nutsAfterSecond = stateAfterSecond.body.gameState?.nuts ?? 0

    expect(nutsAfterSecond).toBe(nutsAfterFirst)
  })
})
