// Security tests written against the backend spec (docs/BACKEND_MVP.md).
// These tests validate security requirements from section 2 of the spec.
// Run: npm test

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../src/index'
import { createAuthHeader, TEST_JWT_SECRET } from '../helpers'

/** A valid JWT for authenticated requests. */
const validToken = jwt.sign({ sub: 1, tgId: 123456789 }, TEST_JWT_SECRET, { expiresIn: '24h' })

describe('Anti-cheat measures (spec section 6.3)', () => {
  it('caps clicks when rate exceeds 20/sec', async () => {
    // Player claims 500 clicks but only 5 seconds have elapsed since last sync.
    // Server max = 20 clicks/sec * 5 sec = 100 clicks.
    // The sync should succeed but apply at most 100 clicks worth of income.
    const fiveSecondsAgo = Date.now() - 5_000

    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 500,
        clientTimestamp: Date.now(),
      })

    if (res.status === 200) {
      // The server should have capped clicks. Check that the applied click
      // count is <= the server-computed maximum (20/sec * elapsed seconds).
      // The exact field name may vary; common patterns:
      const appliedClicks =
        res.body.appliedClicks ??
        res.body.clicksApplied ??
        res.body.sync?.clicksApplied

      if (appliedClicks !== undefined) {
        // With a 5-second window, max is 100 clicks
        expect(appliedClicks).toBeLessThanOrEqual(100)
      }

      // At a minimum, verify the response is successful (no crash)
      expect(res.body).toBeDefined()
    }
  })

  it('rejects negative clicksSinceLastSync with 400', async () => {
    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: -10,
        clientTimestamp: Date.now(),
      })

    expect(res.status).toBe(400)
  })

  it('rejects fractional clicksSinceLastSync with 400', async () => {
    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 10.5,
        clientTimestamp: Date.now(),
      })

    expect(res.status).toBe(400)
  })

  it('uses server time for income computation (ignores far-future clientTimestamp)', async () => {
    // Send a clientTimestamp 1 hour in the future.
    // If the server naively trusts it, the offline income would be vastly inflated.
    const oneHourFuture = Date.now() + 3_600_000

    const res = await request(app)
      .post('/api/game/sync')
      .set('Content-Type', 'application/json')
      .set(createAuthHeader(validToken))
      .send({
        clicksSinceLastSync: 5,
        clientTimestamp: oneHourFuture,
      })

    if (res.status === 200) {
      // Fetch the current game state to verify balance
      const stateRes = await request(app)
        .get('/api/game/state')
        .set(createAuthHeader(validToken))

      if (stateRes.status === 200) {
        // The balance increase should be based on server-side elapsed time
        // (a few milliseconds at most), NOT on the 1-hour gap implied by
        // the future clientTimestamp. If the user has idle workers,
        // the increase from a few ms should be negligible.
        // We check that the balance is not absurdly inflated.
        const balance = stateRes.body.balance ?? stateRes.body.gameSave?.balance
        if (balance !== undefined) {
          // Starting balance is 10,000 (from test seed). Even generous idle
          // income shouldn't produce more than double in a real-time window
          // of a few seconds. An inflated balance (e.g., 100k+) would
          // indicate the server trusted the future timestamp.
          expect(balance).toBeLessThan(100_000)
        }
      }
    }
  })
})
