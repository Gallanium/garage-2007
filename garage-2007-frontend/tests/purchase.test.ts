import { describe, expect, it } from 'vitest'
import { NUTS_PACKS, NUTS_PACK_ORDER } from '@shared/constants/purchase.js'
import type { NutsPackId } from '@shared/types/purchase.js'

describe('purchase constants', () => {
  it('NUTS_PACKS contains all 3 packs with correct structure', () => {
    expect(Object.keys(NUTS_PACKS)).toHaveLength(3)

    for (const pack of Object.values(NUTS_PACKS)) {
      expect(pack).toHaveProperty('stars')
      expect(pack).toHaveProperty('nuts')
      expect(pack).toHaveProperty('label')
      expect(typeof pack.stars).toBe('number')
      expect(typeof pack.nuts).toBe('number')
      expect(typeof pack.label).toBe('string')
      expect(pack.stars).toBeGreaterThan(0)
      expect(pack.nuts).toBeGreaterThan(0)
    }
  })

  it('NUTS_PACK_ORDER lists all pack IDs', () => {
    expect(NUTS_PACK_ORDER).toHaveLength(3)
    expect(NUTS_PACK_ORDER).toEqual(['nuts_100', 'nuts_500', 'nuts_1500'])

    for (const id of NUTS_PACK_ORDER) {
      expect(NUTS_PACKS[id]).toBeDefined()
    }
  })

  it('packs are ordered by ascending price', () => {
    const prices = NUTS_PACK_ORDER.map((id) => NUTS_PACKS[id].stars)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1])
    }
  })

  it('nuts_1500 has the best nuts-per-star ratio', () => {
    const ratios = NUTS_PACK_ORDER.map((id) => {
      const pack = NUTS_PACKS[id]
      return { id, ratio: pack.nuts / pack.stars }
    })

    const best = ratios.reduce((a, b) => (a.ratio > b.ratio ? a : b))
    expect(best.id).toBe('nuts_1500')
  })

  it('pack IDs match the NutsPackId type values', () => {
    const expectedIds: NutsPackId[] = ['nuts_100', 'nuts_500', 'nuts_1500']
    expect(Object.keys(NUTS_PACKS).sort()).toEqual([...expectedIds].sort())
  })
})
