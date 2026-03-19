import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import { __mockClient } from '@prisma/client'
import {
  createValidInitData,
  createInvalidInitData,
  createTelegramUser,
  DEFAULT_TELEGRAM_USER,
  TEST_BOT_TOKEN,
  createTestDbUser,
} from '../helpers'

const prisma = __mockClient as any

describe('POST /api/auth/telegram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with token and user for valid initData', async () => {
    const now = new Date()
    const dbUser = createTestDbUser({ createdAt: now, updatedAt: now })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const initData = createValidInitData(DEFAULT_TELEGRAM_USER, TEST_BOT_TOKEN)

    const res = await request(app)
      .post('/api/auth/telegram')
      .send({ initData })

    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.token.length).toBeGreaterThan(0)
    expect(res.body.user).toBeDefined()
    expect(typeof res.body.user.id).toBe('number')
    expect(typeof res.body.user.firstName).toBe('string')
    expect(typeof res.body.user.isNew).toBe('boolean')
  })

  it('returns 401 for invalid initData (bad hash)', async () => {
    const initData = createInvalidInitData(DEFAULT_TELEGRAM_USER)

    const res = await request(app)
      .post('/api/auth/telegram')
      .send({ initData })

    expect(res.status).toBe(401)
  })

  it('returns 400 when initData is missing from body', async () => {
    const res = await request(app)
      .post('/api/auth/telegram')
      .send({})

    expect(res.status).toBe(400)
  })

  it('returns isNew: true for a new user', async () => {
    const now = new Date()
    // isNew is detected when createdAt === updatedAt
    const dbUser = createTestDbUser({
      id: 2,
      telegramId: BigInt(999888777),
      firstName: 'BrandNew',
      createdAt: now,
      updatedAt: now,
    })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const newUser = createTelegramUser({ id: 999888777, first_name: 'BrandNew' })
    const initData = createValidInitData(newUser, TEST_BOT_TOKEN)

    const res = await request(app)
      .post('/api/auth/telegram')
      .send({ initData })

    expect(res.status).toBe(200)
    expect(res.body.user.isNew).toBe(true)
  })

  it('returns isNew: false for an existing user on second auth', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const updatedAt = new Date() // different from createdAt => not new
    const dbUser = createTestDbUser({
      id: 3,
      telegramId: BigInt(111222333),
      firstName: 'Repeat',
      createdAt,
      updatedAt,
    })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const user = createTelegramUser({ id: 111222333, first_name: 'Repeat' })
    const initData = createValidInitData(user, TEST_BOT_TOKEN)
    const res = await request(app)
      .post('/api/auth/telegram')
      .send({ initData })

    expect(res.status).toBe(200)
    expect(res.body.user.isNew).toBe(false)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    const now = new Date()
    const dbUser = createTestDbUser({ createdAt: now, updatedAt: now })
    prisma.user.upsert.mockResolvedValue(dbUser)

    const user = createTelegramUser({ id: 777666555, first_name: 'RateTest' })
    const results: number[] = []

    // Send 10 requests rapidly -- rate limit is 5/min per IP.
    // Other test files may have already consumed some of the quota,
    // so we send more than needed and just verify that at least one gets 429.
    for (let i = 0; i < 10; i++) {
      const initData = createValidInitData(user, TEST_BOT_TOKEN)
      const res = await request(app)
        .post('/api/auth/telegram')
        .send({ initData })
      results.push(res.status)
    }

    // At least one request should be rate-limited
    expect(results).toContain(429)
  })
})
