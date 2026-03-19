import { describe, it, expect } from 'vitest'
import { syncSchema, actionSchema, purchaseMilestonePayload } from '../../src/validation/gameSchemas'
import { telegramAuthSchema as authSchema } from '../../src/validation/authSchemas'
import { createInvoiceSchema as purchaseSchema } from '../../src/validation/purchaseSchemas'

describe('validation — Zod schemas', () => {
  // ── syncSchema ──────────────────────────────────────────────────────────────

  describe('syncSchema', () => {
    it('valid input passes', () => {
      const input = { clicksSinceLastSync: 42, clientTimestamp: 1710590400000, syncNonce: '550e8400-e29b-41d4-a716-446655440000' }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.clicksSinceLastSync).toBe(42)
        expect(result.data.clientTimestamp).toBe(1710590400000)
      }
    })

    it('extra fields rejected (strict mode)', () => {
      const input = {
        clicksSinceLastSync: 42,
        clientTimestamp: 1710590400000,
        syncNonce: '550e8400-e29b-41d4-a716-446655440000',
        extraField: 'should_fail',
      }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('clicksSinceLastSync > 1000 rejected', () => {
      const input = { clicksSinceLastSync: 1001, clientTimestamp: 1710590400000, syncNonce: '550e8400-e29b-41d4-a716-446655440000' }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('negative clicksSinceLastSync rejected', () => {
      const input = { clicksSinceLastSync: -1, clientTimestamp: 1710590400000, syncNonce: '550e8400-e29b-41d4-a716-446655440000' }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('missing syncNonce rejected', () => {
      const input = { clicksSinceLastSync: 10, clientTimestamp: 1710590400000 }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(false)
    })
  })

  // ── actionSchema ────────────────────────────────────────────────────────────

  describe('actionSchema', () => {
    it('valid input passes', () => {
      const input = {
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
      }
      const result = actionSchema.safeParse(input)

      expect(result.success).toBe(true)
    })

    it('invalid type rejected', () => {
      const input = {
        type: 'invalid_action_type',
        payload: {},
      }
      const result = actionSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('extra fields rejected (strict mode)', () => {
      const input = {
        type: 'purchase_upgrade',
        payload: { upgradeType: 'clickPower' },
        extraField: 'should_fail',
      }
      const result = actionSchema.safeParse(input)

      expect(result.success).toBe(false)
    })
  })

  // ── Per-action payload schemas ──────────────────────────────────────────────

  describe('per-action payload schemas', () => {
    it('purchase_upgrade: valid upgradeType enum (clickPower | workSpeed)', () => {
      const validTypes = ['clickPower', 'workSpeed']
      for (const upgradeType of validTypes) {
        const input = { type: 'purchase_upgrade', payload: { upgradeType } }
        const result = actionSchema.safeParse(input)
        expect(result.success).toBe(true)
      }
    })

    it('hire_worker: valid workerType enum', () => {
      const validTypes = ['apprentice', 'mechanic', 'master', 'brigadier', 'director']
      for (const workerType of validTypes) {
        const input = { type: 'hire_worker', payload: { workerType } }
        const result = actionSchema.safeParse(input)
        expect(result.success).toBe(true)
      }
    })

    it('purchase_milestone: level must be number', () => {
      const input = { type: 'purchase_milestone', payload: { level: 5 } }
      const result = actionSchema.safeParse(input)
      expect(result.success).toBe(true)

      // Per-action payload validation (happens in handler, not actionSchema)
      const validPayload = purchaseMilestonePayload.safeParse({ level: 5 })
      expect(validPayload.success).toBe(true)

      const invalidPayload = purchaseMilestonePayload.safeParse({ level: 'five' })
      expect(invalidPayload.success).toBe(false)
    })
  })

  // ── authSchema ──────────────────────────────────────────────────────────────

  describe('authSchema', () => {
    it('empty initData string rejected (min 1)', () => {
      const input = { initData: '' }
      const result = authSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('missing initData rejected', () => {
      const input = {}
      const result = authSchema.safeParse(input)

      expect(result.success).toBe(false)
    })
  })
})
