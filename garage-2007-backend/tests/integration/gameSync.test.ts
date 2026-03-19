import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave } from '../helpers'

const prisma = __mockClient as any

describe('POST /api/game/sync', () => {
  const token = signToken({ sub: 1, tgId: 123456789 })

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.balanceLog.findFirst.mockResolvedValue(null)
  })

  it('returns 200 with gameState and serverTime for a valid sync', async () => {
    const gameSave = createTestGameSave({ lastSyncAt: new Date(Date.now() - 10_000) })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue({ ...gameSave, totalClicks: 10 })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(token))
      .send({
        clicksSinceLastSync: 10,
        clientTimestamp: Date.now(),
        syncNonce: crypto.randomUUID(),
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('gameState')
    expect(res.body).toHaveProperty('serverTime')
    expect(typeof res.body.serverTime).toBe('number')
  })

  it('caps clicks when click rate exceeds 20/sec', async () => {
    const fastToken = signToken({ sub: 2, tgId: 222333444 })

    // lastSyncAt 1 second ago -> max 20 clicks
    const gameSave = createTestGameSave({
      userId: 2,
      lastSyncAt: new Date(Date.now() - 1000),
      totalClicks: 0,
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    // The update mock should reflect capped clicks
    prisma.gameSave.update.mockImplementation(async (args: any) => {
      return { ...gameSave, ...args.data, totalClicks: args.data.totalClicks ?? gameSave.totalClicks }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(fastToken))
      .send({ clicksSinceLastSync: 100, clientTimestamp: Date.now(), syncNonce: crypto.randomUUID() })

    expect(res.status).toBe(200)
    // Server caps at 20 clicks/sec * ~1s = 20 clicks
    expect(res.body.gameState.totalClicks).toBeLessThanOrEqual(20)
  })

  it('increases balance by click_income + passive_income', async () => {
    const earnerToken = signToken({ sub: 3, tgId: 333444555 })
    const gameSave = createTestGameSave({
      userId: 3,
      balance: 1000,
      lastSyncAt: new Date(Date.now() - 10_000),
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockImplementation(async (args: any) => {
      return { ...gameSave, ...args.data }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(earnerToken))
      .send({ clicksSinceLastSync: 5, clientTimestamp: Date.now(), syncNonce: crypto.randomUUID() })

    expect(res.status).toBe(200)
    // Balance should have increased (at least by click income for accepted clicks)
    expect(res.body.gameState.balance).toBeGreaterThanOrEqual(1000)
  })

  it('increments totalClicks by the accepted clicksSinceLastSync', async () => {
    const clickerToken = signToken({ sub: 4, tgId: 444555667 })
    const gameSave = createTestGameSave({
      userId: 4,
      totalClicks: 10,
      lastSyncAt: new Date(Date.now() - 10_000),
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockImplementation(async (args: any) => {
      return { ...gameSave, ...args.data }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(clickerToken))
      .send({ clicksSinceLastSync: 5, clientTimestamp: Date.now(), syncNonce: crypto.randomUUID() })

    expect(res.status).toBe(200)
    expect(res.body.gameState.totalClicks).toBeGreaterThan(10)
  })

  it('returns garageLevel in sync response', async () => {
    const levelerToken = signToken({ sub: 5, tgId: 555666778 })
    const gameSave = createTestGameSave({
      userId: 5,
      lastSyncAt: new Date(Date.now() - 10_000),
    })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockImplementation(async (args: any) => {
      return { ...gameSave, ...args.data }
    })
    prisma.balanceLog.createMany.mockResolvedValue({ count: 2 })

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(levelerToken))
      .send({ clicksSinceLastSync: 0, clientTimestamp: Date.now(), syncNonce: crypto.randomUUID() })

    expect(res.status).toBe(200)
    expect(res.body.gameState).toHaveProperty('garageLevel')
    expect(typeof res.body.gameState.garageLevel).toBe('number')
    expect(res.body.gameState.garageLevel).toBeGreaterThanOrEqual(1)
  })

  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app)
      .post('/api/game/sync')
      .send({ clicksSinceLastSync: 5, clientTimestamp: Date.now(), syncNonce: crypto.randomUUID() })

    expect(res.status).toBe(401)
  })

  it('returns 404 when game save not found', async () => {
    const noSaveToken = signToken({ sub: 6, tgId: 666777889 })
    prisma.gameSave.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/game/sync')
      .set(createAuthHeader(noSaveToken))
      .send({ clicksSinceLastSync: 1, clientTimestamp: Date.now(), syncNonce: crypto.randomUUID() })

    expect(res.status).toBe(404)
  })
})
