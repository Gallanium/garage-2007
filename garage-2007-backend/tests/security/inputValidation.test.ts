import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import { signToken } from '../../src/utils/jwt'
import {
  createAuthHeader,
  createValidInitData,
  createTelegramUser,
  createTestDbUser,
  createTestGameSave,
  TEST_BOT_TOKEN,
} from '../helpers'

const prisma = __mockClient as any

/** A valid JWT for authenticated requests. */
const validToken = signToken({ sub: 1, tgId: 123456789 })

describe('Input validation & security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a body larger than 16 KB with 413', async () => {
    // Build a payload that exceeds 16 KB
    const largePayload = JSON.stringify({
      type: 'purchase_upgrade',
      payload: { data: 'x'.repeat(17_000) },
    })

    const res = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send(largePayload)

    expect(res.status).toBe(413)
  })

  it('rejects extra fields not in Zod schema with 400', async () => {
    // Need a valid game save for the sync to reach the Zod validation
    // But the strict() schema validation happens before the service layer
    const gameSave = createTestGameSave()
    prisma.gameSave.findUnique.mockResolvedValue(gameSave)

    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 10,
        clientTimestamp: Date.now(),
        hackField: true, // not in schema
      })

    expect(res.status).toBe(400)
  })

  it('handles SQL injection in string fields safely (no 500)', async () => {
    const now = new Date()
    const dbUser = createTestDbUser({ createdAt: now, updatedAt: now })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const maliciousUser = createTelegramUser({
      first_name: "Robert'); DROP TABLE users;--",
      username: "admin' OR '1'='1",
    })

    const initData = createValidInitData(maliciousUser, TEST_BOT_TOKEN)

    const res = await request(app)
      .post('/api/auth/telegram')
      .set('Content-Type', 'application/json')
      .send({ initData })

    // Should not return 500 (internal/SQL error). 200 or 400 are both acceptable.
    expect(res.status).not.toBe(500)
    expect([200, 201, 400, 401, 422]).toContain(res.status)
  })

  it('handles XSS payload in string fields safely', async () => {
    const now = new Date()
    const dbUser = createTestDbUser({
      createdAt: now,
      updatedAt: now,
      firstName: '<script>alert(1)</script>',
    })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const xssUser = createTelegramUser({
      first_name: '<script>alert(1)</script>',
      username: 'xss_tester',
    })

    const initData = createValidInitData(xssUser, TEST_BOT_TOKEN)

    const res = await request(app)
      .post('/api/auth/telegram')
      .set('Content-Type', 'application/json')
      .send({ initData })

    // Request should be processed without 500 error
    expect(res.status).not.toBe(500)

    // If the response contains the name, it should be stored as-is (not executed)
    if (res.body?.user?.firstName) {
      expect(typeof res.body.user.firstName).toBe('string')
    }
  })

  it('rejects invalid JSON body with 400', async () => {
    const res = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send('{ this is not valid JSON }}}')

    expect(res.status).toBe(400)
  })

  it('rejects wrong Content-Type with 400 or 415', async () => {
    const res = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'text/plain')
      .set(createAuthHeader(validToken))
      .send('clicksSinceLastSync=10')

    // Express json() parser won't parse text/plain, body will be empty/undefined
    // Zod validation will fail with 400
    expect([400, 415]).toContain(res.status)
  })
})
