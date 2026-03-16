// Security tests written against the backend spec (docs/BACKEND_MVP.md).
// These tests validate security requirements from section 2 of the spec.
// Run: npm test

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/index'

/**
 * Sends `count` requests to the given endpoint and returns an array of status codes.
 * We don't care about individual responses — only that the last one hits 429.
 */
async function fireRequests(
  method: 'get' | 'post',
  path: string,
  count: number,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<number[]> {
  const statuses: number[] = []
  for (let i = 0; i < count; i++) {
    const req = request(app)[method](path)
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        req.set(k, v)
      }
    }
    if (body && method === 'post') {
      req.set('Content-Type', 'application/json').send(body)
    }
    const res = await req
    statuses.push(res.status)
  }
  return statuses
}

describe('Rate limiting (spec section 9)', () => {
  it('POST /api/auth/telegram — 6th request within 1 min returns 429', async () => {
    const statuses = await fireRequests('post', '/api/auth/telegram', 6, {
      initData: 'placeholder',
    })

    // First 5 may succeed or fail for other reasons; the 6th must be rate-limited
    expect(statuses[5]).toBe(429)
  })

  it('POST /api/game/sync — 5th request within 1 min returns 429', async () => {
    const statuses = await fireRequests(
      'post',
      '/api/game/sync',
      5,
      { clicksSinceLastSync: 0, clientTimestamp: Date.now() },
      { Authorization: 'Bearer dummy' },
    )

    expect(statuses[4]).toBe(429)
  })

  it('POST /api/game/action — 31st request within 1 min returns 429', async () => {
    const statuses = await fireRequests(
      'post',
      '/api/game/action',
      31,
      { type: 'purchase_upgrade', payload: {} },
      { Authorization: 'Bearer dummy' },
    )

    expect(statuses[30]).toBe(429)
  })

  it('POST /api/purchase/create-invoice — 4th request within 1 min returns 429', async () => {
    const statuses = await fireRequests(
      'post',
      '/api/purchase/create-invoice',
      4,
      { packId: 'nuts_100' },
      { Authorization: 'Bearer dummy' },
    )

    expect(statuses[3]).toBe(429)
  })

  it('GET /api/game/state — 11th request within 1 min returns 429', async () => {
    const statuses = await fireRequests(
      'get',
      '/api/game/state',
      11,
      undefined,
      { Authorization: 'Bearer dummy' },
    )

    expect(statuses[10]).toBe(429)
  })
})
