// src/store/actions/boostActions.ts
import type { StateCreator } from 'zustand'
import type { GameStore, BoostType } from '../types'
import { BOOST_DEFINITIONS } from '../constants/boosts'
import * as api from '../../services/apiService'

type Slice = Pick<GameStore,
  | 'activateBoost' | 'replaceBoost' | 'tickBoosts'
  | 'getActiveMultiplier'
>

export const createBoostSlice: StateCreator<GameStore, [], [], Slice> = (_set, get) => ({
  activateBoost: (type: BoostType): boolean => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить разблокировку по milestone
    if (def.unlockLevel > 0 && !state.milestonesPurchased.includes(def.unlockLevel)) return false

    // Проверить: нельзя активировать если уже есть активный буст
    // (для замены использовать replaceBoost)
    const now = Date.now()
    const hasActive = state.boosts.active.some(b => b.expiresAt > now)
    if (hasActive) return false

    _set(s => ({
      nuts: s.nuts - def.costNuts,
      boosts: {
        active: [{ type, activatedAt: now, expiresAt: now + def.durationMs }],
      },
    }))

    get().saveProgress()
    if (api.isOnline()) {
      api.performAction('activate_boost', { boostType: type }).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }
    return true
  },

  replaceBoost: (type: BoostType): boolean => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить разблокировку
    if (def.unlockLevel > 0 && !state.milestonesPurchased.includes(def.unlockLevel)) return false

    const now = Date.now()
    // Заменяем текущий буст (потерянное время не компенсируется)
    _set(s => ({
      nuts: s.nuts - def.costNuts,
      boosts: {
        active: [{ type, activatedAt: now, expiresAt: now + def.durationMs }],
      },
    }))

    get().saveProgress()
    if (api.isOnline()) {
      api.performAction('replace_boost', { boostType: type }).then(r => {
        if (r?.gameState) get().applyServerState(r.gameState)
      })
    }
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
    const active = boosts.active.find(b => b.expiresAt > now)

    if (!active) return 1

    // turbo влияет только на клики
    if (active.type === 'turbo') {
      return scope === 'click' ? BOOST_DEFINITIONS.turbo.multiplier : 1
    }

    // income_2x / income_3x влияют на всё (и клики, и пассив)
    return BOOST_DEFINITIONS[active.type].multiplier
  },

})
