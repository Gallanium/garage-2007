import { describe, it, expect } from 'vitest'
import { syncSchema, actionSchema } from '../../src/validation/gameSchemas'
import { authSchema } from '../../src/validation/authSchemas'
import { purchaseSchema } from '../../src/validation/purchaseSchemas'

describe('validation — Zod schemas', () => {
  // ── syncSchema ──────────────────────────────────────────────────────────────

  describe('syncSchema', () => {
    it('valid input passes', () => {
      const input = { clicksSinceLastSync: 42, clientTimestamp: 1710590400000 }
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
        extraField: 'should_fail',
      }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('clicksSinceLastSync > 1000 rejected', () => {
      const input = { clicksSinceLastSync: 1001, clientTimestamp: 1710590400000 }
      const result = syncSchema.safeParse(input)

      expect(result.success).toBe(false)
    })

    it('negative clicksSinceLastSync rejected', () => {
      const input = { clicksSinceLastSync: -1, clientTimestamp: 1710590400000 }
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

      const invalidInput = { type: 'purchase_milestone', payload: { level: 'five' } }
      const invalidResult = actionSchema.safeParse(invalidInput)
      expect(invalidResult.success).toBe(false)
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
