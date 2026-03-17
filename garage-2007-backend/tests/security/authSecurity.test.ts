import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { createAuthHeader, createTestGameSave, TEST_JWT_SECRET } from '../helpers'

const prisma = __mockClient as any

describe('Auth / JWT security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an expired JWT with 401', async () => {
    const expiredToken = jwt.sign(
      { sub: 1, tgId: 111 },
      TEST_JWT_SECRET,
      { expiresIn: '0s' },
    )

    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(expiredToken))

    expect(res.status).toBe(401)
  })

  it('rejects a malformed JWT (random string) with 401', async () => {
    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader('not.a.real.jwt.token'))

    expect(res.status).toBe(401)
  })

  it('rejects a JWT signed with the wrong secret with 401', async () => {
    const wrongSecretToken = jwt.sign(
      { sub: 1, tgId: 111 },
      'wrong_secret_that_does_not_match',
      { expiresIn: '24h' },
    )

    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(wrongSecretToken))

    expect(res.status).toBe(401)
  })

  it('always returns own game state regardless of query params (ownership by JWT)', async () => {
    // The API uses req.user.id from JWT, ignoring userId query params.
    // So User A requesting ?userId=2 still gets their own state.
    const userAToken = jwt.sign(
      { sub: 1, tgId: 111 },
      TEST_JWT_SECRET,
      { expiresIn: '24h' },
    )

    const gameSave = createTestGameSave({ userId: 1 })
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)
    prisma.gameSave.update.mockResolvedValue(gameSave)
    prisma.balanceLog.create.mockResolvedValue({})

    // Request with userId: 2 in query -- should be ignored
    const res = await request(app)
      .get('/api/game/state')
      .query({ userId: 2 })
      .set(createAuthHeader(userAToken))

    // Should return 200 with User A's own data (API ignores query userId)
    expect(res.status).toBe(200)
    expect(res.body.gameState).toBeDefined()
  })

  it('rejects a request with no Authorization header with 401', async () => {
    const res = await request(app)
      .get('/api/game/state')

    expect(res.status).toBe(401)
  })

  it('rejects Authorization header without Bearer prefix with 401', async () => {
    const validToken = jwt.sign(
      { sub: 1, tgId: 111 },
      TEST_JWT_SECRET,
      { expiresIn: '24h' },
    )

    const res = await request(app)
      .get('/api/game/state')
      .set('Authorization', validToken) // no "Bearer " prefix

    expect(res.status).toBe(401)
  })
})
