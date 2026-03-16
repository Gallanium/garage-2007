// These tests are written against the backend spec (docs/BACKEND_MVP.md).
// They will fail until the corresponding backend code is implemented.
// Run: npm test

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/index'
import {
  createValidInitData,
  createInvalidInitData,
  createTelegramUser,
  DEFAULT_TELEGRAM_USER,
  TEST_BOT_TOKEN,
} from '../helpers'

describe('POST /api/auth/telegram', () => {
  it('returns 200 with token and user for valid initData', async () => {
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
    const newUser = createTelegramUser({ id: 999888777, first_name: 'BrandNew' })
    const initData = createValidInitData(newUser, TEST_BOT_TOKEN)

    const res = await request(app)
      .post('/api/auth/telegram')
      .send({ initData })

    expect(res.status).toBe(200)
    expect(res.body.user.isNew).toBe(true)
  })

  it('returns isNew: false for an existing user on second auth', async () => {
    const user = createTelegramUser({ id: 111222333, first_name: 'Repeat' })

    // First auth — creates the user
    const initData1 = createValidInitData(user, TEST_BOT_TOKEN)
    await request(app)
      .post('/api/auth/telegram')
      .send({ initData: initData1 })

    // Second auth — user already exists
    const initData2 = createValidInitData(user, TEST_BOT_TOKEN)
    const res = await request(app)
      .post('/api/auth/telegram')
      .send({ initData: initData2 })

    expect(res.status).toBe(200)
    expect(res.body.user.isNew).toBe(false)
  })

  it('returns 429 when rate limit is exceeded (6th request)', async () => {
    const user = createTelegramUser({ id: 777666555, first_name: 'RateTest' })
    const results: number[] = []

    // Send 6 requests rapidly — rate limit is 5/min per IP
    for (let i = 0; i < 6; i++) {
      const initData = createValidInitData(user, TEST_BOT_TOKEN)
      const res = await request(app)
        .post('/api/auth/telegram')
        .send({ initData })
      results.push(res.status)
    }

    // First 5 should succeed, 6th should be rate-limited
    expect(results.slice(0, 5).every((s) => s === 200)).toBe(true)
    expect(results[5]).toBe(429)
  })
})
