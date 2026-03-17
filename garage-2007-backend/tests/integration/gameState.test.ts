import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import { createAuthHeader, createTestGameSave } from '../helpers'

const prisma = __mockClient as any

describe('GET /api/game/state', () => {
  const token = signToken({ sub: 1, tgId: 123456789 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with gameState and serverTime for authenticated request', async () => {
    const gameSave = createTestGameSave({ lastSyncAt: new Date(Date.now() - 5000) })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(token))

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('serverTime')
    expect('gameState' in res.body).toBe(true)
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/game/state')

    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid/expired token', async () => {
    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader('invalid.jwt.token'))

    expect(res.status).toBe(401)
  })

  it('returns 200 with initial gameState for a new player with no GameSave', async () => {
    const freshToken = signToken({ sub: 99, tgId: 444555666 })
    // loadState returns null => controller calls createInitialState
    prisma.gameSave.findUnique.mockResolvedValue(null)
    // createInitialState creates a new game save
    const newSave = createTestGameSave({
      userId: 99,
      balance: 0,
      nuts: 0,
    })
    prisma.gameSave.create.mockResolvedValue(newSave)

    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(freshToken))

    expect(res.status).toBe(200)
    // New players get an initial state created (not null)
    expect(res.body.gameState).toBeDefined()
  })

  it('includes serverTime as a number', async () => {
    const gameSave = createTestGameSave({ lastSyncAt: new Date(Date.now() - 5000) })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(token))

    expect(res.status).toBe(200)
    expect(typeof res.body.serverTime).toBe('number')
    // serverTime should be a reasonable epoch ms value
    expect(res.body.serverTime).toBeGreaterThan(1_700_000_000_000)
  })
})
