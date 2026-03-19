import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave } from '../helpers'

const prisma = __mockClient as any

/** A valid JWT for authenticated requests. */
const validToken = signToken({ sub: 1, tgId: 123456789 })

describe('Anti-cheat measures (spec section 6.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.balanceLog.findFirst.mockResolvedValue(null)
  })

  it('caps clicks when rate exceeds 20/sec', async () => {
    // Player claims 500 clicks but only 5 seconds have elapsed since last sync.
    // Server max = 20 clicks/sec * 5 sec = 100 clicks.
    const gameSave = createTestGameSave({
      lastSyncAt: new Date(Date.now() - 5_000),
      totalClicks: 0,
      balance: 10_000,
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockImplementation(async (args: any) => {
      return { ...gameSave, ...args.data }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 500,
        clientTimestamp: Date.now(),
        syncNonce: crypto.randomUUID(),
      })

    expect(res.status).toBe(200)
    // With 5 seconds elapsed and max 20 clicks/sec, totalClicks should be <= 100
    expect(res.body.gameState.totalClicks).toBeLessThanOrEqual(100)
    expect(res.body).toBeDefined()
  })

  it('rejects negative clicksSinceLastSync with 400', async () => {
    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: -10,
        clientTimestamp: Date.now(),
        syncNonce: crypto.randomUUID(),
      })

    expect(res.status).toBe(400)
  })

  it('rejects fractional clicksSinceLastSync with 400', async () => {
    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 10.5,
        clientTimestamp: Date.now(),
        syncNonce: crypto.randomUUID(),
      })

    expect(res.status).toBe(400)
  })

  it('uses server time for income computation (ignores far-future clientTimestamp)', async () => {
    // Send a clientTimestamp 1 hour in the future.
    const gameSave = createTestGameSave({
      lastSyncAt: new Date(Date.now() - 5_000),
      balance: 10_000,
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockImplementation(async (args: any) => {
      return { ...gameSave, ...args.data }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const oneHourFuture = Date.now() + 3_600_000

    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 5,
        clientTimestamp: oneHourFuture,
        syncNonce: crypto.randomUUID(),
      })

    expect(res.status).toBe(200)
    // Balance should not be absurdly inflated. The server uses lastSyncAt (5s ago),
    // not the far-future clientTimestamp.
    expect(res.body.gameState.balance).toBeLessThan(100_000)
  })
})
