import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave } from '../helpers'

const prisma = __mockClient as any

/** A valid JWT for authenticated requests. */
const validToken = signToken({ sub: 1, tgId: 123456789 })

describe('Idempotency (spec requirement #7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('same idempotencyKey sent twice -- second returns 409', async () => {
    const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000'
    const gameSave = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
    const updatedSave = { ...gameSave, balance: 9_900, clickPowerLevel: 1 }

    // First request: no existing log entry
    prisma.balanceLog.findFirst.mockResolvedValueOnce(null)
    prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave)
    prisma.gameSave.update.mockResolvedValueOnce(updatedSave)
    prisma.balanceLog.create.mockResolvedValueOnce({})

    const res1 = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
        idempotencyKey,
      })

    expect(res1.status).toBe(200)
    expect(res1.body.success).toBe(true)

    // Second request: existing log entry found (idempotency check)
    prisma.balanceLog.findFirst.mockResolvedValueOnce({ id: 1, idempotencyKey })
    prisma.gameSave.findUnique.mockResolvedValueOnce(updatedSave)

    const res2 = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
        idempotencyKey,
      })

    // The service returns 409 IDEMPOTENT_REQUEST for duplicate keys
    expect(res2.status).toBe(409)
  })

  it('different idempotencyKey for the same action -- both processed', async () => {
    const gameSave1 = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
    const gameSave2 = { ...gameSave1, balance: 9_900, clickPowerLevel: 1, clickPowerCost: 120 }

    // First request
    prisma.balanceLog.findFirst.mockResolvedValueOnce(null)
    prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave1)
    prisma.gameSave.update.mockResolvedValueOnce(gameSave2)
    prisma.balanceLog.create.mockResolvedValueOnce({})

    const res1 = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440001',
      })

    // Second request with different key
    prisma.balanceLog.findFirst.mockResolvedValueOnce(null)
    prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave2)
    prisma.gameSave.update.mockResolvedValueOnce({ ...gameSave2, balance: 9780, clickPowerLevel: 2 })
    prisma.balanceLog.create.mockResolvedValueOnce({})

    const res2 = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440002',
      })

    // Both should succeed with 200
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    // After two purchases the balance should decrease
    expect(res2.body.gameState.upgrades.clickPower.level).toBeGreaterThan(
      res1.body.gameState.upgrades.clickPower.level,
    )
  })

  it('no idempotencyKey -- action always processes (no dedup)', async () => {
    const gameSave1 = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
    const gameSave2 = { ...gameSave1, balance: 9_900, clickPowerLevel: 1, clickPowerCost: 120 }

    // First request (no idempotencyKey -> no findFirst call for dedup)
    prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave1)
    prisma.gameSave.update.mockResolvedValueOnce(gameSave2)
    prisma.balanceLog.create.mockResolvedValueOnce({})

    const res1 = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
      })

    // Second request (no idempotencyKey)
    prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave2)
    prisma.gameSave.update.mockResolvedValueOnce({ ...gameSave2, balance: 9780, clickPowerLevel: 2 })
    prisma.balanceLog.create.mockResolvedValueOnce({})

    const res2 = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
      })

    // Both succeed
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    // Balance should decrease from first to second
    expect(res2.body.gameState.balance).toBeLessThan(res1.body.gameState.balance)
  })

  it('BalanceLog has only one entry per idempotencyKey despite multiple requests', async () => {
    const idempotencyKey = '550e8400-e29b-41d4-a716-446655440003'
    const gameSave = createTestGameSave({ balance: 10_000, clickPowerLevel: 0, clickPowerCost: 100 })
    const updatedSave = { ...gameSave, balance: 9_900, clickPowerLevel: 1 }

    // First request succeeds
    prisma.balanceLog.findFirst.mockResolvedValueOnce(null)
    prisma.gameSave.findUnique.mockResolvedValueOnce(gameSave)
    prisma.gameSave.update.mockResolvedValueOnce(updatedSave)
    prisma.balanceLog.create.mockResolvedValueOnce({})

    await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
        idempotencyKey,
      })

    // Subsequent requests return 409 (idempotent)
    for (let i = 0; i < 2; i++) {
      prisma.balanceLog.findFirst.mockResolvedValueOnce({ id: 1, idempotencyKey })
      prisma.gameSave.findUnique.mockResolvedValueOnce(updatedSave)

      const res = await request(app)
        .post('/api/game/action')
        .set('Content-Type', 'application/json')
        .set(createAuthHeader(validToken))
        .send({
          type: 'purchase_upgrade',
          payload: { upgradeType: 'clickPower' },
          idempotencyKey,
        })

      expect(res.status).toBe(409)
    }

    // BalanceLog.create should only have been called once (for the first request)
    expect(prisma.balanceLog.create).toHaveBeenCalledTimes(1)
  })
})
