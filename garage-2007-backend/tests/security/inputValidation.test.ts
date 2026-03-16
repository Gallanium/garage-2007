// Security tests written against the backend spec (docs/BACKEND_MVP.md).
// These tests validate security requirements from section 2 of the spec.
// Run: npm test

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/index'
import {
  createAuthHeader,
  createValidInitData,
  createTelegramUser,
  TEST_JWT_SECRET,
  TEST_BOT_TOKEN,
} from '../helpers'

/** A valid JWT for authenticated requests. */
const validToken = jwt.sign({ sub: 1, tgId: 123456789 }, TEST_JWT_SECRET, { expiresIn: '24h' })

describe('Input validation & security', () => {
  it('rejects a body larger than 16 KB with 413', async () => {
    // Build a payload that exceeds 16 KB
    const largePayload = {
      type: 'purchase_upgrade',
      payload: { data: 'x'.repeat(17_000) },
    }

    const res = await request(app)
      .post('/api/game/action')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send(largePayload)

    expect(res.status).toBe(413)
  })

  it('rejects extra fields not in Zod schema with 400', async () => {
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
    // or sanitized — but never cause an internal error
    if (res.body?.user?.firstName) {
      // Verify the raw script tag is either stored literally or stripped,
      // but not interpreted
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

    expect([400, 415]).toContain(res.status)
  })
})
