// src/store/actions/boostActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, BoostType } from '../types'
import { BOOST_DEFINITIONS, BOOST_CONFLICT_GROUPS } from '../constants/boosts'

type Slice = Pick<GameStore, 'activateBoost' | 'tickBoosts' | 'getActiveMultiplier' | 'startBoostTick'>

export const createBoostSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  activateBoost: (type: BoostType): boolean => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить конфликты: нельзя активировать если активен буст из той же группы
    const conflictGroup = BOOST_CONFLICT_GROUPS.find(group => group.includes(type))
    if (conflictGroup) {
      const hasConflict = state.boosts.active.some(b => conflictGroup.includes(b.type))
      if (hasConflict) return false
    }

    const now = Date.now()
    _set(s => ({
      nuts: s.nuts - def.costNuts,
      boosts: {
        active: [
          ...s.boosts.active,
          { type, activatedAt: now, expiresAt: now + def.durationMs },
        ],
      },
    }))

    get().saveProgress()
    return true
  },

  tickBoosts: (): void => {
    const now = Date.now()
    const { boosts } = get()
    const alive = boosts.active.filter(b => b.expiresAt > now)
    if (alive.length !== boosts.active.length) {
      _set({ boosts: { active: alive } })
    }
  },

  getActiveMultiplier: (scope: 'income' | 'click'): number => {
    const { boosts } = get()
    const now = Date.now()
    const active = boosts.active.filter(b => b.expiresAt > now)

    // Income multiplier: произведение income_2x / income_3x
    let incomeMultiplier = 1
    for (const b of active) {
      if (b.type === 'income_2x' || b.type === 'income_3x') {
        incomeMultiplier *= BOOST_DEFINITIONS[b.type].multiplier
      }
    }

    if (scope === 'income') return incomeMultiplier

    // Click multiplier: turbo × income
    const turboBoost = active.find(b => b.type === 'turbo')
    const turboMultiplier = turboBoost ? BOOST_DEFINITIONS.turbo.multiplier : 1
    return turboMultiplier * incomeMultiplier
  },

  startBoostTick: (): (() => void) => {
    const id = setInterval(() => {
      get().tickBoosts()
    }, 1000)
    return () => clearInterval(id)
  },
})
