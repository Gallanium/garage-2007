import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateInitData, _resetReplayCache } from '../../src/services/telegramAuthService'

describe('DEV_BYPASS_AUTH', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalBypass = process.env.DEV_BYPASS_AUTH

  beforeEach(async () => {
    await _resetReplayCache()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    process.env.DEV_BYPASS_AUTH = originalBypass
  })

  it('accepts mock initData with non-hex hash when DEV_BYPASS_AUTH=true in development', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_BYPASS_AUTH = 'true'

    const initData = new URLSearchParams([
      ['user', JSON.stringify({ id: 123456789, first_name: 'Dev', last_name: 'User', username: 'devuser', language_code: 'ru', is_premium: false })],
      ['hash', 'mock_hash_dev_only'],
      ['auth_date', String(Math.floor(Date.now() / 1000))],
      ['signature', 'mock_signature'],
    ]).toString()

    const result = await validateInitData(initData, 'fake_bot_token')
    expect(result).not.toBeNull()
    expect(result!.id).toBe(123456789)
    expect(result!.first_name).toBe('Dev')
  })

  it('rejects mock initData when NODE_ENV=production even with DEV_BYPASS_AUTH=true', async () => {
    process.env.NODE_ENV = 'production'
    process.env.DEV_BYPASS_AUTH = 'true'

    const initData = new URLSearchParams([
      ['user', JSON.stringify({ id: 123456789, first_name: 'Dev', last_name: 'User', username: 'devuser', language_code: 'ru', is_premium: false })],
      ['hash', 'mock_hash_dev_only'],
      ['auth_date', String(Math.floor(Date.now() / 1000))],
      ['signature', 'mock_signature'],
    ]).toString()

    const result = await validateInitData(initData, 'fake_bot_token')
    expect(result).toBeNull()
  })

  it('rejects mock initData when DEV_BYPASS_AUTH is not set', async () => {
    process.env.NODE_ENV = 'development'
    process.env.DEV_BYPASS_AUTH = 'false'

    const initData = new URLSearchParams([
      ['user', JSON.stringify({ id: 123456789, first_name: 'Dev' })],
      ['hash', 'mock_hash_dev_only'],
      ['auth_date', String(Math.floor(Date.now() / 1000))],
    ]).toString()

    const result = await validateInitData(initData, 'fake_bot_token')
    expect(result).toBeNull()
  })
})
