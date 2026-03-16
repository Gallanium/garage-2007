// These tests are written against the backend spec (docs/BACKEND_MVP.md).
// They will fail until the corresponding backend code is implemented.
// Run: npm test

import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../../src/index'

describe('GET /api/health', () => {
  it('returns 200 with status ok and a numeric timestamp', async () => {
    const res = await request(app).get('/api/health')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('timestamp')
    expect(typeof res.body.timestamp).toBe('number')
  })

  it('does not require Authorization header', async () => {
    const res = await request(app)
      .get('/api/health')
      // intentionally no Authorization header

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
