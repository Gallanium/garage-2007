// Security tests written against the backend spec (docs/BACKEND_MVP.md).
// These tests validate security requirements from section 2 of the spec.
// Run: npm test

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/index'
import { createAuthHeader, TEST_JWT_SECRET } from '../helpers'

describe('Auth / JWT security', () => {
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

  it('prevents User A from accessing User B game state (403 or ownership error)', async () => {
    // Token for User A (sub: 1, tgId: 111)
    const userAToken = jwt.sign(
      { sub: 1, tgId: 111 },
      TEST_JWT_SECRET,
      { expiresIn: '24h' },
    )

    // Request User B's game state (userId: 2)
    const res = await request(app)
      .get('/api/game/state')
      .query({ userId: 2 })
      .set(createAuthHeader(userAToken))

    // Should be 403 Forbidden or some ownership error (not 200)
    expect([403, 401]).toContain(res.status)
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
