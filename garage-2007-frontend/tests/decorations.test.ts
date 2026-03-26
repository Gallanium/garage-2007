import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore, initialState, DECORATION_CATALOG } from '../src/store/gameStore'
import * as api from '../src/services/apiService'
import { buildMockServerState } from './setup'

const mockPerformAction = vi.mocked(api.performAction)

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

  it('purchases a rubles decoration and adds to owned+active', async () => {
    useGameStore.setState({ balance: 10000, garageLevel: 1 })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        balance: 5000,
        decorations: {
          owned: ['tools_workbench'],
          active: ['tools_workbench'],
        },
      }),
    })

    const result = await useGameStore.getState().purchaseDecoration('tools_workbench')

    expect(result).toBe(true)
    expect(useGameStore.getState().balance).toBe(5000)
    expect(useGameStore.getState().decorations.owned).toContain('tools_workbench')
    expect(useGameStore.getState().decorations.active).toContain('tools_workbench')
  })

  it('purchases a nuts decoration and deducts nuts', async () => {
    useGameStore.setState({ nuts: 30, garageLevel: 10 })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        nuts: 5,
        decorations: { owned: ['tools_welding'], active: ['tools_welding'] },
      }),
    })

    const result = await useGameStore.getState().purchaseDecoration('tools_welding')

    expect(result).toBe(true)
    expect(useGameStore.getState().nuts).toBe(5)
    expect(useGameStore.getState().decorations.owned).toContain('tools_welding')
  })

  it('returns false when rubles balance is insufficient', async () => {
    useGameStore.setState({ balance: 100, garageLevel: 1 })

    const result = await useGameStore.getState().purchaseDecoration('tools_workbench')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_workbench')
    expect(useGameStore.getState().balance).toBe(100)
  })

  it('returns false when nuts are insufficient', async () => {
    useGameStore.setState({ nuts: 10, garageLevel: 10 })

    const result = await useGameStore.getState().purchaseDecoration('tools_welding')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_welding')
  })

  it('returns false when garageLevel is below unlockLevel', async () => {
    useGameStore.setState({ balance: 500000, garageLevel: 1 })

    const result = await useGameStore.getState().purchaseDecoration('tools_compressor')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_compressor')
  })

  it('returns false on double-purchase', async () => {
    useGameStore.setState({ balance: 20000, garageLevel: 1 })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        balance: 15000,
        decorations: {
          owned: ['tools_workbench'],
          active: ['tools_workbench'],
        },
      }),
    })

    await useGameStore.getState().purchaseDecoration('tools_workbench')
    const result = await useGameStore.getState().purchaseDecoration('tools_workbench')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.owned.filter(id => id === 'tools_workbench')).toHaveLength(1)
  })

  it('displaces active item in same slot when purchasing a second car', async () => {
    useGameStore.setState({ balance: 1_000_000, garageLevel: 8 })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        balance: 900_000,
        decorations: {
          owned: ['car_zaporozhets'],
          active: ['car_zaporozhets'],
        },
      }),
    })
    await useGameStore.getState().purchaseDecoration('car_zaporozhets')
    expect(useGameStore.getState().decorations.active).toContain('car_zaporozhets')

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        balance: 400_000,
        decorations: {
          owned: ['car_zaporozhets', 'car_moskvich'],
          active: ['car_moskvich'],
        },
      }),
    })

    const result = await useGameStore.getState().purchaseDecoration('car_moskvich')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).not.toContain('car_zaporozhets')
    expect(useGameStore.getState().decorations.active).toContain('car_moskvich')
    expect(useGameStore.getState().decorations.owned).toContain('car_zaporozhets')
    expect(useGameStore.getState().decorations.owned).toContain('car_moskvich')
  })

  it('displaces cross-category conflict (wall_decor vs lighting on same slot)', async () => {
    useGameStore.setState({ balance: 10_000, garageLevel: 1 })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        balance: 8_000,
        decorations: {
          owned: ['decor_calendar'],
          active: ['decor_calendar'],
        },
      }),
    })
    await useGameStore.getState().purchaseDecoration('decor_calendar')
    expect(useGameStore.getState().decorations.active).toContain('decor_calendar')

    useGameStore.setState({ balance: 5_000 })
    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        balance: 2_000,
        decorations: {
          owned: ['decor_calendar', 'light_bulb'],
          active: ['light_bulb'],
        },
      }),
    })

    const result = await useGameStore.getState().purchaseDecoration('light_bulb')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).not.toContain('decor_calendar')
    expect(useGameStore.getState().decorations.active).toContain('light_bulb')
  })
})

