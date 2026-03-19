import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken } from '../../src/utils/jwt'

describe('jwt — signToken / verifyToken', () => {
  const payload = { sub: 1, tgId: 123456789 }

  it('signToken → verifyToken roundtrip: payload matches', () => {
    const token = signToken(payload)
    const decoded = verifyToken(token)

    expect(decoded).not.toBeNull()
    expect(decoded!.sub).toBe(payload.sub)
    expect(decoded!.tgId).toBe(payload.tgId)
  })

  it('expired token returns null from verifyToken', async () => {
    // Use fake timers to create a token, then advance time past expiry
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const token = signToken(payload)

    // Advance time by 25 hours (JWT expiry is 24h per spec)
    vi.setSystemTime(new Date('2026-01-02T01:00:00Z'))

    const decoded = verifyToken(token)
    expect(decoded).toBeNull()

    vi.useRealTimers()
  })

  it('token signed with different secret returns null from verifyToken', () => {
    // Sign with a completely different secret (bypassing our env mock)
    const token = jwt.sign(payload, 'completely_different_secret_key_here!', { expiresIn: '24h' })

    // verifyToken uses the mocked env.JWT_SECRET — should fail
    const decoded = verifyToken(token)
    expect(decoded).toBeNull()
  })

  it('payload contains sub and tgId fields', () => {
    const token = signToken(payload)
    const decoded = verifyToken(token)

    expect(decoded).toHaveProperty('sub')
    expect(decoded).toHaveProperty('tgId')
    expect(typeof decoded!.sub).toBe('number')
    expect(typeof decoded!.tgId).toBe('number')
  })

  it('malformed token string returns null from verifyToken', () => {
    const decoded = verifyToken('not.a.valid.jwt.token')
    expect(decoded).toBeNull()
  })
})
