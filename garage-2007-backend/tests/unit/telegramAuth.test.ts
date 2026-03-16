import { describe, it, expect } from 'vitest'
import { validateInitData } from '../../src/services/telegramAuthService'
import {
  createValidInitData,
  createExpiredInitData,
  createInvalidInitData,
  DEFAULT_TELEGRAM_USER,
  TEST_BOT_TOKEN,
} from '../helpers'

describe('telegramAuthService — validateInitData', () => {
  it('valid initData returns TelegramUser with correct id and first_name', () => {
    const initData = createValidInitData(DEFAULT_TELEGRAM_USER)
    const result = validateInitData(initData, TEST_BOT_TOKEN)

    expect(result).not.toBeNull()
    expect(result!.id).toBe(DEFAULT_TELEGRAM_USER.id)
    expect(result!.first_name).toBe(DEFAULT_TELEGRAM_USER.first_name)
  })

  it('invalid hash returns null', () => {
    const initData = createInvalidInitData(DEFAULT_TELEGRAM_USER)
    const result = validateInitData(initData, TEST_BOT_TOKEN)

    expect(result).toBeNull()
  })

  it('expired auth_date (>300 sec) returns null', () => {
    const initData = createExpiredInitData(DEFAULT_TELEGRAM_USER)
    const result = validateInitData(initData, TEST_BOT_TOKEN)

    expect(result).toBeNull()
  })

  it('missing hash returns null', () => {
    const params = new URLSearchParams()
    params.set('query_id', 'test_query_id_123')
    params.set('user', JSON.stringify(DEFAULT_TELEGRAM_USER))
    params.set('auth_date', String(Math.floor(Date.now() / 1000)))
    // intentionally no hash

    const result = validateInitData(params.toString(), TEST_BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('missing user field returns null', () => {
    // Build initData with valid hash but no user field
    const params = new URLSearchParams()
    params.set('query_id', 'test_query_id_123')
    params.set('auth_date', String(Math.floor(Date.now() / 1000)))
    // No user field — sign it properly so hash is valid
    // The service should still return null because user is missing

    const crypto = require('node:crypto')
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest()
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
    params.set('hash', hash)

    const result = validateInitData(params.toString(), TEST_BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('tampered data (modified field after signing) returns null', () => {
    const initData = createValidInitData(DEFAULT_TELEGRAM_USER)
    // Replace the query_id value to simulate tampering
    const tampered = initData.replace('test_query_id_123', 'tampered_query_id')

    const result = validateInitData(tampered, TEST_BOT_TOKEN)
    expect(result).toBeNull()
  })

  it('wrong bot token returns null', () => {
    const initData = createValidInitData(DEFAULT_TELEGRAM_USER)
    const result = validateInitData(initData, 'wrong_bot_token_9999999:ZZZZZ')

    expect(result).toBeNull()
  })

  it('empty string returns null', () => {
    const result = validateInitData('', TEST_BOT_TOKEN)
    expect(result).toBeNull()
  })
})