describe('toggleDecoration', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState })
  })

  it('deactivates an active owned decoration offline', async () => {
    vi.spyOn(api, 'isOnline').mockReturnValue(false)
    useGameStore.setState({
      balance: 10000,
      garageLevel: 1,
      decorations: { owned: ['tools_workbench'], active: ['tools_workbench'] },
    })

    const result = await useGameStore.getState().toggleDecoration('tools_workbench')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).not.toContain('tools_workbench')
    expect(useGameStore.getState().decorations.owned).toContain('tools_workbench')
  })

  it('activates a hidden owned decoration offline', async () => {
    vi.spyOn(api, 'isOnline').mockReturnValue(false)
    useGameStore.setState({
      decorations: { owned: ['tools_workbench'], active: [] },
    })

    const result = await useGameStore.getState().toggleDecoration('tools_workbench')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).toContain('tools_workbench')
  })

  it('is a no-op when item is not owned', async () => {
    vi.spyOn(api, 'isOnline').mockReturnValue(false)
    useGameStore.setState({
      decorations: { owned: [], active: [] },
    })

    const result = await useGameStore.getState().toggleDecoration('tools_workbench')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.active).not.toContain('tools_workbench')
    expect(useGameStore.getState().decorations.owned).not.toContain('tools_workbench')
  })

  it('displaces slot conflict when activating a hidden decoration offline', async () => {
    vi.spyOn(api, 'isOnline').mockReturnValue(false)
    useGameStore.setState({
      decorations: {
        owned: ['car_zaporozhets', 'car_moskvich'],
        active: ['car_zaporozhets'],
      },
    })

    const result = await useGameStore.getState().toggleDecoration('car_moskvich')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).not.toContain('car_zaporozhets')
    expect(useGameStore.getState().decorations.active).toContain('car_moskvich')
  })

  it('does not displace when simply deactivating offline', async () => {
    vi.spyOn(api, 'isOnline').mockReturnValue(false)
    useGameStore.setState({
      decorations: {
        owned: ['car_zaporozhets', 'car_moskvich'],
        active: ['car_zaporozhets'],
      },
    })

    const result = await useGameStore.getState().toggleDecoration('car_zaporozhets')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).toHaveLength(0)
    expect(useGameStore.getState().decorations.owned).toHaveLength(2)
  })

  it('returns false and rolls back on server reject', async () => {
    useGameStore.setState({
      decorations: {
        owned: ['decor_calendar'],
        active: [],
      },
    })

    mockPerformAction.mockResolvedValueOnce(null)
    const result = await useGameStore.getState().toggleDecoration('decor_calendar')

    expect(result).toBe(false)
    expect(useGameStore.getState().decorations.active).toEqual([])
  })

  it('returns true when server confirms the new active state', async () => {
    useGameStore.setState({
      decorations: {
        owned: ['decor_calendar'],
        active: [],
      },
    })

    mockPerformAction.mockResolvedValueOnce({
      success: true,
      gameState: buildMockServerState({
        decorations: {
          owned: ['decor_calendar'],
          active: ['decor_calendar'],
        },
      }),
    })

    const result = await useGameStore.getState().toggleDecoration('decor_calendar')

    expect(result).toBe(true)
    expect(useGameStore.getState().decorations.active).toEqual(['decor_calendar'])
  })

  it('returns false when the same decoration toggle is already pending', async () => {
    useGameStore.setState({
      decorations: {
        owned: ['decor_calendar'],
        active: [],
      },
    })

    let resolveToggle: ((value: unknown) => void) | undefined
    mockPerformAction.mockImplementationOnce(() => new Promise((resolve) => {
      resolveToggle = resolve
    }) as ReturnType<typeof api.performAction>)

    const firstToggle = useGameStore.getState().toggleDecoration('decor_calendar')
    const secondToggle = await useGameStore.getState().toggleDecoration('decor_calendar')

    expect(secondToggle).toBe(false)

    resolveToggle?.({
      success: true,
      gameState: buildMockServerState({
        decorations: {
          owned: ['decor_calendar'],
          active: ['decor_calendar'],
        },
      }),
    })

    await expect(firstToggle).resolves.toBe(true)
  })
})
