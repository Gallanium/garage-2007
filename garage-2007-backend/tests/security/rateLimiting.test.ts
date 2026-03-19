import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave, createTestDbUser } from '../helpers'

const prisma = __mockClient as any

/**
 * Sends `count` requests to the given endpoint and returns an array of status codes.
 */
async function fireRequests(
  method: 'get' | 'post',
  path: string,
  count: number,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<number[]> {
  const statuses: number[] = []
  for (let i = 0; i < count; i++) {
    const req = request(app)[method](path)
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        req.set(k, v)
      }
    }
    if (body && method === 'post') {
      req.set('Content-Type', 'application/json').send(body)
    }
    const res = await req
    statuses.push(res.status)
  }
  return statuses
}

describe('Rate limiting (spec section 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /api/auth/telegram -- 6th request within 1 min returns 429', async () => {
    // Auth endpoint has IP-based rate limiter that runs before auth validation
    // So even invalid initData will hit the rate limiter after 5 requests
    const now = new Date()
    const dbUser = createTestDbUser({ createdAt: now, updatedAt: now })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const statuses = await fireRequests('post', '/api/auth/telegram', 6, {
      initData: 'placeholder',
    })

    // First 5 may succeed or fail for auth reasons; the 6th must be rate-limited
    expect(statuses[5]).toBe(429)
  })

  it('POST /api/game/sync -- 5th request within 1 min returns 429', async () => {
    // Use a unique user to get a fresh rate limiter bucket
    const token = signToken({ sub: 100, tgId: 100100100 })
    const gameSave = createTestGameSave({ userId: 100, lastSyncAt: new Date(Date.now() - 60_000) })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const statuses = await fireRequests(
      'post',
      '/api/game/sync',
      5,
      { clicksSinceLastSync: 0, clientTimestamp: Date.now() },
      createAuthHeader(token),
    )

    // syncLimiter: max 4 per minute -> 5th should be 429
    expect(statuses[4]).toBe(429)
  })

  it('POST /api/game/action -- 31st request within 1 min returns 429', async () => {
    const token = signToken({ sub: 200, tgId: 200200200 })
    const gameSave = createTestGameSave({ userId: 200, balance: 1_000_000, clickPowerLevel: 0, clickPowerCost: 100 })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.balanceLog.findFirst.mockResolvedValue(null)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const statuses = await fireRequests(
      'post',
      '/api/game/action',
      31,
      { type: 'purchase_upgrade', payload: { upgradeType: 'clickPower' } },
      createAuthHeader(token),
    )

    // actionLimiter: max 30 per minute -> 31st should be 429
    expect(statuses[30]).toBe(429)
  })

  it('POST /api/purchase/create-invoice -- 4th request within 1 min returns 429', async () => {
    // Mock telegramBotService for purchase
    const token = signToken({ sub: 300, tgId: 300300300 })

    const statuses = await fireRequests(
      'post',
      '/api/purchase/create-invoice',
      4,
      { packId: 'nuts_100' },
      createAuthHeader(token),
    )

    // purchaseLimiter: max 3 per minute -> 4th should be 429
    expect(statuses[3]).toBe(429)
  })

  it('GET /api/game/state -- 11th request within 1 min returns 429', async () => {
    const token = signToken({ sub: 400, tgId: 400400400 })
    const gameSave = createTestGameSave({ userId: 400, lastSyncAt: new Date(Date.now() - 60_000) })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const statuses = await fireRequests(
      'get',
      '/api/game/state',
      11,
      undefined,
      createAuthHeader(token),
    )

    // stateLimiter: max 10 per minute -> 11th should be 429
    expect(statuses[10]).toBe(429)
  })
})
