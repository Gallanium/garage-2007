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
  TEST_BOT_TOKEN,
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

describe('GET /api/game/state', () => {
  let token: string

  beforeAll(async () => {
    token = await authenticateUser()
  })

  it('returns 200 with gameState and serverTime for authenticated request', async () => {
    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(token))

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('serverTime')
    // gameState can be null (new player) or an object
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

  it('returns 200 with gameState: null for a new player with no GameSave', async () => {
    // Create a brand-new user that has never synced/played
    const freshUser = createTelegramUser({ id: 444555666, first_name: 'FreshPlayer' })
    const freshToken = await authenticateUser(freshUser)

    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(freshToken))

    expect(res.status).toBe(200)
    expect(res.body.gameState).toBeNull()
  })

  it('includes serverTime as a number', async () => {
    const res = await request(app)
      .get('/api/game/state')
      .set(createAuthHeader(token))

    expect(res.status).toBe(200)
    expect(typeof res.body.serverTime).toBe('number')
    // serverTime should be a reasonable epoch ms value
    expect(res.body.serverTime).toBeGreaterThan(1_700_000_000_000)
  })
})
