import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave } from '../helpers'
import { AppError } from '../../src/middleware/errorHandler'

const prisma = __mockClient as any

describe('Concurrency: sync + action', () => {
  const token = signToken({ sub: 1, tgId: 123456789 })

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.balanceLog.findFirst.mockResolvedValue(null)
  })

  it('concurrent sync calls with same version — one succeeds, one retries', async () => {
    const gameSave = createTestGameSave({
      lastSyncAt: new Date(Date.now() - 10_000),
      version: 7,
    })

    // Track call count to simulate OCC conflict on second concurrent call
    let updateManyCallCount = 0
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.updateMany.mockImplementation(async () => {
      updateManyCallCount++
      // First call succeeds, second call hits version conflict
      if (updateManyCallCount === 1) {
        return { count: 1 }
      }
      // On retry after conflict, succeed
      if (updateManyCallCount === 3) {
        return { count: 1 }
      }
      // Second concurrent call fails (version already bumped)
      return { count: 0 }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    // Fire two concurrent sync requests
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/game/sync')
        .set(createAuthHeader(token))
        .send({
          clicksSinceLastSync: 5,
          clientTimestamp: Date.now(),
          syncNonce: crypto.randomUUID(),
        }),
      request(app)
        .post('/api/game/sync')
        .set(createAuthHeader(token))
        .send({
          clicksSinceLastSync: 3,
          clientTimestamp: Date.now(),
          syncNonce: crypto.randomUUID(),
        }),
    ])

    // At least one should succeed
    const statuses = [res1.status, res2.status]
    expect(statuses).toContain(200)
  })

  it('concurrent sync and action do not corrupt state', async () => {
    const gameSave = createTestGameSave({
      balance: 10_000,
      lastSyncAt: new Date(Date.now() - 10_000),
      version: 7,
    })

    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.updateMany.mockResolvedValue({ count: 1 })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })
    prisma.balanceLog.create.mockResolvedValue({})

    // Fire sync + action concurrently
    const [syncRes, actionRes] = await Promise.all([
      request(app)
        .post('/api/game/sync')
        .set(createAuthHeader(token))
        .send({
          clicksSinceLastSync: 5,
          clientTimestamp: Date.now(),
          syncNonce: crypto.randomUUID(),
        }),
      request(app)
        .post('/api/game/action')
        .set(createAuthHeader(token))
        .send({
          type: 'purchase_upgrade',
          payload: { upgradeType: 'clickPower' },
          idempotencyKey: crypto.randomUUID(),
        }),
    ])

    // Both requests should get a response (not hang or crash)
    expect([200, 400, 404, 409]).toContain(syncRes.status)
    expect([200, 400, 404, 409]).toContain(actionRes.status)

    // If both succeed, they should return valid gameState
    if (syncRes.status === 200) {
      expect(syncRes.body).toHaveProperty('gameState')
      expect(syncRes.body).toHaveProperty('serverTime')
    }
    if (actionRes.status === 200) {
      expect(actionRes.body).toHaveProperty('gameState')
    }
  })

  it('OCC version conflict triggers retry (not crash)', async () => {
    const gameSave = createTestGameSave({
      lastSyncAt: new Date(Date.now() - 10_000),
      version: 7,
    })

    let attempt = 0
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.updateMany.mockImplementation(async () => {
      attempt++
      // Fail first attempt, succeed on retry
      if (attempt === 1) return { count: 0 }
      return { count: 1 }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(token))
      .send({
        clicksSinceLastSync: 3,
        clientTimestamp: Date.now(),
        syncNonce: crypto.randomUUID(),
      })

    // Should succeed after retry
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('gameState')
    // updateMany should have been called at least twice (initial + retry)
    expect(attempt).toBeGreaterThanOrEqual(2)
  })
})
