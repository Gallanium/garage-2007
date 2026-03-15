import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore, initialState, DECORATION_CATALOG } from '../src/store/gameStore'

describe('decoration catalog', () => {
  it('contains exactly 22 items', () => {
    expect(Object.keys(DECORATION_CATALOG)).toHaveLength(22)
  })

  it('all IDs are unique and match their key', () => {
    for (const [key, def] of Object.entries(DECORATION_CATALOG)) {
      expect(def.id).toBe(key)
    }
  })

  it('covers all 5 categories', () => {
    const categories = new Set(Object.values(DECORATION_CATALOG).map(d => d.category))
    expect(categories).toContain('tools')
    expect(categories).toContain('wall_decor')
    expect(categories).toContain('lighting')
    expect(categories).toContain('cars')
    expect(categories).toContain('trophies')
  })

  it('all costs are positive', () => {
    for (const def of Object.values(DECORATION_CATALOG)) {
      expect(def.cost).toBeGreaterThan(0)
    }
  })

  it('all positions are within canvas bounds (360x480)', () => {
    for (const def of Object.values(DECORATION_CATALOG)) {
      expect(def.position.x).toBeGreaterThanOrEqual(0)
      expect(def.position.x).toBeLessThanOrEqual(360)
      expect(def.position.y).toBeGreaterThanOrEqual(0)
      expect(def.position.y).toBeLessThanOrEqual(480)
    }
  })

  it('all unlockLevels are >= 1', () => {
    for (const def of Object.values(DECORATION_CATALOG)) {
      expect(def.unlockLevel).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('purchaseDecoration', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('purchases a rubles decoration and adds to owned+active', () => {
    useGameStore.setState({ balance: 10000, garageLevel: 1 })

    const result = useGameStore.getState().purchaseDecoration('tools_workbench')

    expect(result).toBe(true)
    expect(useGameStore.getState().balance).toBe(5000) // 10000 - 5000
    expect(useGameStore.getState().decorations.owned).toContain('tools_workbench')
    expect(useGameStore.getState().decorations.active).toContain('tools_workbench')
  })

  it('purchases a nuts decoration and deducts nuts', () => {
    useGameStore.setState({ nuts: 30, garageLevel: 10 })

    const result = useGameStore.getState().purchaseDecoration('tools_welding')

    expect(result).toBe(true)
    expect(useGameStore.getState().nuts).toBe(5) // 30 - 25
    expect(useGameStore.getState().decorations.owned).toContain('tools_welding')
  })

  it('returns false when rubles balance is insufficient', () => {
    useGameStore.setState({ balance: 100, garageLevel: 1 })

    const result = useGameStore.getState().purchaseDecoration('tools_workbench')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_workbench')
    expect(useGameStore.getState().balance).toBe(100)
  })

  it('returns false when nuts are insufficient', () => {
    useGameStore.setState({ nuts: 10, garageLevel: 10 })

    const result = useGameStore.getState().purchaseDecoration('tools_welding') // costs 25

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_welding')
  })

  it('returns false when garageLevel is below unlockLevel', () => {
    useGameStore.setState({ balance: 500000, garageLevel: 1 })

    const result = useGameStore.getState().purchaseDecoration('tools_compressor') // unlockLevel: 8

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_compressor')
  })

  it('returns false on double-purchase', () => {
    useGameStore.setState({ balance: 20000, garageLevel: 1 })
    useGameStore.getState().purchaseDecoration('tools_workbench')

    const result = useGameStore.getState().purchaseDecoration('tools_workbench')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned.filter(id => id === 'tools_workbench')).toHaveLength(1)
  })

  it('displaces active item in same slot when purchasing a second car', () => {
    useGameStore.setState({ balance: 1_000_000, garageLevel: 8 })
    useGameStore.getState().purchaseDecoration('car_zaporozhets') // floor_main, costs 100k
    expect(useGameStore.getState().decorations.active).toContain('car_zaporozhets')

    const result = useGameStore.getState().purchaseDecoration('car_moskvich') // floor_main, costs 500k
    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).not.toContain('car_zaporozhets')
    expect(useGameStore.getState().decorations.active).toContain('car_moskvich')
    // both remain owned
    expect(useGameStore.getState().decorations.owned).toContain('car_zaporozhets')
    expect(useGameStore.getState().decorations.owned).toContain('car_moskvich')
  })

  it('displaces cross-category conflict (wall_decor vs lighting on same slot)', () => {
    useGameStore.setState({ balance: 10_000, garageLevel: 1 })
    useGameStore.getState().purchaseDecoration('decor_calendar')   // back_wall_center, costs 2000
    expect(useGameStore.getState().decorations.active).toContain('decor_calendar')

    useGameStore.setState({ balance: 5_000 })
    const result = useGameStore.getState().purchaseDecoration('light_bulb') // back_wall_center, costs 3000
    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).not.toContain('decor_calendar')
    expect(useGameStore.getState().decorations.active).toContain('light_bulb')
  })
})

describe('toggleDecoration', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('deactivates an active owned decoration', () => {
    useGameStore.setState({
      balance: 10000, garageLevel: 1,
      decorations: { owned: ['tools_workbench'], active: ['tools_workbench'] },
    })

    useGameStore.getState().toggleDecoration('tools_workbench')

    expect(useGameStore.getState().decorations.active).not.toContain('tools_workbench')
    expect(useGameStore.getState().decorations.owned).toContain('tools_workbench')
  })

  it('activates a hidden owned decoration', () => {
    useGameStore.setState({
      decorations: { owned: ['tools_workbench'], active: [] },
    })

    useGameStore.getState().toggleDecoration('tools_workbench')

    expect(useGameStore.getState().decorations.active).toContain('tools_workbench')
  })

  it('is a no-op when item is not owned', () => {
    useGameStore.setState({
      decorations: { owned: [], active: [] },
    })

    useGameStore.getState().toggleDecoration('tools_workbench')

    expect(useGameStore.getState().decorations.active).not.toContain('tools_workbench')
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_workbench')
  })

  it('displaces slot conflict when activating a hidden decoration', () => {
    useGameStore.setState({
      decorations: {
        owned: ['car_zaporozhets', 'car_moskvich'],
        active: ['car_zaporozhets'],
      },
    })

    useGameStore.getState().toggleDecoration('car_moskvich')

    expect(useGameStore.getState().decorations.active).not.toContain('car_zaporozhets')
    expect(useGameStore.getState().decorations.active).toContain('car_moskvich')
  })

  it('does not displace when simply deactivating', () => {
    useGameStore.setState({
      decorations: {
        owned: ['car_zaporozhets', 'car_moskvich'],
        active: ['car_zaporozhets'],
      },
    })

    useGameStore.getState().toggleDecoration('car_zaporozhets')

    expect(useGameStore.getState().decorations.active).toHaveLength(0)
    expect(useGameStore.getState().decorations.owned).toHaveLength(2)
  })
})
