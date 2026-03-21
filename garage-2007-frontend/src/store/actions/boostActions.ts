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
  activateBoost: async (type: BoostType): Promise<boolean> => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить разблокировку по milestone
    if (def.unlockLevel > 0 && !state.milestonesPurchased.includes(def.unlockLevel)) return false

    // Проверить: нельзя активировать если уже есть активный буст
    const now = Date.now()
    const hasActive = state.boosts.active.some(b => b.expiresAt > now)
    if (hasActive) return false

    // Server-first: premium action (nuts). No optimistic mutation.
    if (!api.isOnline()) {
      console.warn('[Boost] Cannot activate: not connected to server')
      // TODO: show user-facing error toast
      return false
    }

    const r = await api.performAction('activate_boost', { boostType: type })
    if (r?.gameState) {
      get().applyServerState(r.gameState)
      return true
    }
    console.warn('[Boost] Server rejected activate_boost')
    // TODO: show user-facing error toast
    return false
  },

  replaceBoost: async (type: BoostType): Promise<boolean> => {
    const state = get()
    const def = BOOST_DEFINITIONS[type]

    // Проверить баланс гаек
    if (state.nuts < def.costNuts) return false

    // Проверить разблокировку
    if (def.unlockLevel > 0 && !state.milestonesPurchased.includes(def.unlockLevel)) return false

    // Server-first: premium action (nuts). No optimistic mutation.
    if (!api.isOnline()) {
      console.warn('[Boost] Cannot replace: not connected to server')
      // TODO: show user-facing error toast
      return false
    }

    const r = await api.performAction('replace_boost', { boostType: type })
    if (r?.gameState) {
      get().applyServerState(r.gameState)
      return true
    }
    console.warn('[Boost] Server rejected replace_boost')
    // TODO: show user-facing error toast
    return false
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
